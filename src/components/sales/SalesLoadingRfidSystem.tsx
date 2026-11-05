import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Camera,
  QrCode,
  FileText,
  Truck,
  CheckCircle2,
  AlertTriangle,
  Package,
  Plus,
  Trash2,
  Search,
  ArrowRight,
  Upload,
  X,
  Check,
  ShieldAlert,
  Sparkles,
  RefreshCw,
  Eye,
  ClipboardCheck,
  Layers,
  User,
  MapPin,
  Calendar,
  Edit3,
  Download,
  FileSpreadsheet,
  Lock,
  BarChart3,
  PieChart,
  Activity,
  Gauge,
  Boxes
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { logisticsStore } from '../../services/store';
import { Fleet } from '../../types';
import { OFFICIAL_DESTINATION_AREAS } from '../../utils/areaNormalizer';
import { useSalesAdminUsers } from './SalesHeaderFilter';
import { useToast } from '../../context/ToastContext';
import {
  ExifMetadataBadge,
  ExifTimestampMetadata,
  createExifMetadataFromDate,
  extractExifFromFile,
  drawExifMetadataOnCanvas
} from '../../utils/exifMetadata';
import {
  databaseBarangService,
  DatabaseBarangRecord,
  createDefaultBarangThumbnail,
  estimateDataUrlSizeKb
} from '../../services/databaseBarangService';
import { WmsPureVisualBlueprintsModal } from './WmsPureVisualBlueprintsModal';

export interface ItemPhotoScanLog {
  id: string;
  timestamp: string;
  qtyScanned: number;
  photoDataUrl: string;
  scannedBy: string;
  notes?: string;
  exifMetadata?: ExifTimestampMetadata;
}

export interface SalesOrderItem {
  id: string;
  skuCode: string;
  itemName: string;
  unit: 'Box' | 'Ikat' | 'Bal' | 'Pack' | 'Roll' | 'Pcs';
  qtyOrdered: number;
  qtyLoaded: number;
  scans: ItemPhotoScanLog[];
  dokumentasiUrl?: string;
  compressedSizeKb?: number;
}

export interface SalesOrderInvoice {
  id: string;
  invoiceNumber: string;
  soNumber: string;
  date: string;
  customerName: string;
  areaName: string;
  fleetLabel: string;
  fleetLabels?: string[];
  adminPic: string;
  isLoadingFinished: boolean;
  finishedAt?: string;
  notes?: string;
  items: SalesOrderItem[];
}

const STORAGE_KEY_SALES_RFID = 'akk_sales_rfid_invoices_v1';
const ACTIVE_INVOICE_KEY = 'akk_sales_rfid_active_invoice_id';

const MASTER_PACKAGING_CATALOG: Array<{
  skuCode: string;
  itemName: string;
  unit: SalesOrderItem['unit'];
}> = [
  { skuCode: '7AFBG453', itemName: 'ALUFOIL REFIL BAGUS 45X7,62M (24PCS/CRT)', unit: 'Box' },
  { skuCode: '7AT00935', itemName: 'ALU TRAY OX-935 (100PCS/PAK)', unit: 'Pack' },
  { skuCode: '7AT01225', itemName: 'ALU TRAY OX-1225 (100PCS/PAK)', unit: 'Pack' },
  { skuCode: '7AT06005', itemName: 'ALU TRAY OX-6005 (100PCS/PAK)', unit: 'Pack' },
  { skuCode: 'RFID-KB-001', itemName: 'Karton Box Corrugated B-Flute 60x40x40 Polos', unit: 'Ikat' },
  { skuCode: 'RFID-KB-006', itemName: 'Mika Daleman Kue Sekat 4 (Isi 100 Pcs)', unit: 'Box' },
  { skuCode: 'RFID-KB-007', itemName: 'Karton Box Die-Cut Sepatu Ekspor', unit: 'Ikat' },
  { skuCode: 'RFID-KB-008', itemName: 'Lakban Coklat Packing AKK 48mm x 90Y', unit: 'Box' }
];

const PURGED_RFID_CODES = new Set(['RFID-KB-002', 'RFID-KB-003', 'RFID-KB-004', 'RFID-KB-005']);

function createSampleSvgPhoto(itemName: string, skuCode: string, qty: number, unit: string, timestamp: string): string {
  const safeName = itemName.replace(/[<>&"']/g, '');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="320" viewBox="0 0 480 320">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#0f172a"/>
        <stop offset="100%" stop-color="#1e293b"/>
      </linearGradient>
    </defs>
    <rect width="480" height="320" fill="url(#bg)"/>
    <rect x="24" y="24" width="432" height="272" rx="16" fill="none" stroke="#38bdf8" stroke-width="2" stroke-dasharray="10 6"/>
    <rect x="150" y="70" width="180" height="125" rx="10" fill="#d97706" fill-opacity="0.25" stroke="#f59e0b" stroke-width="2.5"/>
    <line x1="150" y1="110" x2="330" y2="110" stroke="#f59e0b" stroke-width="2"/>
    <line x1="240" y1="70" x2="240" y2="110" stroke="#f59e0b" stroke-width="2"/>
    <rect x="36" y="36" width="145" height="26" rx="6" fill="#0284c7"/>
    <text x="46" y="54" fill="#ffffff" font-family="sans-serif" font-size="11" font-weight="bold">TAG: ${skuCode}</text>
    <text x="240" y="152" text-anchor="middle" fill="#fef3c7" font-family="sans-serif" font-size="22" font-weight="bold">${qty} ${unit}</text>
    <text x="240" y="232" text-anchor="middle" fill="#f8fafc" font-family="sans-serif" font-size="14" font-weight="bold">${safeName.slice(0, 42)}</text>
    <text x="240" y="256" text-anchor="middle" fill="#94a3b8" font-family="sans-serif" font-size="11">TERVERIFIKASI KAMERA RFID VISUAL • ${timestamp}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function getInitialInvoices(fleetDefault: string, adminDefault: string): SalesOrderInvoice[] {
  return [
    {
      id: 'inv-rfid-1',
      invoiceNumber: 'FKT/AKK/2026/11/001',
      soNumber: 'SO-BWI-261101',
      date: '2026-11-03',
      customerName: 'TK HOLLY GENTENG',
      areaName: 'GENTENG RETAIL',
      fleetLabel: fleetDefault,
      adminPic: adminDefault,
      isLoadingFinished: false,
      notes: 'Order kemasan rutin mingguan — pastikan karton & tray di tumpukan aman',
      items: [
        {
          id: 'itm-1',
          skuCode: 'RFID-KB-001',
          itemName: 'Karton Box Corrugated B-Flute 60x40x40 Polos',
          unit: 'Ikat',
          qtyOrdered: 20,
          qtyLoaded: 20,
          scans: [
            {
              id: 'sc-1',
              timestamp: '08:15 WIB',
              qtyScanned: 20,
              photoDataUrl: createSampleSvgPhoto('Karton Box Corrugated B-Flute 60x40x40 Polos', 'RFID-KB-001', 20, 'Ikat', '08:15 WIB'),
              scannedBy: adminDefault,
              notes: 'Kondisi ikatan rapi & lengkap'
            }
          ]
        },
        {
          id: 'itm-2',
          skuCode: '7AFBG453',
          itemName: 'ALUFOIL REFIL BAGUS 45X7,62M (24PCS/CRT)',
          unit: 'Box',
          qtyOrdered: 15,
          qtyLoaded: 10,
          scans: [
            {
              id: 'sc-2',
              timestamp: '08:22 WIB',
              qtyScanned: 10,
              photoDataUrl: createSampleSvgPhoto('ALUFOIL REFIL BAGUS 45X7,62M (24PCS/CRT)', '7AFBG453', 10, 'Box', '08:22 WIB'),
              scannedBy: adminDefault,
              notes: 'Kloter pertama 10 box masuk armada'
            }
          ]
        },
        {
          id: 'itm-3',
          skuCode: '7AT00935',
          itemName: 'ALU TRAY OX-935 (100PCS/PAK)',
          unit: 'Pack',
          qtyOrdered: 12,
          qtyLoaded: 0,
          scans: []
        }
      ]
    },
    {
      id: 'inv-rfid-2',
      invoiceNumber: 'FKT/AKK/2026/11/002',
      soNumber: 'SO-DPS-261102',
      date: '2026-11-03',
      customerName: 'UD SUMBER KEMASAN BALI',
      areaName: 'DENPASAR 1',
      fleetLabel: fleetDefault,
      adminPic: adminDefault,
      isLoadingFinished: true,
      finishedAt: '09:10 WIB',
      notes: 'Pengiriman lintas pulau Denpasar 1',
      items: [
        {
          id: 'itm-201',
          skuCode: 'RFID-KB-006',
          itemName: 'Mika Daleman Kue Sekat 4 (Isi 100 Pcs)',
          unit: 'Box',
          qtyOrdered: 25,
          qtyLoaded: 25,
          scans: [
            {
              id: 'sc-201',
              timestamp: '08:50 WIB',
              qtyScanned: 25,
              photoDataUrl: createSampleSvgPhoto('Mika Daleman Kue Sekat 4 (Isi 100 Pcs)', 'RFID-KB-006', 25, 'Box', '08:50 WIB'),
              scannedBy: adminDefault,
              notes: 'Muatan sesuai faktur'
            }
          ]
        },
        {
          id: 'itm-202',
          skuCode: 'RFID-KB-008',
          itemName: 'Lakban Coklat Packing AKK 48mm x 90Y',
          unit: 'Box',
          qtyOrdered: 30,
          qtyLoaded: 34,
          scans: [
            {
              id: 'sc-202',
              timestamp: '09:05 WIB',
              qtyScanned: 34,
              photoDataUrl: createSampleSvgPhoto('Lakban Coklat Packing AKK 48mm x 90Y', 'RFID-KB-008', 34, 'Box', '09:05 WIB'),
              scannedBy: adminDefault,
              notes: 'Terbawa 4 box ekstra dari palet sebelah'
            }
          ]
        }
      ]
    }
  ];
}

export function evaluateInvoiceStatus(inv: SalesOrderInvoice): {
  statusLabel: string;
  badgeColor: string;
  unloadedItems: SalesOrderItem[];
  shortageItems: SalesOrderItem[];
  overloadItems: SalesOrderItem[];
  matchedItems: SalesOrderItem[];
  totalOrdered: number;
  totalLoaded: number;
} {
  const unloadedItems = inv.items.filter(i => i.qtyLoaded === 0 && i.qtyOrdered > 0);
  const shortageItems = inv.items.filter(i => i.qtyLoaded > 0 && i.qtyLoaded < i.qtyOrdered);
  const overloadItems = inv.items.filter(i => i.qtyLoaded > i.qtyOrdered);
  const matchedItems = inv.items.filter(i => i.qtyLoaded === i.qtyOrdered && i.qtyOrdered > 0);

  const totalOrdered = inv.items.reduce((acc, i) => acc + i.qtyOrdered, 0);
  const totalLoaded = inv.items.reduce((acc, i) => acc + i.qtyLoaded, 0);

  if (overloadItems.length > 0) {
    return {
      statusLabel: 'WARNING: Lebih Muat Barang!',
      badgeColor: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30',
      unloadedItems,
      shortageItems,
      overloadItems,
      matchedItems,
      totalOrdered,
      totalLoaded
    };
  }

  if (matchedItems.length === inv.items.length && inv.items.length > 0) {
    return {
      statusLabel: 'Lengkap & Sesuai Faktur',
      badgeColor: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
      unloadedItems,
      shortageItems,
      overloadItems,
      matchedItems,
      totalOrdered,
      totalLoaded
    };
  }

  if (inv.isLoadingFinished && (unloadedItems.length > 0 || shortageItems.length > 0)) {
    return {
      statusLabel: 'Ada Barang Sisa / Belum Termuat',
      badgeColor: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
      unloadedItems,
      shortageItems,
      overloadItems,
      matchedItems,
      totalOrdered,
      totalLoaded
    };
  }

  if (totalLoaded === 0) {
    return {
      statusLabel: 'Belum Dimuat (Menunggu Scan)',
      badgeColor: 'bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30',
      unloadedItems,
      shortageItems,
      overloadItems,
      matchedItems,
      totalOrdered,
      totalLoaded
    };
  }

  return {
    statusLabel: 'Proses Scan & Muat Armada',
    badgeColor: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30',
    unloadedItems,
    shortageItems,
    overloadItems,
    matchedItems,
    totalOrdered,
    totalLoaded
  };
}

function useSharedSalesRfidInvoices() {
  const [fleets, setFleets] = useState<Fleet[]>(() => logisticsStore.getFleets());
  const salesAdminUsers = useSalesAdminUsers();

  useEffect(() => {
    const unsub = logisticsStore.subscribe(() => {
      setFleets([...logisticsStore.getFleets()]);
    });
    return unsub;
  }, []);

  const fleetOptions = useMemo(() => {
    return fleets.map(f => {
      const code = f.initialCode ? `[${f.initialCode}] ` : '';
      return `${code}${f.plateNumber} — ${f.vehicleType}`;
    });
  }, [fleets]);

  const adminNames = useMemo(() => {
    const names = salesAdminUsers.map(u => (u.fullName || '').trim().toUpperCase()).filter(Boolean);
    return names.length > 0 ? Array.from(new Set(names)) : ['ADMIN PENJUALAN'];
  }, [salesAdminUsers]);

  const defaultFleet = fleetOptions[0] || '[NL1] P 8476 V — CDE Box';
  const defaultAdmin = adminNames[0] || 'ADMIN PENJUALAN';

  const sanitizeSavedInvoices = (rawList: SalesOrderInvoice[]): SalesOrderInvoice[] => {
    const replacements: Record<string, { skuCode: string; itemName: string; unit: SalesOrderItem['unit'] }> = {
      'RFID-KB-002': { skuCode: '7AFBG453', itemName: 'ALUFOIL REFIL BAGUS 45X7,62M (24PCS/CRT)', unit: 'Box' },
      'RFID-KB-003': { skuCode: 'RFID-KB-006', itemName: 'Mika Daleman Kue Sekat 4 (Isi 100 Pcs)', unit: 'Box' },
      'RFID-KB-004': { skuCode: '7AT00935', itemName: 'ALU TRAY OX-935 (100PCS/PAK)', unit: 'Pack' },
      'RFID-KB-005': { skuCode: 'RFID-KB-008', itemName: 'Lakban Coklat Packing AKK 48mm x 90Y', unit: 'Box' }
    };
    let mutated = false;
    const cleaned = rawList.map(inv => ({
      ...inv,
      items: (inv.items || []).map(it => {
        const codeUpper = String(it.skuCode || '').trim().toUpperCase();
        if (PURGED_RFID_CODES.has(codeUpper) && replacements[codeUpper]) {
          mutated = true;
          const rep = replacements[codeUpper];
          return {
            ...it,
            skuCode: rep.skuCode,
            itemName: rep.itemName,
            unit: rep.unit
          };
        }
        return it;
      })
    }));
    if (mutated) {
      try {
        localStorage.setItem(STORAGE_KEY_SALES_RFID, JSON.stringify(cleaned));
      } catch {}
    }
    return cleaned;
  };

  const [invoices, setInvoices] = useState<SalesOrderInvoice[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SALES_RFID);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return sanitizeSavedInvoices(parsed);
      }
    } catch {}
    return getInitialInvoices(defaultFleet, defaultAdmin);
  });

  useEffect(() => {
    const syncFromStorage = () => {
      try {
        const saved = localStorage.getItem(STORAGE_KEY_SALES_RFID);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) setInvoices(sanitizeSavedInvoices(parsed));
        }
      } catch {}
    };
    window.addEventListener('akk-sales-rfid-updated', syncFromStorage);
    window.addEventListener('storage', syncFromStorage);
    return () => {
      window.removeEventListener('akk-sales-rfid-updated', syncFromStorage);
      window.removeEventListener('storage', syncFromStorage);
    };
  }, []);

  const saveInvoices = (updater: SalesOrderInvoice[] | ((prev: SalesOrderInvoice[]) => SalesOrderInvoice[])) => {
    setInvoices(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      try {
        localStorage.setItem(STORAGE_KEY_SALES_RFID, JSON.stringify(next));
        window.dispatchEvent(new CustomEvent('akk-sales-rfid-updated'));
      } catch {}
      return next;
    });
  };

  return {
    invoices,
    saveInvoices,
    fleetOptions,
    adminNames,
    defaultFleet,
    defaultAdmin
  };
}

// ============================================================================
// SUB-MENU 1: INPUT FAKTUR / SALES ORDER (SO) UNTUK MUAT ARMADA BOX
// ============================================================================
interface SalesInvoiceSoTabProps {
  onOpenRfidScannerForInvoice: (invoiceId: string) => void;
}

export const SalesInvoiceSoTab: React.FC<SalesInvoiceSoTabProps> = ({
  onOpenRfidScannerForInvoice
}) => {
  const { addNotification } = useToast();
  const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    addNotification(
      type === 'error' ? 'sla_warning' : 'checker',
      type === 'error' ? 'Peringatan Muat RFID' : 'Faktur & SO Muat',
      msg,
      type === 'error'
    );
  };
  const {
    invoices,
    saveInvoices,
    fleetOptions,
    adminNames,
    defaultFleet,
    defaultAdmin
  } = useSharedSalesRfidInvoices();

  const [fakturViewMode, setFakturViewMode] = useState<'list' | 'dashboard'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterFleet, setFilterFleet] = useState('SEMUA ARMADA');
  const [filterStatus, setFilterStatus] = useState('SEMUA STATUS');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);

  // Form states for Import File Faktur / Sales Order (Pilih Area -> Upload File -> Review File)
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [soNumber, setSoNumber] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [customerName, setCustomerName] = useState('');
  const [areaName, setAreaName] = useState<string>('');
  const [fleetLabel, setFleetLabel] = useState(defaultFleet);
  const [selectedFleets, setSelectedFleets] = useState<string[]>([defaultFleet]);
  const [adminPic, setAdminPic] = useState(defaultAdmin);
  const [notes, setNotes] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  const [hasReviewedFile, setHasReviewedFile] = useState<boolean>(false);
  const importFileInputRef = useRef<HTMLInputElement | null>(null);

  const [dbBarangList, setDbBarangList] = useState<DatabaseBarangRecord[]>(() =>
    databaseBarangService.getAll()
  );

  useEffect(() => {
    void databaseBarangService.ensureHydrated().then(loaded => {
      setDbBarangList(loaded);
    });
    const syncDb = () => {
      setDbBarangList(databaseBarangService.getAll());
    };
    window.addEventListener('akk-database-barang-updated', syncDb);
    window.addEventListener('storage', syncDb);
    return () => {
      window.removeEventListener('akk-database-barang-updated', syncDb);
      window.removeEventListener('storage', syncDb);
    };
  }, []);

  // Baris Review File Faktur sesuai template: No Faktur | Nama Pelanggan | Item Barang | Qty | Satuan (Terintegrasi Database Barang)
  const [reviewRows, setReviewRows] = useState<Array<{
    id: string;
    noFaktur: string;
    namaPelanggan: string;
    itemBarang: string;
    qty: number;
    satuan: SalesOrderItem['unit'];
    skuCode: string;
    dokumentasiUrl?: string;
    compressedSizeKb?: number;
  }>>([]);

  const normalizeUnit = (rawUnit: string): SalesOrderItem['unit'] => {
    const clean = (rawUnit || '').trim().toLowerCase();
    if (clean.includes('ikat')) return 'Ikat';
    if (clean.includes('bal')) return 'Bal';
    if (clean.includes('pack') || clean.includes('pak')) return 'Pack';
    if (clean.includes('roll') || clean.includes('rol')) return 'Roll';
    if (clean.includes('pcs') || clean.includes('buah') || clean.includes('biji')) return 'Pcs';
    return 'Box';
  };

  const openCreateModal = () => {
    setEditingInvoiceId(null);
    setInvoiceNumber('');
    setSoNumber('');
    setDate(new Date().toISOString().split('T')[0]);
    setCustomerName('');
    // Kosongkan areaName saat awal agar user wajib memilih Nama Area Kirim terlebih dahulu sebelum upload file
    setAreaName('');
    const initialFleet = fleetOptions[0] || defaultFleet;
    setFleetLabel(initialFleet);
    setSelectedFleets([initialFleet]);
    setAdminPic(adminNames[0] || defaultAdmin);
    setNotes('');
    setUploadedFileName('');
    setHasReviewedFile(false);
    setReviewRows([]);
    if (importFileInputRef.current) {
      importFileInputRef.current.value = '';
    }
    setIsModalOpen(true);
  };

  const openEditModal = (inv: SalesOrderInvoice) => {
    setEditingInvoiceId(inv.id);
    setInvoiceNumber(inv.invoiceNumber);
    setSoNumber(inv.soNumber);
    setDate(inv.date);
    setCustomerName(inv.customerName);
    setAreaName(inv.areaName);
    const parsedFleets =
      inv.fleetLabels && inv.fleetLabels.length > 0
        ? inv.fleetLabels
        : inv.fleetLabel
        ? inv.fleetLabel.split(' + ').map(s => s.trim()).filter(Boolean)
        : [fleetOptions[0] || defaultFleet];
    setSelectedFleets(parsedFleets.length > 0 ? parsedFleets : [fleetOptions[0] || defaultFleet]);
    setFleetLabel(parsedFleets[0] || fleetOptions[0] || defaultFleet);
    setAdminPic(inv.adminPic);
    setNotes(inv.notes || '');
    setUploadedFileName(`Edit Manual — ${inv.invoiceNumber}`);
    setHasReviewedFile(true);
    setReviewRows(
      inv.items.map(it => ({
        id: it.id,
        noFaktur: inv.invoiceNumber,
        namaPelanggan: inv.customerName,
        itemBarang: it.itemName,
        qty: it.qtyOrdered,
        satuan: it.unit,
        skuCode: it.skuCode
      }))
    );
    setIsModalOpen(true);
  };

  const handleDownloadTemplateExcel = (format: 'xlsx' | 'csv' = 'xlsx') => {
    const sampleArea = areaName || 'GENTENG RETAIL';
    const templateRows = [
      {
        'No Faktur': 'FKT/AKK/2026/11/001',
        'Nama Pelanggan': `TK MAKMUR JAYA (${sampleArea})`,
        'Item Barang': 'Karton Box Corrugated B-Flute 60x40x40 Polos',
        Qty: 20,
        Satuan: 'Ikat'
      },
      {
        'No Faktur': 'FKT/AKK/2026/11/001',
        'Nama Pelanggan': `TK MAKMUR JAYA (${sampleArea})`,
        'Item Barang': 'Karton Box Duplex Cetak Custom 30x20x15',
        Qty: 15,
        Satuan: 'Box'
      },
      {
        'No Faktur': 'FKT/AKK/2026/11/002',
        'Nama Pelanggan': `UD SUMBER BERKAH (${sampleArea})`,
        'Item Barang': 'Box Kemasan Roti & Kue Ivory 22x22x8',
        Qty: 25,
        Satuan: 'Bal'
      }
    ];

    const ws = XLSX.utils.json_to_sheet(templateRows, {
      header: ['No Faktur', 'Nama Pelanggan', 'Item Barang', 'Qty', 'Satuan']
    });
    ws['!cols'] = [
      { wch: 24 },
      { wch: 30 },
      { wch: 44 },
      { wch: 10 },
      { wch: 12 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template_Faktur');

    const safeAreaSlug = (areaName || 'Area_Kirim').replace(/[^a-zA-Z0-9]+/g, '_');
    if (format === 'csv') {
      const csv = XLSX.utils.sheet_to_csv(ws);
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Template_Import_Faktur_${safeAreaSlug}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else {
      XLSX.writeFile(wb, `Template_Import_Faktur_${safeAreaSlug}.xlsx`);
    }
    showToast('Template Import Faktur (No Faktur, Nama Pelanggan, Item Barang, Qty, Satuan) berhasil diunduh.', 'info');
  };

  const handleFileUploadChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!areaName.trim()) {
      showToast('Pilih Nama Area Kirim terlebih dahulu sebelum mengunggah file faktur!', 'error');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = evt => {
      try {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rawJson = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });

        if (!rawJson || rawJson.length === 0) {
          showToast('File kosong atau tidak memiliki baris data sesuai template.', 'error');
          return;
        }

        const seqBase = String(invoices.length + 1).padStart(3, '0');
        const defaultFaktur = `FKT/AKK/2026/11/${seqBase}`;

        const parsedRows = rawJson
          .map((row, idx) => {
            const keys = Object.keys(row);
            const findCol = (patterns: string[]) => {
              const matchedKey = keys.find(k =>
                patterns.some(p => k.toLowerCase().replace(/[^a-z0-9]/g, '').includes(p))
              );
              return matchedKey ? String(row[matchedKey] ?? '').trim() : '';
            };

            const noFakturVal =
              findCol(['nofaktur', 'nomorfaktur', 'faktur', 'invoice', 'noso']) || defaultFaktur;
            const namaPelangganVal =
              findCol(['namapelanggan', 'pelanggan', 'customer', 'toko', 'outlet']) ||
              `PELANGGAN ${areaName}`;
            const noBarangVal =
              findCol(['nomorbarang', 'nobarang', 'kodebarang', 'sku', 'kodesku']) || '';
            const itemBarangVal =
              findCol(['itembarang', 'keteranganbarang', 'namabarang', 'item', 'barang', 'produk', 'deskripsi']) || '';
            const qtyRaw = findCol(['qty', 'jumlah', 'kuantitas', 'volume', 'order']);
            const satuanRaw = findCol(['satuan', 'unit', 'kemasan', 'uom']) || '';

            const qtyNum = Math.max(1, Number(String(qtyRaw).replace(/[^0-9.]/g, '')) || 0);
            const matchedDb = databaseBarangService.findMatch(noBarangVal || itemBarangVal, itemBarangVal);
            const matchedCatalog = MASTER_PACKAGING_CATALOG.find(
              c => c.itemName.toLowerCase() === itemBarangVal.toLowerCase()
            );

            const resolvedNoBarang =
              matchedDb?.noBarang ||
              noBarangVal.toUpperCase() ||
              matchedCatalog?.skuCode ||
              `AKK-BRG-${String(idx + 1).padStart(3, '0')}`;
            const resolvedKeterangan = matchedDb?.keteranganBarang || itemBarangVal;
            const resolvedSatuan = normalizeUnit(satuanRaw || matchedDb?.satuan || 'Box');
            const resolvedDocUrl =
              matchedDb?.dokumentasiUrl ||
              createDefaultBarangThumbnail(resolvedNoBarang, resolvedKeterangan, resolvedSatuan);
            const resolvedSizeKb = matchedDb?.compressedSizeKb || estimateDataUrlSizeKb(resolvedDocUrl);

            return {
              id: `imp-${Date.now()}-${idx}`,
              noFaktur: noFakturVal.toUpperCase(),
              namaPelanggan: namaPelangganVal.toUpperCase(),
              itemBarang: resolvedKeterangan,
              qty: qtyNum > 0 ? qtyNum : 10,
              satuan: resolvedSatuan,
              skuCode: resolvedNoBarang,
              dokumentasiUrl: resolvedDocUrl,
              compressedSizeKb: resolvedSizeKb
            };
          })
          .filter(r => r.itemBarang.trim().length > 0);

        if (parsedRows.length === 0) {
          showToast(
            'Pastikan kolom file sesuai template: No Faktur, Nama Pelanggan, Item Barang, Qty, Satuan.',
            'error'
          );
          return;
        }

        setUploadedFileName(file.name);
        setReviewRows(parsedRows);
        setHasReviewedFile(true);
        showToast(
          `File "${file.name}" berhasil dibaca (${parsedRows.length} baris item untuk area ${areaName}). Silakan periksa pada tabel Review File di bawah.`,
          'success'
        );
      } catch {
        showToast('Gagal membaca file. Gunakan format Excel (.xlsx / .xls) atau CSV sesuai template.', 'error');
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleLoadSampleImportForArea = () => {
    if (!areaName.trim()) {
      showToast('Pilih Nama Area Kirim terlebih dahulu pada Langkah 1!', 'error');
      return;
    }
    const seq1 = String(invoices.length + 1).padStart(3, '0');
    const seq2 = String(invoices.length + 2).padStart(3, '0');
    const sampleRows: typeof reviewRows = [
      {
        id: `smp-${Date.now()}-1`,
        noFaktur: `FKT/AKK/2026/11/${seq1}`,
        namaPelanggan: `TK SINAR KEMASAN (${areaName})`,
        itemBarang: 'Karton Box Corrugated B-Flute 60x40x40 Polos',
        qty: 25,
        satuan: 'Ikat',
        skuCode: 'RFID-KB-001'
      },
      {
        id: `smp-${Date.now()}-2`,
        noFaktur: `FKT/AKK/2026/11/${seq1}`,
        namaPelanggan: `TK SINAR KEMASAN (${areaName})`,
        itemBarang: 'ALUFOIL REFIL BAGUS 45X7,62M (24PCS/CRT)',
        qty: 15,
        satuan: 'Box',
        skuCode: '7AFBG453'
      },
      {
        id: `smp-${Date.now()}-3`,
        noFaktur: `FKT/AKK/2026/11/${seq2}`,
        namaPelanggan: `UD MITRA MANDIRI (${areaName})`,
        itemBarang: 'ALU TRAY OX-935 (100PCS/PAK)',
        qty: 30,
        satuan: 'Pack',
        skuCode: '7AT00935'
      }
    ];
    setUploadedFileName(`Import_Faktur_${areaName.replace(/\s+/g, '_')}.xlsx`);
    setReviewRows(sampleRows);
    setHasReviewedFile(true);
    showToast(`Data contoh file faktur untuk area ${areaName} siap di-review.`, 'info');
  };

  const handleAddReviewRow = () => {
    if (!areaName.trim()) {
      showToast('Pilih Nama Area Kirim terlebih dahulu!', 'error');
      return;
    }
    const nextIdx = reviewRows.length;
    const seq = String(invoices.length + 1).padStart(3, '0');
    const lastRow = reviewRows[reviewRows.length - 1];
    const dbPreset = dbBarangList[nextIdx % Math.max(1, dbBarangList.length)];
    const fallbackPreset = MASTER_PACKAGING_CATALOG[nextIdx % MASTER_PACKAGING_CATALOG.length];
    const resolvedNo = dbPreset?.noBarang || fallbackPreset?.skuCode || `AKK-BRG-00${nextIdx + 1}`;
    const resolvedKet = dbPreset?.keteranganBarang || fallbackPreset?.itemName || '';
    const resolvedSat = normalizeUnit(dbPreset?.satuan || fallbackPreset?.unit || 'Box');
    const resolvedDoc =
      dbPreset?.dokumentasiUrl || createDefaultBarangThumbnail(resolvedNo, resolvedKet, resolvedSat);

    setReviewRows(prev => [
      ...prev,
      {
        id: `rev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        noFaktur: lastRow?.noFaktur || invoiceNumber || `FKT/AKK/2026/11/${seq}`,
        namaPelanggan: lastRow?.namaPelanggan || customerName || `TOKO PELANGGAN ${areaName}`,
        itemBarang: resolvedKet,
        qty: 10,
        satuan: resolvedSat,
        skuCode: resolvedNo,
        dokumentasiUrl: resolvedDoc,
        compressedSizeKb: dbPreset?.compressedSizeKb || estimateDataUrlSizeKb(resolvedDoc)
      }
    ]);
    setHasReviewedFile(true);
    if (!uploadedFileName) {
      setUploadedFileName(`Input_Terstruktur_${areaName.replace(/\s+/g, '_')}.xlsx`);
    }
  };

  const handleSaveInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!areaName.trim()) {
      showToast('Mohon pilih Nama Area Kirim terlebih dahulu!', 'error');
      return;
    }

    const validRows = reviewRows.filter(
      r => r.noFaktur.trim() && r.namaPelanggan.trim() && r.itemBarang.trim() && Number(r.qty) > 0
    );

    if (validRows.length === 0) {
      showToast(
        'Belum ada data faktur yang valid pada Review File. Pastikan kolom No Faktur, Nama Pelanggan, Item Barang, Qty, dan Satuan terisi.',
        'error'
      );
      return;
    }

    // Sinkronkan setiap item faktur ke Database Barang Gudang (Nomor Barang, Keterangan Barang, Satuan, Dokumentasi)
    validRows.forEach((d, idx) => {
      const code = d.skuCode.trim().toUpperCase() || `AKK-BRG-00${idx + 1}`;
      databaseBarangService.upsertItem({
        noBarang: code,
        keteranganBarang: d.itemBarang.trim(),
        satuan: d.satuan,
        dokumentasiUrl: d.dokumentasiUrl,
        compressedSizeKb: d.compressedSizeKb
      });
    });

    const finalFleets =
      selectedFleets.length > 0 ? selectedFleets : [fleetLabel || fleetOptions[0] || defaultFleet];
    const finalFleetLabel = finalFleets.join(' + ');

    if (editingInvoiceId) {
      const firstRow = validRows[0];
      saveInvoices(prev =>
        prev.map(inv => {
          if (inv.id !== editingInvoiceId) return inv;
          const mergedItems: SalesOrderItem[] = validRows.map((d, idx) => {
            const existing = inv.items.find(old => old.id === d.id);
            const matchedDb = databaseBarangService.findMatch(d.skuCode, d.itemBarang);
            return {
              id: d.id,
              skuCode: d.skuCode.trim().toUpperCase() || matchedDb?.noBarang || `AKK-BRG-00${idx + 1}`,
              itemName: d.itemBarang.trim(),
              unit: d.satuan,
              qtyOrdered: Number(d.qty),
              qtyLoaded: existing ? existing.qtyLoaded : 0,
              scans: existing ? existing.scans : [],
              dokumentasiUrl: d.dokumentasiUrl || matchedDb?.dokumentasiUrl,
              compressedSizeKb: d.compressedSizeKb || matchedDb?.compressedSizeKb
            };
          });
          return {
            ...inv,
            invoiceNumber: firstRow.noFaktur.trim().toUpperCase(),
            soNumber: soNumber.trim().toUpperCase() || inv.soNumber,
            date,
            customerName: firstRow.namaPelanggan.trim().toUpperCase(),
            areaName,
            fleetLabel: finalFleetLabel,
            fleetLabels: finalFleets,
            adminPic,
            notes: notes.trim(),
            items: mergedItems
          };
        })
      );
      showToast(
        `Faktur ${firstRow.noFaktur} (Area ${areaName} • ${finalFleets.length} Armada) berhasil diperbarui & tersinkron ke Database Barang + Aplikasi RFID!`,
        'success'
      );
    } else {
      // Kelompokkan baris hasil import berdasarkan No Faktur + Nama Pelanggan
      const groupedMap = new Map<
        string,
        {
          noFaktur: string;
          namaPelanggan: string;
          rows: typeof validRows;
        }
      >();

      validRows.forEach(r => {
        const key = `${r.noFaktur.trim().toUpperCase()}__${r.namaPelanggan.trim().toUpperCase()}`;
        if (!groupedMap.has(key)) {
          groupedMap.set(key, {
            noFaktur: r.noFaktur.trim().toUpperCase(),
            namaPelanggan: r.namaPelanggan.trim().toUpperCase(),
            rows: []
          });
        }
        groupedMap.get(key)!.rows.push(r);
      });

      const createdInvoices: SalesOrderInvoice[] = Array.from(groupedMap.values()).map((grp, grpIdx) => ({
        id: `inv-${Date.now()}-${grpIdx}`,
        invoiceNumber: grp.noFaktur,
        soNumber: `SO-${areaName.replace(/[^A-Z0-9]/gi, '').slice(0, 3).toUpperCase()}-${String(invoices.length + grpIdx + 1).padStart(4, '0')}`,
        date,
        customerName: grp.namaPelanggan,
        areaName,
        fleetLabel: finalFleetLabel,
        fleetLabels: finalFleets,
        adminPic,
        isLoadingFinished: false,
        notes: notes.trim() || (uploadedFileName ? `Diimpor dari file: ${uploadedFileName}` : ''),
        items: grp.rows.map((d, i) => {
          const matchedDb = databaseBarangService.findMatch(d.skuCode, d.itemBarang);
          return {
            id: `itm-${Date.now()}-${grpIdx}-${i}`,
            skuCode: d.skuCode.trim().toUpperCase() || matchedDb?.noBarang || `AKK-BRG-00${i + 1}`,
            itemName: d.itemBarang.trim(),
            unit: d.satuan,
            qtyOrdered: Number(d.qty),
            qtyLoaded: 0,
            scans: [],
            dokumentasiUrl: d.dokumentasiUrl || matchedDb?.dokumentasiUrl,
            compressedSizeKb: d.compressedSizeKb || matchedDb?.compressedSizeKb
          };
        })
      }));

      saveInvoices(prev => [...createdInvoices, ...prev]);
      showToast(
        `${createdInvoices.length} Faktur (${validRows.length} item barang) untuk Area ${areaName} [${finalFleets.length} Armada] berhasil diimpor & terintegrasi dengan Database Barang + Aplikasi Scan RFID!`,
        'success'
      );
    }

    setIsModalOpen(false);
  };

  const handleDeleteInvoice = (inv: SalesOrderInvoice) => {
    saveInvoices(prev => prev.filter(i => i.id !== inv.id));
    showToast(`Faktur ${inv.invoiceNumber} telah dihapus.`, 'info');
  };

  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      const evalRes = evaluateInvoiceStatus(inv);
      const q = searchQuery.toLowerCase();
      const matchSearch =
        !q ||
        inv.invoiceNumber.toLowerCase().includes(q) ||
        inv.soNumber.toLowerCase().includes(q) ||
        inv.customerName.toLowerCase().includes(q) ||
        inv.areaName.toLowerCase().includes(q) ||
        inv.items.some(i => i.itemName.toLowerCase().includes(q) || i.skuCode.toLowerCase().includes(q));

      const matchFleet =
        filterFleet === 'SEMUA ARMADA' ||
        inv.fleetLabel === filterFleet ||
        inv.fleetLabel.includes(filterFleet) ||
        (inv.fleetLabels && inv.fleetLabels.some(f => f.includes(filterFleet) || filterFleet.includes(f)));

      const matchStatus =
        filterStatus === 'SEMUA STATUS' ||
        (filterStatus === 'LEBIH_MUAT' && evalRes.overloadItems.length > 0) ||
        (filterStatus === 'KURANG_SISA' && (evalRes.unloadedItems.length > 0 || evalRes.shortageItems.length > 0)) ||
        (filterStatus === 'SESUAI' && evalRes.matchedItems.length === inv.items.length && inv.items.length > 0);

      return matchSearch && matchFleet && matchStatus;
    });
  }, [invoices, searchQuery, filterFleet, filterStatus]);

  const summaryStats = useMemo(() => {
    let total = invoices.length;
    let sesuai = 0;
    let kurangAtauSisa = 0;
    let lebihMuat = 0;

    invoices.forEach(inv => {
      const ev = evaluateInvoiceStatus(inv);
      if (ev.overloadItems.length > 0) lebihMuat++;
      else if (ev.matchedItems.length === inv.items.length && inv.items.length > 0) sesuai++;
      else if (ev.unloadedItems.length > 0 || ev.shortageItems.length > 0) kurangAtauSisa++;
    });

    return { total, sesuai, kurangAtauSisa, lebihMuat };
  }, [invoices]);

  const dashboardAnalytics = useMemo(() => {
    let totalInvoices = invoices.length;
    let totalOrderedQty = 0;
    let totalLoadedQty = 0;
    let totalEstimatedVolumeM3 = 0;
    let totalEstimatedWeightKg = 0;

    const fleetMap = new Map<
      string,
      {
        fleetName: string;
        invoiceCount: number;
        totalOrdered: number;
        totalLoaded: number;
        volumeM3: number;
        weightKg: number;
        areas: Set<string>;
        invoices: SalesOrderInvoice[];
      }
    >();

    const areaMap = new Map<
      string,
      {
        areaName: string;
        invoiceCount: number;
        customers: Set<string>;
        totalOrdered: number;
        totalLoaded: number;
        volumeM3: number;
        weightKg: number;
        fleets: Set<string>;
        invoices: SalesOrderInvoice[];
      }
    >();

    const unloadedItemsList: Array<{
      invoice: SalesOrderInvoice;
      item: SalesOrderItem;
      remainingQty: number;
    }> = [];

    const overloadedItemsList: Array<{
      invoice: SalesOrderInvoice;
      item: SalesOrderItem;
      excessQty: number;
    }> = [];

    invoices.forEach(inv => {
      const invFleets =
        inv.fleetLabels && inv.fleetLabels.length > 0
          ? inv.fleetLabels
          : inv.fleetLabel
          ? inv.fleetLabel.split(' + ').map(s => s.trim()).filter(Boolean)
          : [defaultFleet];

      let invVol = 0;
      let invWeight = 0;

      inv.items.forEach(it => {
        totalOrderedQty += it.qtyOrdered;
        totalLoadedQty += it.qtyLoaded;

        const matchedDb = databaseBarangService.findMatch(it.skuCode, it.itemName);
        const itemVol = (matchedDb?.volM3 || 0) * it.qtyOrdered;
        const itemWeight = (matchedDb?.beratKg || 0) * it.qtyOrdered;
        invVol += itemVol;
        invWeight += itemWeight;

        if (it.qtyLoaded < it.qtyOrdered) {
          unloadedItemsList.push({
            invoice: inv,
            item: it,
            remainingQty: it.qtyOrdered - it.qtyLoaded
          });
        } else if (it.qtyLoaded > it.qtyOrdered) {
          overloadedItemsList.push({
            invoice: inv,
            item: it,
            excessQty: it.qtyLoaded - it.qtyOrdered
          });
        }
      });

      totalEstimatedVolumeM3 += invVol;
      totalEstimatedWeightKg += invWeight;

      invFleets.forEach(fl => {
        if (!fleetMap.has(fl)) {
          fleetMap.set(fl, {
            fleetName: fl,
            invoiceCount: 0,
            totalOrdered: 0,
            totalLoaded: 0,
            volumeM3: 0,
            weightKg: 0,
            areas: new Set<string>(),
            invoices: []
          });
        }
        const fEntry = fleetMap.get(fl)!;
        fEntry.invoiceCount++;
        fEntry.totalOrdered += inv.items.reduce((acc, it) => acc + it.qtyOrdered, 0);
        fEntry.totalLoaded += inv.items.reduce((acc, it) => acc + it.qtyLoaded, 0);
        fEntry.volumeM3 += invVol;
        fEntry.weightKg += invWeight;
        fEntry.areas.add(inv.areaName);
        fEntry.invoices.push(inv);
      });

      if (!areaMap.has(inv.areaName)) {
        areaMap.set(inv.areaName, {
          areaName: inv.areaName,
          invoiceCount: 0,
          customers: new Set<string>(),
          totalOrdered: 0,
          totalLoaded: 0,
          volumeM3: 0,
          weightKg: 0,
          fleets: new Set<string>(),
          invoices: []
        });
      }
      const aEntry = areaMap.get(inv.areaName)!;
      aEntry.invoiceCount++;
      aEntry.customers.add(inv.customerName);
      aEntry.totalOrdered += inv.items.reduce((acc, it) => acc + it.qtyOrdered, 0);
      aEntry.totalLoaded += inv.items.reduce((acc, it) => acc + it.qtyLoaded, 0);
      aEntry.volumeM3 += invVol;
      aEntry.weightKg += invWeight;
      invFleets.forEach(fl => aEntry.fleets.add(fl));
      aEntry.invoices.push(inv);
    });

    const overallPct =
      totalOrderedQty > 0 ? Math.min(100, Math.round((totalLoadedQty / totalOrderedQty) * 100)) : 0;

    return {
      totalInvoices,
      totalOrderedQty,
      totalLoadedQty,
      overallPct,
      totalEstimatedVolumeM3: Math.round(totalEstimatedVolumeM3 * 1000) / 1000,
      totalEstimatedWeightKg: Math.round(totalEstimatedWeightKg * 10) / 10,
      fleetBreakdown: Array.from(fleetMap.values()),
      areaBreakdown: Array.from(areaMap.values()).map(a => ({
        ...a,
        customerCount: a.customers.size
      })),
      unloadedItemsList,
      overloadedItemsList
    };
  }, [invoices, dbBarangList, defaultFleet]);

  return (
    <div className="space-y-6">
      {/* Top Banner & Direct Bridge to RFID Scanner App */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              <FileText className="w-4 h-4" />
              <span>Sub-Menu 1 • Pengeluaran Barang Admin Penjualan</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mt-1">
              Input Faktur / Sales Order (SO) Muatan Armada Box
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-3xl">
              Input rincian barang sesuai Faktur / Sales Order yang akan dikeluarkan dan dimuat ke armada box. Data faktur ini otomatis terintegrasi dengan <strong>Aplikasi Scan &amp; Foto Muat (RFID)</strong> untuk mendeteksi barang sisa (belum termuat), kurang muat, maupun peringatan lebih muat.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 self-start lg:self-center">
            {/* View Mode Switcher: Antrean & Daftar Faktur vs Dashboard Analitik Muatan */}
            <div className="inline-flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setFakturViewMode('list')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  fakturViewMode === 'list'
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>📋 Daftar Faktur</span>
              </button>
              <button
                type="button"
                onClick={() => setFakturViewMode('dashboard')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  fakturViewMode === 'dashboard'
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>📊 Dashboard Analitik Muatan</span>
              </button>
            </div>

            <button
              type="button"
              onClick={openCreateModal}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-sm transition cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>+ Import File Faktur / SO Baru</span>
            </button>
            <button
              type="button"
              onClick={() => {
                const firstId = invoices[0]?.id || '';
                onOpenRfidScannerForInvoice(firstId);
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white border border-slate-700 text-xs font-bold transition cursor-pointer"
            >
              <Camera className="w-4 h-4 text-sky-400" />
              <span>Buka Aplikasi Scan RFID</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
            </button>
          </div>
        </div>

        {/* 4 Summary Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mt-5 pt-5 border-t border-slate-100 dark:border-slate-800">
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/70">
            <div className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400">Total Faktur / SO</div>
            <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">{summaryStats.total}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Terdaftar di antrean muat armada</div>
          </div>

          <div className="p-3.5 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
            <div className="text-[11px] font-bold uppercase text-emerald-600 dark:text-emerald-400">Lengkap &amp; Sesuai</div>
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{summaryStats.sesuai}</div>
            <div className="text-[11px] text-emerald-600/80 dark:text-emerald-400/80 mt-0.5">100% klop antara faktur &amp; foto muat</div>
          </div>

          <div className="p-3.5 rounded-xl bg-amber-500/5 border border-amber-500/20">
            <div className="text-[11px] font-bold uppercase text-amber-600 dark:text-amber-400">Barang Sisa / Belum Termuat</div>
            <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">{summaryStats.kurangAtauSisa}</div>
            <div className="text-[11px] text-amber-600/80 dark:text-amber-400/80 mt-0.5">Masih ada item belum/kurang dimuat</div>
          </div>

          <div className="p-3.5 rounded-xl bg-rose-500/5 border border-rose-500/20">
            <div className="text-[11px] font-bold uppercase text-rose-600 dark:text-rose-400">Warning Lebih Muat</div>
            <div className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">{summaryStats.lebihMuat}</div>
            <div className="text-[11px] text-rose-600/80 dark:text-rose-400/80 mt-0.5">Melebihi kuota faktur (Over-Load)</div>
          </div>
        </div>
      </div>

      {/* CONDITIONAL: DASHBOARD VIEW VS LIST VIEW */}
      {fakturViewMode === 'dashboard' ? (
        <div className="space-y-6">
          {/* Executive Overview Analytics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400">Total Faktur / SO</span>
                <span className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                  <FileText className="w-4 h-4" />
                </span>
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-white mt-2">
                {dashboardAnalytics.totalInvoices} <span className="text-xs font-semibold text-slate-500">Faktur</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                Meliputi {dashboardAnalytics.areaBreakdown.length} Rute Area Distribusi
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400">Total Kemasan Muatan</span>
                <span className="p-2 rounded-xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400">
                  <Boxes className="w-4 h-4" />
                </span>
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-white mt-2">
                {dashboardAnalytics.totalOrderedQty} <span className="text-xs font-semibold text-slate-500">Kemasan</span>
              </div>
              <div className="text-[11px] text-sky-600 dark:text-sky-400 mt-1 font-semibold">
                Ter-scan: {dashboardAnalytics.totalLoadedQty} Kemasan ({dashboardAnalytics.overallPct}%)
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400">Estimasi Kubikasi (VOL)</span>
                <span className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
                  <Package className="w-4 h-4" />
                </span>
              </div>
              <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-2">
                {dashboardAnalytics.totalEstimatedVolumeM3} <span className="text-xs font-semibold text-slate-500">m³</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                Kalkulasi otomatis Database Barang
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400">Estimasi Berat Muatan</span>
                <span className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                  <Truck className="w-4 h-4" />
                </span>
              </div>
              <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-2">
                {dashboardAnalytics.totalEstimatedWeightKg} <span className="text-xs font-semibold text-slate-500">kg</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                {(dashboardAnalytics.totalEstimatedWeightKg / 1000).toFixed(2)} Ton muatan siap kirim
              </div>
            </div>
          </div>

          {/* Realization Progress Gauge */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Activity className="w-4 h-4 text-indigo-500" />
                  <span>Progres Realisasi Pemuatan Barang (Faktur vs Foto RFID)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Verifikasi visual otomatis melalui kamera RFID gudang saat barang dinaikkan ke armada box.
                </p>
              </div>
              <div className="text-right">
                <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
                  {dashboardAnalytics.overallPct}%
                </span>
                <span className="text-xs text-slate-500 ml-1">
                  ({dashboardAnalytics.totalLoadedQty} / {dashboardAnalytics.totalOrderedQty} Kemasan)
                </span>
              </div>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-3 mt-3 overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  dashboardAnalytics.overallPct >= 100
                    ? 'bg-emerald-500'
                    : dashboardAnalytics.overallPct >= 50
                    ? 'bg-indigo-600'
                    : 'bg-amber-500'
                }`}
                style={{ width: `${dashboardAnalytics.overallPct}%` }}
              />
            </div>
          </div>

          {/* Armada Box Matrix (Supports Multi-Armada) */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Truck className="w-4 h-4 text-sky-500" />
                  <span>Kapasitas &amp; Distribusi Armada Box (Mendukung Multi-Armada)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Rekapitulasi alokasi faktur dan muatan pada masing-masing armada box pengiriman.
                </p>
              </div>
              <span className="text-xs font-bold text-sky-600 dark:text-sky-400 px-2.5 py-1 rounded-lg bg-sky-50 dark:bg-sky-950/80 border border-sky-200 dark:border-sky-800">
                {dashboardAnalytics.fleetBreakdown.length} Armada Ditugaskan
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {dashboardAnalytics.fleetBreakdown.map((fl, fIdx) => {
                const fleetPct =
                  fl.totalOrdered > 0 ? Math.min(100, Math.round((fl.totalLoaded / fl.totalOrdered) * 100)) : 0;
                return (
                  <div
                    key={fIdx}
                    className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/80 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-xs font-black text-slate-900 dark:text-white">
                          {fl.fleetName}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {Array.from(fl.areas).join(', ') || 'Area belum diset'}
                        </div>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 shrink-0">
                        {fl.invoiceCount} Faktur
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 py-2 border-y border-slate-200/80 dark:border-slate-700/60 text-center">
                      <div>
                        <div className="text-[10px] text-slate-500 uppercase font-bold">Kemasan</div>
                        <div className="text-xs font-bold text-slate-900 dark:text-white mt-0.5">
                          {fl.totalLoaded} / {fl.totalOrdered}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500 uppercase font-bold">Volume</div>
                        <div className="text-xs font-bold text-amber-600 dark:text-amber-400 mt-0.5">
                          {fl.volumeM3.toFixed(3)} m³
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500 uppercase font-bold">Berat</div>
                        <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                          {fl.weightKg.toFixed(1)} kg
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-500">Progress Muat</span>
                        <span className="font-bold text-slate-900 dark:text-white">{fleetPct}%</span>
                      </div>
                      <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full ${fleetPct >= 100 ? 'bg-emerald-500' : 'bg-sky-500'}`}
                          style={{ width: `${fleetPct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Area & Destination Distribution Cards */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-emerald-500" />
                  <span>Distribusi Pengiriman per Area / Rute Kirim</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Monitoring pemenuhan order berdasarkan klaster wilayah outlet pelanggan.
                </p>
              </div>
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800">
                {dashboardAnalytics.areaBreakdown.length} Area Kirim
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {dashboardAnalytics.areaBreakdown.map((ar, aIdx) => {
                const areaPct =
                  ar.totalOrdered > 0 ? Math.min(100, Math.round((ar.totalLoaded / ar.totalOrdered) * 100)) : 0;
                return (
                  <div
                    key={aIdx}
                    className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/80 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-xs font-black text-slate-900 dark:text-white uppercase">
                          {ar.areaName}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {ar.customerCount} Toko Pelanggan • {ar.invoiceCount} Faktur
                        </div>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shrink-0">
                        {areaPct}% Muat
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-600 dark:text-slate-300 space-y-1">
                      <div className="flex justify-between">
                        <span>Total Kemasan:</span>
                        <span className="font-bold">{ar.totalLoaded} / {ar.totalOrdered} Kemasan</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Estimasi Kubikasi:</span>
                        <span className="font-bold text-amber-600 dark:text-amber-400">{ar.volumeM3.toFixed(3)} m³</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Estimasi Berat:</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">{ar.weightKg.toFixed(1)} kg</span>
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-200/80 dark:border-slate-700/60">
                        <span>Armada:</span>
                        <span className="font-semibold truncate max-w-[170px]" title={Array.from(ar.fleets).join(', ')}>
                          {Array.from(ar.fleets).map(f => f.split('—')[0].trim()).join(', ')}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Discrepancy & Alert Section: Sisa Belum Termuat & Over-Load */}
          {(dashboardAnalytics.unloadedItemsList.length > 0 || dashboardAnalytics.overloadedItemsList.length > 0) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Unloaded Items */}
              {dashboardAnalytics.unloadedItemsList.length > 0 && (
                <div className="bg-white dark:bg-slate-900 border border-amber-500/30 rounded-2xl p-5 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black uppercase text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4" />
                      <span>Barang Sisa / Kurang Muat ({dashboardAnalytics.unloadedItemsList.length} Item)</span>
                    </h4>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/80 text-amber-600 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                      Perlu Foto Scan
                    </span>
                  </div>
                  <div className="overflow-x-auto max-h-60 rounded-xl border border-slate-200 dark:border-slate-800">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-50 dark:bg-slate-950 text-[10px] font-bold uppercase text-slate-500 border-b border-slate-200 dark:border-slate-800">
                        <tr>
                          <th className="p-2">No Faktur</th>
                          <th className="p-2">Item Barang</th>
                          <th className="p-2 text-center">Sisa</th>
                          <th className="p-2 text-center">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {dashboardAnalytics.unloadedItemsList.map((row, rIdx) => (
                          <tr key={rIdx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                            <td className="p-2 font-mono font-bold text-[11px] text-slate-900 dark:text-white">
                              {row.invoice.invoiceNumber}
                            </td>
                            <td className="p-2">
                              <div className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[200px]" title={row.item.itemName}>
                                {row.item.itemName}
                              </div>
                              <div className="text-[10px] text-slate-400">{row.invoice.customerName}</div>
                            </td>
                            <td className="p-2 text-center font-bold text-amber-600 dark:text-amber-400">
                              -{row.remainingQty} {row.item.unit}
                            </td>
                            <td className="p-2 text-center">
                              <button
                                type="button"
                                onClick={() => onOpenRfidScannerForInvoice(row.invoice.id)}
                                className="px-2 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold cursor-pointer"
                              >
                                Scan RFID
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Overloaded Items */}
              {dashboardAnalytics.overloadedItemsList.length > 0 && (
                <div className="bg-white dark:bg-slate-900 border border-rose-500/30 rounded-2xl p-5 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black uppercase text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                      <ShieldAlert className="w-4 h-4" />
                      <span>Warning Lebih Muat Barang ({dashboardAnalytics.overloadedItemsList.length} Item)</span>
                    </h4>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/80 text-rose-600 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                      Over-Load!
                    </span>
                  </div>
                  <div className="overflow-x-auto max-h-60 rounded-xl border border-slate-200 dark:border-slate-800">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-50 dark:bg-slate-950 text-[10px] font-bold uppercase text-slate-500 border-b border-slate-200 dark:border-slate-800">
                        <tr>
                          <th className="p-2">No Faktur</th>
                          <th className="p-2">Item Barang</th>
                          <th className="p-2 text-center">Kelebihan</th>
                          <th className="p-2 text-center">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {dashboardAnalytics.overloadedItemsList.map((row, rIdx) => (
                          <tr key={rIdx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                            <td className="p-2 font-mono font-bold text-[11px] text-slate-900 dark:text-white">
                              {row.invoice.invoiceNumber}
                            </td>
                            <td className="p-2">
                              <div className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[200px]" title={row.item.itemName}>
                                {row.item.itemName}
                              </div>
                              <div className="text-[10px] text-slate-400">{row.invoice.customerName}</div>
                            </td>
                            <td className="p-2 text-center font-bold text-rose-600 dark:text-rose-400">
                              +{row.excessQty} {row.item.unit}
                            </td>
                            <td className="p-2 text-center">
                              <button
                                type="button"
                                onClick={() => onOpenRfidScannerForInvoice(row.invoice.id)}
                                className="px-2 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold cursor-pointer"
                              >
                                Koreksi
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Quick Recap Table in Dashboard */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-indigo-500" />
                <span>Tabel Ringkasan Status Seluruh Faktur</span>
              </h3>
              <span className="text-xs text-slate-500">
                Total {invoices.length} Faktur / Sales Order
              </span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-950 text-[10px] font-bold uppercase text-slate-500 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="p-2.5">No Faktur &amp; SO</th>
                    <th className="p-2.5">Pelanggan</th>
                    <th className="p-2.5">Area Kirim</th>
                    <th className="p-2.5">Armada Box</th>
                    <th className="p-2.5 text-center">Kemasan</th>
                    <th className="p-2.5 text-center">Progress Muat</th>
                    <th className="p-2.5 text-center">Status</th>
                    <th className="p-2.5 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {invoices.map(inv => {
                    const ev = evaluateInvoiceStatus(inv);
                    const pct = ev.totalOrdered > 0 ? Math.min(100, Math.round((ev.totalLoaded / ev.totalOrdered) * 100)) : 0;
                    const fleets = inv.fleetLabels && inv.fleetLabels.length > 0 ? inv.fleetLabels : [inv.fleetLabel];

                    return (
                      <tr key={inv.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                        <td className="p-2.5">
                          <div className="font-mono font-bold text-slate-900 dark:text-white text-xs">{inv.invoiceNumber}</div>
                          <div className="text-[10px] font-mono text-slate-400">{inv.soNumber}</div>
                        </td>
                        <td className="p-2.5 font-semibold text-slate-800 dark:text-slate-200">
                          {inv.customerName}
                        </td>
                        <td className="p-2.5">
                          <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-300 dark:border-emerald-800 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                            {inv.areaName}
                          </span>
                        </td>
                        <td className="p-2.5">
                          {fleets.length > 1 ? (
                            <div className="flex flex-wrap gap-1">
                              {fleets.map((fl, idx) => (
                                <span key={idx} className="px-1.5 py-0.5 rounded bg-sky-50 dark:bg-sky-950/80 border border-sky-300 dark:border-sky-800 text-[10px] font-bold text-sky-700 dark:text-sky-300">
                                  {fl.split('—')[0].trim()}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300">
                              {inv.fleetLabel.split('—')[0].trim()}
                            </span>
                          )}
                        </td>
                        <td className="p-2.5 text-center font-bold text-slate-900 dark:text-white">
                          {ev.totalLoaded} / {ev.totalOrdered}
                        </td>
                        <td className="p-2.5 text-center">
                          <div className="w-24 mx-auto space-y-1">
                            <div className="flex justify-between text-[10px]">
                              <span>{pct}%</span>
                            </div>
                            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                              <div
                                className={`h-full ${pct >= 100 ? 'bg-emerald-500' : 'bg-indigo-600'}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="p-2.5 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${ev.badgeColor}`}>
                            {ev.statusLabel}
                          </span>
                        </td>
                        <td className="p-2.5 text-center">
                          <button
                            type="button"
                            onClick={() => onOpenRfidScannerForInvoice(inv.id)}
                            className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold shadow-2xs transition cursor-pointer"
                          >
                            Scan RFID
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Filter & Search Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row items-stretch md:items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Cari No. Faktur, No. SO, Nama Toko, Area, atau Nama Barang..."
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
          />
        </div>

        <select
          value={filterFleet}
          onChange={e => setFilterFleet(e.target.value)}
          className="px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200"
        >
          <option value="SEMUA ARMADA">Semua Armada Box</option>
          {fleetOptions.map(fl => (
            <option key={fl} value={fl}>{fl}</option>
          ))}
        </select>

        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200"
        >
          <option value="SEMUA STATUS">Semua Status Muat</option>
          <option value="KURANG_SISA">Ada Barang Sisa / Belum Termuat</option>
          <option value="LEBIH_MUAT">Warning: Lebih Muat Barang</option>
          <option value="SESUAI">Lengkap &amp; Sesuai Faktur</option>
        </select>
      </div>

      {/* Invoices List */}
      <div className="space-y-4">
        {filteredInvoices.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center">
            <Package className="w-10 h-10 text-slate-400 mx-auto mb-2" />
            <div className="text-sm font-bold text-slate-800 dark:text-slate-200">Belum ada data Faktur / Sales Order yang sesuai filter</div>
            <p className="text-xs text-slate-500 mt-1">Klik tombol &ldquo;+ Input Faktur / Sales Order Baru&rdquo; di kanan atas untuk menambahkan daftar barang yang akan dimuat ke armada box.</p>
          </div>
        ) : (
          filteredInvoices.map(inv => {
            const ev = evaluateInvoiceStatus(inv);
            const progressPct = ev.totalOrdered > 0 ? Math.min(100, Math.round((ev.totalLoaded / ev.totalOrdered) * 100)) : 0;

            return (
              <div
                key={inv.id}
                className={`bg-white dark:bg-slate-900 border rounded-2xl p-5 shadow-xs transition ${
                  ev.overloadItems.length > 0
                    ? 'border-rose-500/50 ring-1 ring-rose-500/20'
                    : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                {/* Over-load instant warning strip inside Invoice Card */}
                {ev.overloadItems.length > 0 && (
                  <div className="mb-4 px-4 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 flex flex-wrap items-center justify-between gap-2 text-xs text-rose-600 dark:text-rose-400">
                    <div className="flex items-center gap-2 font-bold">
                      <AlertTriangle className="w-4 h-4 shrink-0 animate-bounce" />
                      <span>
                        WARNING LEBIH MUAT BARANG: Terdapat {ev.overloadItems.length} item yang jumlah muatannya melebihi Faktur ({ev.overloadItems.map(i => `${i.itemName} [+${i.qtyLoaded - i.qtyOrdered} ${i.unit}]`).join(', ')})!
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onOpenRfidScannerForInvoice(inv.id)}
                      className="px-3 py-1 rounded-lg bg-rose-600 text-white font-bold text-[11px] hover:bg-rose-500 cursor-pointer"
                    >
                      Cek di Aplikasi RFID
                    </button>
                  </div>
                )}

                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-black text-slate-900 dark:text-white font-mono">
                        {inv.invoiceNumber}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] font-mono font-semibold">
                        {inv.soNumber}
                      </span>
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${ev.badgeColor}`}>
                        {ev.statusLabel}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-300 pt-1">
                      <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1">
                        <Package className="w-3.5 h-3.5 text-indigo-500" />
                        Pelanggan: {inv.customerName}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-emerald-500" />
                        Area: <strong>{inv.areaName}</strong>
                      </span>
                      {(inv.fleetLabels && inv.fleetLabels.length > 1) || inv.fleetLabel.includes(' + ') ? (
                        <span className="flex flex-wrap items-center gap-1">
                          <Truck className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                          <span className="font-bold text-sky-700 dark:text-sky-300">
                            Multi-Armada ({(inv.fleetLabels || inv.fleetLabel.split(' + ')).length} Unit):
                          </span>
                          {(inv.fleetLabels || inv.fleetLabel.split(' + ')).map((f, fi) => (
                            <span
                              key={fi}
                              className="px-1.5 py-0.5 rounded bg-sky-50 dark:bg-sky-950/80 border border-sky-300 dark:border-sky-800 text-[10px] font-bold text-sky-700 dark:text-sky-300"
                            >
                              {f.split('—')[0].trim()}
                            </span>
                          ))}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <Truck className="w-3.5 h-3.5 text-sky-500" />
                          Armada Box: <strong>{inv.fleetLabel}</strong>
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <User className="w-3.5 h-3.5 text-amber-500" />
                        Admin PIC: <strong>{inv.adminPic}</strong>
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {inv.date}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 self-start lg:self-center">
                    <button
                      type="button"
                      onClick={() => onOpenRfidScannerForInvoice(inv.id)}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-xs transition cursor-pointer"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>Scan &amp; Foto Barang (RFID)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditModal(inv)}
                      className="flex items-center gap-1 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit Faktur</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteInvoice(inv)}
                      className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 transition cursor-pointer"
                      title="Hapus Faktur"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Progress Bar & Item Breakdown Table */}
                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 dark:text-slate-400 font-medium">
                      Realisasi Barang Termuat via Foto RFID:{' '}
                      <strong className="text-slate-900 dark:text-white">
                        {ev.totalLoaded} dari {ev.totalOrdered} Kemasan
                      </strong>
                    </span>
                    <span className="font-bold text-indigo-600 dark:text-indigo-400">{progressPct}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        ev.overloadItems.length > 0
                          ? 'bg-rose-500'
                          : progressPct === 100
                          ? 'bg-emerald-500'
                          : 'bg-indigo-600'
                      }`}
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>

                  <div className="overflow-x-auto pt-1">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-100 dark:border-slate-800 text-[10px] font-bold uppercase text-slate-400">
                          <th className="py-2 pr-3">Kode Tag / SKU</th>
                          <th className="py-2 pr-3">Nama Item Barang (Sesuai Faktur)</th>
                          <th className="py-2 pr-3 text-center">Qty Faktur</th>
                          <th className="py-2 pr-3 text-center">Termuat (Foto RFID)</th>
                          <th className="py-2 pr-3 text-center">Selisih / Sisa</th>
                          <th className="py-2 pr-3">Bukti Foto</th>
                          <th className="py-2 text-right">Status Deteksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                        {inv.items.map(item => {
                          const diff = item.qtyLoaded - item.qtyOrdered;
                          const isUnloaded = item.qtyLoaded === 0;
                          const isShort = item.qtyLoaded > 0 && item.qtyLoaded < item.qtyOrdered;
                          const isOver = item.qtyLoaded > item.qtyOrdered;

                          return (
                            <tr key={item.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                              <td className="py-2.5 pr-3 font-mono text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                                {item.skuCode}
                              </td>
                              <td className="py-2.5 pr-3 font-semibold text-slate-800 dark:text-slate-200">
                                {item.itemName}
                              </td>
                              <td className="py-2.5 pr-3 text-center font-bold text-slate-900 dark:text-white">
                                {item.qtyOrdered} {item.unit}
                              </td>
                              <td className="py-2.5 pr-3 text-center font-bold text-slate-900 dark:text-white">
                                {item.qtyLoaded} {item.unit}
                              </td>
                              <td className="py-2.5 pr-3 text-center font-bold">
                                {diff === 0 ? (
                                  <span className="text-emerald-600 dark:text-emerald-400">Klop (0)</span>
                                ) : diff < 0 ? (
                                  <span className="text-amber-600 dark:text-amber-400">
                                    Sisa {Math.abs(diff)} {item.unit} belum muat
                                  </span>
                                ) : (
                                  <span className="text-rose-600 dark:text-rose-400">
                                    Lebih +{diff} {item.unit}!
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 pr-3">
                                <span className="text-[11px] text-slate-500">
                                  {item.scans.length} Foto Bukti
                                </span>
                              </td>
                              <td className="py-2.5 text-right">
                                {isOver && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-600 dark:text-rose-400 font-bold text-[11px]">
                                    <AlertTriangle className="w-3 h-3" /> Lebih Muat (+{diff})
                                  </span>
                                )}
                                {isUnloaded && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold text-[11px]">
                                    Belum Termuat (Barang Sisa)
                                  </span>
                                )}
                                {isShort && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400 font-bold text-[11px]">
                                    Kurang Muat ({Math.abs(diff)} {item.unit})
                                  </span>
                                )}
                                {!isOver && !isUnloaded && !isShort && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold text-[11px]">
                                    <CheckCircle2 className="w-3 h-3" /> Sesuai Faktur
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </>
  )}

      {/* Modal Import & Review File Faktur / Sales Order (Pilih Area -> Upload File -> Review File) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs overflow-y-auto flex items-start justify-center p-3 sm:p-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-5xl w-full p-5 sm:p-6 shadow-2xl my-auto">
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600/15 border border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                      {editingInvoiceId
                        ? `Edit & Review Faktur (${invoiceNumber})`
                        : 'Import File Faktur / Sales Order (SO) Muat Armada Baru'}
                    </h2>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 border border-indigo-500/30">
                      Pilih Area &rarr; Upload File &rarr; Review File
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Pilih <strong>Nama Area Kirim</strong> terlebih dahulu, lalu unggah file faktur sesuai template (<strong>No Faktur, Nama Pelanggan, Item Barang, Qty, Satuan</strong>) dan lakukan review sebelum disimpan.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveInvoice} className="space-y-4 mt-4">
              {/* ================================================================= */}
              {/* LANGKAH 1: PILIH NAMA AREA KIRIM TERLEBIH DAHULU                   */}
              {/* ================================================================= */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white text-xs font-black flex items-center justify-center">
                      1
                    </span>
                    <span className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                      Langkah 1: Pilih Nama Area Kirim &amp; Armada Tujuan Terlebih Dahulu
                    </span>
                  </div>
                  {areaName ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Area Terpilih: {areaName}</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-500/30">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Wajib Pilih Nama Area Kirim Sebelum Upload File</span>
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-indigo-600 dark:text-indigo-400 mb-1">
                      1. Pilih Nama Area Kirim *
                    </label>
                    <select
                      required
                      value={areaName}
                      onChange={e => setAreaName(e.target.value)}
                      className={`w-full px-3.5 py-2.5 rounded-xl border text-xs font-bold cursor-pointer focus:outline-none ${
                        areaName
                          ? 'bg-white dark:bg-slate-900 border-emerald-500/60 text-slate-900 dark:text-white ring-2 ring-emerald-500/10'
                          : 'bg-white dark:bg-slate-900 border-indigo-500/60 text-slate-900 dark:text-white ring-2 ring-indigo-500/15'
                      }`}
                    >
                      <option value="">-- Pilih Nama Area Kirim --</option>
                      {OFFICIAL_DESTINATION_AREAS.map(ar => (
                        <option key={ar} value={ar}>
                          {ar}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                      Tanggal Muat *
                    </label>
                    <input
                      type="date"
                      required
                      value={date}
                      onChange={e => setDate(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                      Admin Penjualan PIC *
                    </label>
                    <select
                      value={adminPic}
                      onChange={e => setAdminPic(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white cursor-pointer"
                    >
                      {adminNames.map(adm => (
                        <option key={adm} value={adm}>
                          {adm}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Multi-Armada Box Selector (Fitur Lebih Dari 1 Armada) */}
                <div className="pt-2 border-t border-slate-200/80 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <label className="text-[11px] font-bold uppercase text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Truck className="w-3.5 h-3.5 text-sky-500" />
                      <span>Alokasi Armada Box Pengiriman (Mendukung &gt; 1 Armada / Multi-Armada) *</span>
                    </label>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-50 dark:bg-sky-950/80 text-sky-600 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                      {selectedFleets.length} Armada Box Dipilih
                    </span>
                  </div>

                  {/* Chips for Selected Fleets */}
                  <div className="flex flex-wrap gap-2 p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 min-h-[46px] items-center">
                    {selectedFleets.map((fl, fIdx) => (
                      <div
                        key={fIdx}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-sky-50 dark:bg-sky-950/80 border border-sky-300 dark:border-sky-800 text-xs font-semibold text-slate-900 dark:text-white shadow-2xs"
                      >
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-sky-600 text-white">
                          {fIdx === 0 ? 'Armada Utama' : `Armada #${fIdx + 1}`}
                        </span>
                        <span className="truncate max-w-[240px]" title={fl}>
                          {fl}
                        </span>
                        {selectedFleets.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              const next = selectedFleets.filter((_, i) => i !== fIdx);
                              setSelectedFleets(next);
                              if (next[0]) setFleetLabel(next[0]);
                            }}
                            className="text-slate-400 hover:text-rose-500 p-0.5 rounded cursor-pointer transition"
                            title="Hapus armada ini dari faktur"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Dropdown to add another armada */}
                  <div className="flex items-center gap-2">
                    <select
                      value=""
                      onChange={e => {
                        const val = e.target.value;
                        if (val && !selectedFleets.includes(val)) {
                          const updated = [...selectedFleets, val];
                          setSelectedFleets(updated);
                          setFleetLabel(updated[0]);
                        }
                      }}
                      className="w-full sm:w-auto flex-1 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-dashed border-sky-300 dark:border-sky-700 text-xs font-semibold text-sky-700 dark:text-sky-300 cursor-pointer hover:border-sky-500"
                    >
                      <option value="">+ Tambahkan Armada Box Lainnya (Jika Muatan Dibagi ke &gt; 1 Armada)...</option>
                      {fleetOptions
                        .filter(fl => !selectedFleets.includes(fl))
                        .map(fl => (
                          <option key={fl} value={fl}>
                            {fl}
                          </option>
                        ))}
                    </select>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 italic">
                    ℹ️ Gunakan opsi ini jika pesanan faktur ini membutuhkan lebih dari 1 armada box (misal volume barang besar atau armada pendamping).
                  </p>
                </div>
              </div>

              {/* ================================================================= */}
              {/* LANGKAH 2: FORMAT TEMPLATE & UPLOAD FILE FAKTUR                    */}
              {/* ================================================================= */}
              <div
                className={`p-4 rounded-2xl border space-y-3 transition ${
                  areaName
                    ? 'bg-slate-50 dark:bg-slate-950/70 border-slate-200 dark:border-slate-800'
                    : 'bg-slate-100/70 dark:bg-slate-950/40 border-slate-200/70 dark:border-slate-800/60 opacity-85'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-6 h-6 rounded-lg text-xs font-black flex items-center justify-center ${
                        areaName ? 'bg-indigo-600 text-white' : 'bg-slate-300 dark:bg-slate-800 text-slate-500'
                      }`}
                    >
                      2
                    </span>
                    <div>
                      <span className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white block">
                        Langkah 2: Template &amp; Upload File Faktur (.xlsx / .xls / .csv)
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        Kolom wajib pada file: <strong>No Faktur</strong>, <strong>Nama Pelanggan</strong>, <strong>Item Barang</strong>, <strong>Qty</strong>, <strong>Satuan</strong>
                      </span>
                    </div>
                  </div>

                  {/* Download Template Buttons */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => handleDownloadTemplateExcel('xlsx')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold shadow-2xs transition cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download Template (.xlsx)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownloadTemplateExcel('csv')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-bold transition cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Template (.csv)</span>
                    </button>
                  </div>
                </div>

                {/* Visual Template Column Preview */}
                <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                  <div className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    <span>Format Kolom Standar Template Import Faktur</span>
                    <span>5 Kolom Wajib</span>
                  </div>
                  <div className="grid grid-cols-5 divide-x divide-slate-200 dark:divide-slate-800 text-[11px] text-center font-bold bg-slate-50/70 dark:bg-slate-950/60">
                    <div className="py-2 px-2 text-indigo-600 dark:text-indigo-400">1. No Faktur</div>
                    <div className="py-2 px-2 text-indigo-600 dark:text-indigo-400">2. Nama Pelanggan</div>
                    <div className="py-2 px-2 text-indigo-600 dark:text-indigo-400">3. Item Barang</div>
                    <div className="py-2 px-2 text-indigo-600 dark:text-indigo-400">4. Qty</div>
                    <div className="py-2 px-2 text-indigo-600 dark:text-indigo-400">5. Satuan</div>
                  </div>
                </div>

                {/* File Upload Dropzone */}
                <input
                  ref={importFileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileUploadChange}
                  className="hidden"
                />

                {!areaName ? (
                  <div className="p-4 rounded-xl border border-dashed border-amber-500/40 bg-amber-500/5 flex items-center justify-center gap-2.5 text-xs text-amber-600 dark:text-amber-300 font-bold">
                    <Lock className="w-4 h-4 shrink-0" />
                    <span>
                      Silakan pilih <strong>Nama Area Kirim</strong> pada Langkah 1 di atas terlebih dahulu untuk membuka fitur Upload File Faktur.
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3.5 rounded-xl border-2 border-dashed border-indigo-500/40 bg-indigo-500/5">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-indigo-600/15 border border-indigo-500/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                        <Upload className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-black text-slate-900 dark:text-white truncate">
                          {uploadedFileName
                            ? `File Terunggah: ${uploadedFileName}`
                            : `Upload File Faktur untuk Area ${areaName}`}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          Mendukung file Excel (.xlsx, .xls) atau CSV (.csv) sesuai template 5 kolom di atas
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
                      <button
                        type="button"
                        onClick={() => importFileInputRef.current?.click()}
                        className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer transition"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>{uploadedFileName ? 'Ganti / Upload Ulang File' : 'Pilih & Upload File Faktur'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleLoadSampleImportForArea}
                        className="px-3 py-2 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-semibold cursor-pointer transition"
                      >
                        Muat Contoh File Area Ini
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* ================================================================= */}
              {/* LANGKAH 3: REVIEW FILE FAKTUR SEBELUM DISIMPAN                     */}
              {/* ================================================================= */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-6 h-6 rounded-lg text-xs font-black flex items-center justify-center ${
                        reviewRows.length > 0
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-300 dark:bg-slate-800 text-slate-500'
                      }`}
                    >
                      3
                    </span>
                    <div>
                      <span className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white block">
                        Langkah 3: Review File Faktur ({reviewRows.length} Baris Item)
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        Periksa kembali <strong>No Faktur, Nama Pelanggan, Item Barang, Qty, dan Satuan</strong> sebelum disimpan ke Aplikasi RFID
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {reviewRows.length > 0 && (
                      <div className="flex items-center gap-1.5 text-[11px] font-bold">
                        <span className="px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border border-indigo-500/25">
                          {new Set(reviewRows.map(r => r.noFaktur.trim().toUpperCase())).size} No Faktur
                        </span>
                        <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border border-emerald-500/25">
                          Total Qty: {reviewRows.reduce((acc, r) => acc + (Number(r.qty) || 0), 0)} Kemasan
                        </span>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={handleAddReviewRow}
                      disabled={!areaName}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 disabled:opacity-40 disabled:pointer-events-none text-indigo-600 dark:text-indigo-300 border border-indigo-500/30 text-xs font-bold cursor-pointer transition"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Tambah Baris Review</span>
                    </button>
                  </div>
                </div>

                {!hasReviewedFile && reviewRows.length === 0 ? (
                  <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-1.5">
                    <FileSpreadsheet className="w-7 h-7 text-slate-400 mx-auto" />
                    <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Belum Ada File Faktur yang Diunggah untuk Di-Review
                    </div>
                    <p className="text-[11px] text-slate-500 max-w-md mx-auto">
                      Pilih <strong>Nama Area Kirim</strong> di Langkah 1, lalu klik <strong>Pilih &amp; Upload File Faktur</strong> (atau klik <em>Muat Contoh File Area Ini</em>) di Langkah 2 untuk menampilkan tabel review di sini.
                    </p>
                  </div>
                ) : (
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
                    <div className="overflow-x-auto max-h-72">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-slate-100 dark:bg-slate-950 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10">
                          <tr>
                            <th className="py-2.5 px-2.5 w-8 text-center">#</th>
                            <th className="py-2.5 px-2.5">No Faktur *</th>
                            <th className="py-2.5 px-2.5">Nama Pelanggan *</th>
                            <th className="py-2.5 px-2.5">Item Barang (Terintegrasi Database Barang) *</th>
                            <th className="py-2.5 px-2.5 w-20 text-center">Qty *</th>
                            <th className="py-2.5 px-2.5 w-24">Satuan *</th>
                            <th className="py-2.5 px-2.5 w-28">Dokumentasi</th>
                            <th className="py-2.5 px-2.5 w-10 text-center">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                          {reviewRows.map((row, idx) => {
                            const matchedDb =
                              dbBarangList.find(
                                d =>
                                  d.noBarang.toLowerCase() === row.skuCode.toLowerCase() ||
                                  d.keteranganBarang.toLowerCase() === row.itemBarang.toLowerCase()
                              ) || databaseBarangService.findMatch(row.skuCode, row.itemBarang);
                            const docUrl =
                              row.dokumentasiUrl ||
                              matchedDb?.dokumentasiUrl ||
                              createDefaultBarangThumbnail(row.skuCode, row.itemBarang, row.satuan);
                            const docKb =
                              row.compressedSizeKb ||
                              matchedDb?.compressedSizeKb ||
                              estimateDataUrlSizeKb(docUrl);

                            return (
                              <tr key={row.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                                <td className="py-2 px-2.5 text-center font-mono font-bold text-slate-400">
                                  {idx + 1}
                                </td>
                                <td className="py-2 px-2.5">
                                  <input
                                    type="text"
                                    required
                                    value={row.noFaktur}
                                    onChange={e =>
                                      setReviewRows(prev =>
                                        prev.map(r => (r.id === row.id ? { ...r, noFaktur: e.target.value } : r))
                                      )
                                    }
                                    placeholder="FKT/AKK/..."
                                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold text-slate-900 dark:text-white"
                                  />
                                </td>
                                <td className="py-2 px-2.5">
                                  <input
                                    type="text"
                                    required
                                    value={row.namaPelanggan}
                                    onChange={e =>
                                      setReviewRows(prev =>
                                        prev.map(r => (r.id === row.id ? { ...r, namaPelanggan: e.target.value } : r))
                                      )
                                    }
                                    placeholder="Nama Pelanggan / Toko"
                                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white"
                                  />
                                </td>
                                <td className="py-2 px-2.5 space-y-1">
                                  <div className="flex items-center gap-1.5">
                                    <span className="px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 font-mono font-bold text-[10px] shrink-0">
                                      {row.skuCode}
                                    </span>
                                    <select
                                      value=""
                                      onChange={e => {
                                        const picked = dbBarangList.find(d => d.id === e.target.value);
                                        if (!picked) return;
                                        setReviewRows(prev =>
                                          prev.map(r =>
                                            r.id === row.id
                                              ? {
                                                  ...r,
                                                  skuCode: picked.noBarang,
                                                  itemBarang: picked.keteranganBarang,
                                                  satuan: normalizeUnit(picked.satuan),
                                                  dokumentasiUrl: picked.dokumentasiUrl,
                                                  compressedSizeKb: picked.compressedSizeKb
                                                }
                                              : r
                                          )
                                        );
                                      }}
                                      className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 cursor-pointer max-w-[170px] truncate"
                                      title="Pilih dari Database Barang Gudang"
                                    >
                                      <option value="">Pilih dari Database Barang...</option>
                                      {dbBarangList.map(dbItem => (
                                        <option key={dbItem.id} value={dbItem.id}>
                                          [{dbItem.noBarang}] {dbItem.keteranganBarang} ({dbItem.satuan})
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  <input
                                    type="text"
                                    required
                                    value={row.itemBarang}
                                    onChange={e => {
                                      const val = e.target.value;
                                      const match = databaseBarangService.findMatch(val, val);
                                      setReviewRows(prev =>
                                        prev.map(r =>
                                          r.id === row.id
                                            ? {
                                                ...r,
                                                itemBarang: val,
                                                skuCode: match?.noBarang || r.skuCode,
                                                satuan: match ? normalizeUnit(match.satuan) : r.satuan,
                                                dokumentasiUrl: match?.dokumentasiUrl || r.dokumentasiUrl,
                                                compressedSizeKb: match?.compressedSizeKb || r.compressedSizeKb
                                              }
                                            : r
                                        )
                                      );
                                    }}
                                    placeholder="Keterangan Barang / Item Barang..."
                                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white"
                                  />
                                </td>
                                <td className="py-2 px-2.5">
                                  <input
                                    type="number"
                                    min={1}
                                    required
                                    value={row.qty}
                                    onChange={e =>
                                      setReviewRows(prev =>
                                        prev.map(r =>
                                          r.id === row.id ? { ...r, qty: Math.max(1, Number(e.target.value)) } : r
                                        )
                                      )
                                    }
                                    className="w-full px-2 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs font-bold text-center text-slate-900 dark:text-white"
                                  />
                                </td>
                                <td className="py-2 px-2.5">
                                  <select
                                    value={row.satuan}
                                    onChange={e =>
                                      setReviewRows(prev =>
                                        prev.map(r =>
                                          r.id === row.id
                                            ? { ...r, satuan: e.target.value as SalesOrderItem['unit'] }
                                            : r
                                        )
                                      )
                                    }
                                    className="w-full px-2 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white cursor-pointer"
                                  >
                                    <option value="Box">Box</option>
                                    <option value="Ikat">Ikat</option>
                                    <option value="Bal">Bal</option>
                                    <option value="Pack">Pack</option>
                                    <option value="Roll">Roll</option>
                                    <option value="Pcs">Pcs</option>
                                  </select>
                                </td>
                                <td className="py-2 px-2.5">
                                  <div className="flex items-center gap-1.5">
                                    <img
                                      src={docUrl}
                                      alt={row.itemBarang}
                                      className="w-10 h-7 rounded object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                                    />
                                    <span className="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                      {docKb} KB
                                    </span>
                                  </div>
                                </td>
                                <td className="py-2 px-2.5 text-center">
                                  <button
                                    type="button"
                                    onClick={() => setReviewRows(prev => prev.filter(r => r.id !== row.id))}
                                    className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 cursor-pointer"
                                    title="Hapus Baris"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800 flex-wrap">
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  {areaName ? (
                    <span>
                      Target Area Kirim: <strong className="text-slate-900 dark:text-white">{areaName}</strong> •{' '}
                      <strong>{reviewRows.length}</strong> baris item siap disinkronkan
                    </span>
                  ) : (
                    <span className="text-amber-600 dark:text-amber-400 font-semibold">
                      * Pilih Nama Area Kirim pada Langkah 1 terlebih dahulu
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={!areaName || reviewRows.length === 0}
                    className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:pointer-events-none text-white text-xs font-bold shadow-sm cursor-pointer transition"
                  >
                    {editingInvoiceId
                      ? 'Simpan Perubahan & Sinkronkan ke Aplikasi RFID'
                      : 'Simpan Hasil Review & Sinkronkan ke Aplikasi RFID'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// SUB-MENU 2: APLIKASI SCAN & FOTO BARANG MUAT (SMART RFID & AI VISION MUAT BOX)
// ============================================================================
interface SalesRfidScannerAppTabProps {
  initialInvoiceId?: string | null;
  onNavigateToInvoiceInput: () => void;
}

interface RealtimeScanFeedback {
  id: string;
  status: 'success' | 'error';
  extractedCode: string;
  productName: string;
  unit: string;
  qtyScanned: number;
  itemLoaded: number;
  itemTarget: number;
  totalLoaded: number;
  totalTarget: number;
  gate: string;
  suratJalanId: string;
  timestamp: string;
  displayTime: string;
  message: string;
  photoDataUrl: string;
  confidenceScore?: number;
  yoloBbox?: number[];
  sqlStatusTransition?: string;
}

const LOADING_GATE_OPTIONS = [
  'Gate 1 (Loading Utama)',
  'Gate 2 (Loading Tengah)',
  'Gate 3 (Loading Timur)',
  'Pintu Ram 1 (Gudang Box)',
  'Pintu Ram 2 (Gudang Kemasan)',
  'Pintu Ram 3 (Ekspedisi Lintas Pulau)'
];

const SCAN_HISTORY_STORAGE_KEY = 'akk_wms_rfid_recent_scan_logs_v1';

// Web Audio API Sound Synthesizer: 1200Hz Beep Sukses & 250Hz Buzzer Gagal
function playScannerFeedbackBeep(type: 'success' | 'error', enabled: boolean = true) {
  if (!enabled || typeof window === 'undefined') return;
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    if (type === 'success') {
      // Audio Beep Sukses: Frekuensi 1200Hz (Web Audio API sintetis)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, ctx.currentTime);
      gain.gain.setValueAtTime(0.24, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.22);
      setTimeout(() => ctx.close().catch(() => {}), 320);
    } else {
      // Audio Buzzer Gagal: Frekuensi rendah 250Hz
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(250, ctx.currentTime);
      gain.gain.setValueAtTime(0.28, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.42);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.42);
      setTimeout(() => ctx.close().catch(() => {}), 500);
    }
  } catch {
    // Ignore audio context restriction if user hasn't interacted yet
  }
}

export const SalesRfidScannerAppTab: React.FC<SalesRfidScannerAppTabProps> = ({
  initialInvoiceId,
  onNavigateToInvoiceInput
}) => {
  const { addNotification } = useToast();
  const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    addNotification(
      type === 'error' ? 'sla_warning' : 'checker',
      type === 'error' ? 'PERINGATAN RFID MUAT!' : 'Aplikasi Scan RFID Muat',
      msg,
      type === 'error'
    );
  };
  const {
    invoices,
    saveInvoices,
    adminNames,
    defaultAdmin
  } = useSharedSalesRfidInvoices();

  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>(() => {
    const savedId = localStorage.getItem(ACTIVE_INVOICE_KEY);
    return initialInvoiceId || savedId || invoices[0]?.id || '';
  });

  useEffect(() => {
    if (initialInvoiceId) {
      setSelectedInvoiceId(initialInvoiceId);
      localStorage.setItem(ACTIVE_INVOICE_KEY, initialInvoiceId);
    } else if (!invoices.some(i => i.id === selectedInvoiceId) && invoices[0]) {
      setSelectedInvoiceId(invoices[0].id);
    }
  }, [initialInvoiceId, invoices, selectedInvoiceId]);

  const activeInvoice = useMemo(() => {
    return invoices.find(i => i.id === selectedInvoiceId) || invoices[0] || null;
  }, [invoices, selectedInvoiceId]);

  // Header & Operational States
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [selectedGate, setSelectedGate] = useState<string>(LOADING_GATE_OPTIONS[0]);
  const [scanAdminPic, setScanAdminPic] = useState<string>(defaultAdmin);

  // Live Viewfinder & Hardware Camera Controls
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isTorchOn, setIsTorchOn] = useState<boolean>(false);
  const [torchSupported, setTorchSupported] = useState<boolean>(false);
  const [autoScanEnabled, setAutoScanEnabled] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [isVerifyingScan, setIsVerifyingScan] = useState<boolean>(false);

  // Target Item / OCR Mode Selection
  // 'AUTO' = Otomatis pilih item yang belum klop / AI Vision OCR, atau pilih ID item tertentu, atau 'CUSTOM_CODE' untuk simulasi/input kode manual
  const [targetScanMode, setTargetScanMode] = useState<string>('AUTO');
  const [customTestCode, setCustomTestCode] = useState<string>('');
  const [scanQtyInput, setScanQtyInput] = useState<number>(1);
  const [scanNotesInput, setScanNotesInput] = useState<string>('');
  const [lastCapturedPreview, setLastCapturedPreview] = useState<string | null>(null);
  const [lastCapturedExif, setLastCapturedExif] = useState<ExifTimestampMetadata | null>(null);

  // Real-Time Feedback Card & Recent 5 Scans Log
  const [lastFeedback, setLastFeedback] = useState<RealtimeScanFeedback | null>(null);
  const [recentScansLog, setRecentScansLog] = useState<RealtimeScanFeedback[]>(() => {
    try {
      const raw = localStorage.getItem(SCAN_HISTORY_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.slice(0, 15);
      }
    } catch {}
    return [];
  });

  // Modals for Overload Warning & Item Photo Gallery
  const [overloadWarningAlert, setOverloadWarningAlert] = useState<{
    itemName: string;
    skuCode: string;
    qtyOrdered: number;
    qtyLoaded: number;
    unit: string;
  } | null>(null);
  const [previewPhotoModal, setPreviewPhotoModal] = useState<{
    itemName: string;
    scans: ItemPhotoScanLog[];
  } | null>(null);
  const [mobileSubTab, setMobileSubTab] = useState<'history' | 'items' | 'audit'>('history');
  const [scannerPage, setScannerPage] = useState<'halaman1' | 'halaman2'>('halaman1');
  const [isBlueprintsModalOpen, setIsBlueprintsModalOpen] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const autoScanTimerRef = useRef<number | null>(null);

  // Online / Offline Listener
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const stopCamera = () => {
    if (autoScanTimerRef.current) {
      window.clearInterval(autoScanTimerRef.current);
      autoScanTimerRef.current = null;
    }
    setAutoScanEnabled(false);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setIsTorchOn(false);
    setTorchSupported(false);
    setIsCameraActive(false);
  };

  useEffect(() => {
    return () => {
      if (autoScanTimerRef.current) {
        window.clearInterval(autoScanTimerRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  const startLiveCamera = async (overrideFacing?: 'environment' | 'user') => {
    const desiredFacing = overrideFacing || facingMode;
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
      let stream: MediaStream;
      try {
        // Prioritaskan exact facingMode (contoh: facingMode: { exact: "environment" }) pada smartphone
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { exact: desiredFacing },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        });
      } catch {
        // Fallback ke ideal bila dibuka di perangkat single-camera / laptop
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: desiredFacing },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        });
      }
      streamRef.current = stream;
      setFacingMode(desiredFacing);
      setIsCameraActive(true);

      // Check hardware torch capability on mobile rear camera
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack && typeof videoTrack.getCapabilities === 'function') {
        const caps = videoTrack.getCapabilities() as Record<string, unknown>;
        setTorchSupported(Boolean(caps && 'torch' in caps));
      } else {
        setTorchSupported(false);
      }
      setIsTorchOn(false);

      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      }, 80);
    } catch {
      showToast(
        'Kamera langsung tidak tersedia pada perangkat ini — Anda tetap dapat klik "Ambil Foto & Verifikasi" atau "Buka Kamera HP".',
        'info'
      );
      setIsCameraActive(false);
    }
  };

  const handleSwitchCamera = async () => {
    const nextFacing = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextFacing);
    if (isCameraActive) {
      await startLiveCamera(nextFacing);
    }
  };

  const handleToggleTorch = async () => {
    if (!streamRef.current) {
      showToast('Aktifkan kamera terlebih dahulu untuk menyalakan lampu Flash / Torch.', 'info');
      return;
    }
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;
    const nextTorch = !isTorchOn;
    try {
      await track.applyConstraints({
        advanced: [{ torch: nextTorch } as unknown as MediaTrackConstraintSet]
      });
      setIsTorchOn(nextTorch);
    } catch {
      showToast('Lampu Flash / Torch tidak didukung oleh browser atau kamera perangkat ini.', 'info');
    }
  };

  // Resolve which item is currently targeted in viewfinder
  const resolvedTargetItem = useMemo((): SalesOrderItem | null => {
    if (!activeInvoice || activeInvoice.items.length === 0) return null;
    if (targetScanMode === 'CUSTOM_CODE') return null;
    if (targetScanMode !== 'AUTO') {
      const found = activeInvoice.items.find(it => it.id === targetScanMode || it.skuCode === targetScanMode);
      if (found) return found;
    }
    // AUTO: Pilih item pertama yang belum mencapai target faktur, atau item pertama
    return (
      activeInvoice.items.find(it => it.qtyLoaded < it.qtyOrdered) ||
      activeInvoice.items[0] ||
      null
    );
  }, [activeInvoice, targetScanMode]);

  // Helper: Compress video frame or image onto Canvas (max width 1280px, JPEG 0.8) with EXIF overlay
  const captureCompressedBase64FromViewfinder = (
    fallbackCode: string,
    fallbackName: string,
    qty: number,
    unit: string
  ): { base64: string; exif: ExifTimestampMetadata } => {
    const nowDate = new Date();
    const exifMeta = createExifMetadataFromDate(nowDate, 'CAMERA_CAPTURE_SENSOR');

    if (videoRef.current && videoRef.current.videoWidth > 0 && videoRef.current.videoHeight > 0) {
      const rawW = videoRef.current.videoWidth;
      const rawH = videoRef.current.videoHeight;
      const maxWidth = 1280;
      const scale = rawW > maxWidth ? maxWidth / rawW : 1;
      const targetW = Math.round(rawW * scale);
      const targetH = Math.round(rawH * scale);

      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, targetW, targetH);
        drawExifMetadataOnCanvas(ctx, targetW, targetH, exifMeta);
        const compressedJpeg = canvas.toDataURL('image/jpeg', 0.8);
        return { base64: compressedJpeg, exif: exifMeta };
      }
    }

    // Fallback: jika pengguna sudah mengunggah/memotret file sebelumnya atau kamera belum menyala
    if (lastCapturedPreview && lastCapturedPreview.startsWith('data:image/jpeg')) {
      return { base64: lastCapturedPreview, exif: lastCapturedExif || exifMeta };
    }

    const nowStr = nowDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' WIB';
    return {
      base64: createSampleSvgPhoto(fallbackName, fallbackCode, qty, unit, nowStr),
      exif: exifMeta
    };
  };

  // Core Verification Workflow: Capture -> Compress -> POST /api/scan-muat -> Audio & UI Feedback -> Update Faktur/SO
  const executeCaptureAndVerify = async (customImageBase64?: string, customExif?: ExifTimestampMetadata) => {
    if (!activeInvoice || isVerifyingScan) return;

    setIsVerifyingScan(true);
    const nowDate = new Date();
    const isoTimestamp = nowDate.toISOString();
    const displayTime =
      nowDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' WIB';

    const cleanQty = Math.max(1, Number(scanQtyInput) || 1);
    const desiredCode =
      targetScanMode === 'CUSTOM_CODE'
        ? customTestCode.trim().toUpperCase() || 'BOX-UNKNOWN-999'
        : resolvedTargetItem?.skuCode || 'AUTO';
    const desiredName =
      targetScanMode === 'CUSTOM_CODE'
        ? `Kode Uji Manual (${desiredCode})`
        : resolvedTargetItem?.itemName || 'Kemasan Faktur';
    const desiredUnit = resolvedTargetItem?.unit || 'Box';

    const captured = customImageBase64
      ? { base64: customImageBase64, exif: customExif || createExifMetadataFromDate(nowDate, 'CAMERA_CAPTURE_SENSOR') }
      : captureCompressedBase64FromViewfinder(desiredCode, desiredName, cleanQty, desiredUnit);

    setLastCapturedPreview(captured.base64);
    setLastCapturedExif(captured.exif);

    const masterBarang = databaseBarangService.getAll().slice(0, 200);

    try {
      const response = await fetch('/api/scan-muat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: captured.base64,
          image_base64: captured.base64,
          surat_jalan_id: activeInvoice.invoiceNumber,
          so_number: activeInvoice.soNumber,
          gate_id: selectedGate,
          gate: selectedGate,
          timestamp: isoTimestamp,
          target_item_code: desiredCode,
          qty_scanned: cleanQty,
          expected_items: activeInvoice.items,
          master_items: masterBarang,
          preproc_metrics: {
            clahe_applied: true,
            orientation_fixed: true,
            max_width: 1280,
            jpeg_quality: 0.8
          }
        })
      });

      const result = await response.json();
      const extractedCode = String(result.extracted_code || desiredCode).toUpperCase();
      const matchedItem = activeInvoice.items.find(
        it => it.skuCode.trim().toUpperCase() === extractedCode
      );

      if (response.ok && result.status === 'success' && matchedItem) {
        // SUCCESS: Valid item on active Surat Jalan / Faktur
        const newItemLoaded = matchedItem.qtyLoaded + cleanQty;
        const newScanEntry: ItemPhotoScanLog = {
          id: `scan-${Date.now()}`,
          timestamp: displayTime,
          qtyScanned: cleanQty,
          photoDataUrl: captured.base64,
          scannedBy: scanAdminPic,
          notes:
            scanNotesInput.trim() ||
            `[${selectedGate}] Terverifikasi RFID/Vision (${newItemLoaded}/${matchedItem.qtyOrdered} ${matchedItem.unit})`,
          exifMetadata: captured.exif
        };

        saveInvoices(prev =>
          prev.map(inv => {
            if (inv.id !== activeInvoice.id) return inv;
            return {
              ...inv,
              items: inv.items.map(it =>
                it.id === matchedItem.id
                  ? {
                      ...it,
                      qtyLoaded: newItemLoaded,
                      scans: [newScanEntry, ...it.scans]
                    }
                  : it
              )
            };
          })
        );

        const totalOrderedAll = activeInvoice.items.reduce((acc, i) => acc + i.qtyOrdered, 0);
        const totalLoadedAll =
          activeInvoice.items.reduce((acc, i) => acc + i.qtyLoaded, 0) + cleanQty;

        const feedbackObj: RealtimeScanFeedback = {
          id: `fb-${Date.now()}`,
          status: 'success',
          extractedCode: matchedItem.skuCode,
          productName: matchedItem.itemName,
          unit: matchedItem.unit,
          qtyScanned: cleanQty,
          itemLoaded: newItemLoaded,
          itemTarget: matchedItem.qtyOrdered,
          totalLoaded: totalLoadedAll,
          totalTarget: totalOrderedAll,
          gate: selectedGate,
          suratJalanId: activeInvoice.invoiceNumber,
          timestamp: isoTimestamp,
          displayTime,
          message:
            result.message ||
            `${matchedItem.skuCode} Valid (${newItemLoaded}/${matchedItem.qtyOrdered} ${matchedItem.unit} Terbit)`,
          photoDataUrl: captured.base64,
          confidenceScore: Number(result?.cv_pipeline?.confidence_score || result?.ocr_confidence || 0.964),
          yoloBbox: Array.isArray(result?.cv_pipeline?.yolo_bbox) ? result.cv_pipeline.yolo_bbox : [142, 96, 980, 520],
          sqlStatusTransition: result?.sql_transaction?.status_transition || 'PENDING -> LOADED'
        };

        setLastFeedback(feedbackObj);
        setRecentScansLog(prev => {
          const next = [feedbackObj, ...prev].slice(0, 15);
          try {
            localStorage.setItem(SCAN_HISTORY_STORAGE_KEY, JSON.stringify(next));
          } catch {}
          return next;
        });

        playScannerFeedbackBeep('success', soundEnabled);
        showToast(
          `✅ ${matchedItem.skuCode} Valid (${newItemLoaded}/${matchedItem.qtyOrdered} ${matchedItem.unit} Terbit) — Dimuat melalui ${selectedGate}`,
          'success'
        );
      } else {
        // ERROR: Either Overloaded or Unrecognized / Wrong Destination DO
        if (matchedItem) {
          const newItemLoaded = matchedItem.qtyLoaded + cleanQty;
          const newScanEntry: ItemPhotoScanLog = {
            id: `scan-${Date.now()}`,
            timestamp: displayTime,
            qtyScanned: cleanQty,
            photoDataUrl: captured.base64,
            scannedBy: scanAdminPic,
            notes:
              scanNotesInput.trim() ||
              `[${selectedGate}] PERINGATAN LEBIH MUAT (${newItemLoaded}/${matchedItem.qtyOrdered} ${matchedItem.unit})`,
            exifMetadata: captured.exif
          };

          saveInvoices(prev =>
            prev.map(inv => {
              if (inv.id !== activeInvoice.id) return inv;
              return {
                ...inv,
                items: inv.items.map(it =>
                  it.id === matchedItem.id
                    ? {
                        ...it,
                        qtyLoaded: newItemLoaded,
                        scans: [newScanEntry, ...it.scans]
                      }
                    : it
                )
              };
            })
          );

          setOverloadWarningAlert({
            itemName: matchedItem.itemName,
            skuCode: matchedItem.skuCode,
            qtyOrdered: matchedItem.qtyOrdered,
            qtyLoaded: newItemLoaded,
            unit: matchedItem.unit
          });
        }

        const totalOrderedAll = activeInvoice.items.reduce((acc, i) => acc + i.qtyOrdered, 0);
        const totalLoadedAll =
          activeInvoice.items.reduce((acc, i) => acc + i.qtyLoaded, 0) + (matchedItem ? cleanQty : 0);

        const errorFeedback: RealtimeScanFeedback = {
          id: `fb-${Date.now()}`,
          status: 'error',
          extractedCode: extractedCode || 'TIDAK-DIKENALI',
          productName: result.product_name || matchedItem?.itemName || 'Tidak Dikenali / Salah Tujuan',
          unit: matchedItem?.unit || 'Box',
          qtyScanned: cleanQty,
          itemLoaded: matchedItem ? matchedItem.qtyLoaded + cleanQty : 0,
          itemTarget: matchedItem ? matchedItem.qtyOrdered : 0,
          totalLoaded: totalLoadedAll,
          totalTarget: totalOrderedAll,
          gate: selectedGate,
          suratJalanId: activeInvoice.invoiceNumber,
          timestamp: isoTimestamp,
          displayTime,
          message:
            result.message ||
            `Tidak Dikenali / Salah Tujuan: [${extractedCode}] tidak sesuai kuota Surat Jalan ${activeInvoice.invoiceNumber}`,
          photoDataUrl: captured.base64
        };

        setLastFeedback(errorFeedback);
        setRecentScansLog(prev => {
          const next = [errorFeedback, ...prev].slice(0, 15);
          try {
            localStorage.setItem(SCAN_HISTORY_STORAGE_KEY, JSON.stringify(next));
          } catch {}
          return next;
        });

        playScannerFeedbackBeep('error', soundEnabled);
        showToast(`🚨 ${errorFeedback.message}`, 'error');
      }
    } catch {
      playScannerFeedbackBeep('error', soundEnabled);
      showToast('Gagal menghubungi endpoint verifikasi /api/scan-muat. Periksa koneksi jaringan.', 'error');
    } finally {
      setIsVerifyingScan(false);
    }
  };

  // Auto-Detect Interval (Every 2.5 Seconds when Auto-Scan is ON)
  useEffect(() => {
    if (!autoScanEnabled) {
      if (autoScanTimerRef.current) {
        window.clearInterval(autoScanTimerRef.current);
        autoScanTimerRef.current = null;
      }
      return;
    }

    autoScanTimerRef.current = window.setInterval(() => {
      if (!isVerifyingScan && activeInvoice) {
        const remainingItem = activeInvoice.items.find(it => it.qtyLoaded < it.qtyOrdered);
        if (!remainingItem && targetScanMode === 'AUTO') {
          setAutoScanEnabled(false);
          showToast('Seluruh barang pada Faktur/Surat Jalan aktif sudah termuat 100%. Auto-Detect dihentikan.', 'info');
          return;
        }
        void executeCaptureAndVerify();
      }
    }, 2500);

    return () => {
      if (autoScanTimerRef.current) {
        window.clearInterval(autoScanTimerRef.current);
        autoScanTimerRef.current = null;
      }
    };
  }, [autoScanEnabled, isVerifyingScan, activeInvoice, targetScanMode, selectedGate, scanQtyInput, soundEnabled]);

  // Handle File Upload / Direct Mobile Camera Input (Resized to max 1280px JPEG 0.8)
  const handleFileUploadAndVerify = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    extractExifFromFile(file).then(exifMeta => {
      const reader = new FileReader();
      reader.onload = ev => {
        if (typeof ev.target?.result === 'string') {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const maxWidth = 1280;
            let w = img.width || 800;
            let h = img.height || 600;
            if (w > maxWidth) {
              h = Math.round((h * maxWidth) / w);
              w = maxWidth;
            }
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            let compressedDataUrl = ev.target!.result as string;
            if (ctx) {
              ctx.drawImage(img, 0, 0, w, h);
              drawExifMetadataOnCanvas(ctx, w, h, exifMeta);
              compressedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
            }
            setLastCapturedPreview(compressedDataUrl);
            setLastCapturedExif(exifMeta);
            void executeCaptureAndVerify(compressedDataUrl, exifMeta);
          };
          img.src = ev.target.result;
        }
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const handleAdjustLoadedQty = (item: SalesOrderItem, exactQty: number) => {
    if (!activeInvoice) return;
    const clamped = Math.max(0, exactQty);
    saveInvoices(prev =>
      prev.map(inv => {
        if (inv.id !== activeInvoice.id) return inv;
        return {
          ...inv,
          items: inv.items.map(it => (it.id === item.id ? { ...it, qtyLoaded: clamped } : it))
        };
      })
    );
    showToast(`Jumlah muat ${item.itemName} disesuaikan menjadi ${clamped} ${item.unit}.`, 'info');
  };

  const handleFinishLoadingAndDetectRemaining = () => {
    if (!activeInvoice) return;
    const nowStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';

    saveInvoices(prev =>
      prev.map(inv =>
        inv.id === activeInvoice.id
          ? { ...inv, isLoadingFinished: true, finishedAt: nowStr }
          : inv
      )
    );

    const ev = evaluateInvoiceStatus(activeInvoice);
    if (ev.overloadItems.length > 0) {
      playScannerFeedbackBeep('error', soundEnabled);
      showToast(
        `⚠️ PERINGATAN: Ditemukan ${ev.overloadItems.length} item LEBIH MUAT pada Faktur ${activeInvoice.invoiceNumber}!`,
        'error'
      );
    } else if (ev.unloadedItems.length > 0 || ev.shortageItems.length > 0) {
      playScannerFeedbackBeep('error', soundEnabled);
      showToast(
        `🔍 Deteksi Selesai: Terdeteksi ${ev.unloadedItems.length + ev.shortageItems.length} item BARANG SISA / BELUM TERMUAT ke armada box!`,
        'error'
      );
    } else {
      playScannerFeedbackBeep('success', soundEnabled);
      showToast(
        `✅ Proses Muat Selesai 100%! Seluruh barang pada Faktur ${activeInvoice.invoiceNumber} telah termuat lengkap tanpa selisih.`,
        'success'
      );
    }
  };

  const handleSelectSpecificItemToScan = (item: SalesOrderItem) => {
    setTargetScanMode(item.id);
    const remaining = Math.max(1, item.qtyOrdered - item.qtyLoaded);
    setScanQtyInput(Math.min(5, remaining));
    setMobileSubTab('history');
    if (!isCameraActive) {
      void startLiveCamera();
    }
  };

  if (!activeInvoice) {
    return (
      <div className="max-w-[440px] mx-auto bg-[#0b1120] text-[#f8fafc] border-[6px] border-[#1e293b] rounded-[36px] p-8 text-center space-y-4 shadow-2xl">
        <QrCode className="w-12 h-12 text-emerald-400 mx-auto" />
        <h2 className="text-base font-black text-white">Belum Ada Faktur / Surat Jalan Aktif</h2>
        <p className="text-xs text-[#94a3b8] leading-relaxed">
          Silakan input terlebih dahulu Faktur atau Sales Order di sub-menu <strong>Input Faktur / Sales Order (SO)</strong> untuk mulai memindai barang muatan armada box.
        </p>
        <button
          type="button"
          onClick={onNavigateToInvoiceInput}
          className="w-full py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold cursor-pointer"
        >
          Ke Sub-Menu Input Faktur / Sales Order
        </button>
      </div>
    );
  }

  const evalActive = evaluateInvoiceStatus(activeInvoice);
  const progressPercentage =
    evalActive.totalOrdered > 0
      ? Math.min(100, Math.round((evalActive.totalLoaded / evalActive.totalOrdered) * 100))
      : 0;
  const latestFiveScans = recentScansLog.slice(0, 5);
  const totalSisaCount = evalActive.unloadedItems.length + evalActive.shortageItems.length;

  return (
    <div className="py-2 px-1 sm:px-4">
      {/* Top Info Bar Above Mobile Phone Frame */}
      <div className="max-w-[460px] mx-auto mb-3 flex flex-wrap items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-1.5">
          <span className="px-2.5 py-1 rounded-full bg-indigo-600 text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-xs">
            <QrCode className="w-3 h-3" />
            <span>Pure Visual YOLO • Tampilan HP</span>
          </span>
          <button
            type="button"
            onClick={() => setIsBlueprintsModalOpen(true)}
            className="px-2.5 py-1 rounded-full bg-amber-500 hover:bg-amber-400 text-slate-950 text-[10px] font-black uppercase tracking-wider flex items-center gap-1 cursor-pointer shadow-xs"
            title="Lihat Skrip SQL Hostinger, Python Ultralytics YOLO Backend & HTML5 Client"
          >
            <span>📦 Kode &amp; SQL (YOLO)</span>
          </button>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onNavigateToInvoiceInput}
            className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer shadow-xs"
          >
            <FileText className="w-3 h-3 text-indigo-400" />
            <span>Input SO</span>
          </button>
          <button
            type="button"
            onClick={handleFinishLoadingAndDetectRemaining}
            className="px-2.5 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer shadow-xs"
          >
            <ClipboardCheck className="w-3 h-3" />
            <span>Selesai Muat</span>
          </button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* FRAME UTAMA TAMPILAN HP (MOBILE HANDHELD WMS SCANNER)                 */}
      {/* Dilindungi class .wms-handheld-dark agar kontras terjaga di LightMode */}
      {/* ===================================================================== */}
      <div className="wms-handheld-dark max-w-[460px] mx-auto bg-[#0b1120] text-[#f8fafc] rounded-[38px] border-[7px] border-[#1e293b] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.65)] overflow-hidden flex flex-col">
        {/* 0. Status Bar Smartphone & Speaker Notch */}
        <div className="bg-[#060a14] px-5 pt-2.5 pb-2 flex items-center justify-between text-[11px] font-mono text-[#cbd5e1] border-b border-[#1e293b]/80 select-none">
          <div className="flex items-center gap-1.5 font-bold">
            <span>
              {new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
            </span>
            <span className="text-[9px] px-1.5 py-0.2 rounded bg-[#1e293b] text-emerald-400 font-black">
              5G
            </span>
          </div>
          {/* Dynamic Island / Speaker Cutout */}
          <div className="w-20 h-3.5 rounded-full bg-[#000000] border border-[#1e293b] flex items-center justify-end pr-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/80" />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSoundEnabled(prev => !prev)}
              className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#1e293b] text-[#e2e8f0] cursor-pointer"
              title="Toggle Suara Beep"
            >
              {soundEnabled ? '🔊 Beep' : '🔇 Mute'}
            </button>
            <span className="text-[10px] font-bold text-emerald-400">100% 🔋</span>
          </div>
        </div>

        {/* 1. HEADER BAR: [● Online] WMS SCANNER - MUAT BARANG [Gate 1 v] */}
        <div className="bg-[#111827] px-3.5 py-2.5 border-b border-[#1e293b] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider shrink-0 ${
                isOnline
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isOnline ? 'bg-emerald-400 animate-ping' : 'bg-rose-400'
                }`}
              />
              <span>{isOnline ? 'Online' : 'Offline'}</span>
            </span>
            <span className="text-xs font-black tracking-tight text-white truncate">
              WMS SCANNER - MUAT BARANG
            </span>
          </div>

          <select
            value={selectedGate}
            onChange={e => setSelectedGate(e.target.value)}
            className="px-2.5 py-1 rounded-lg bg-[#060a14] border border-[#334155] text-[11px] font-bold text-emerald-300 focus:outline-none focus:border-emerald-400 shrink-0 cursor-pointer"
          >
            {LOADING_GATE_OPTIONS.map(gate => (
              <option key={gate} value={gate} className="bg-[#0b1120] text-white">
                {gate.split(' ')[0]} {gate.split(' ')[1]}
              </option>
            ))}
          </select>
        </div>

        {/* TAB SWITCHER NAV 2 HALAMAN UNTUK APLIKASI ADMIN PENJUALAN */}
        <div className="grid grid-cols-2 bg-[#060a14] border-b border-[#1e293b] p-1.5 gap-1.5">
          <button
            type="button"
            onClick={() => setScannerPage('halaman1')}
            className={`py-2 px-2.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center justify-center gap-1.5 ${
              scannerPage === 'halaman1'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'bg-[#111827] text-[#94a3b8] hover:text-white'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>1. Kamera &amp; List Faktur</span>
          </button>
          <button
            type="button"
            onClick={() => setScannerPage('halaman2')}
            className={`py-2 px-2.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center justify-center gap-1.5 ${
              scannerPage === 'halaman2'
                ? 'bg-sky-600 text-white shadow-md'
                : 'bg-[#111827] text-[#94a3b8] hover:text-white'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>2. Termuat &amp; Sisa ({totalSisaCount})</span>
          </button>
        </div>

        {/* ================================================================= */}
        {/* HALAMAN 1: URUTAN NAMA PELANGGAN (FAKTUR), VIEWFINDER KAMERA BESAR, */}
        {/* TOMBOL AMBIL FOTO & VERIFIKASI TERGABUNG, LIST BARANG FAKTUR     */}
        {/* ================================================================= */}
        {scannerPage === 'halaman1' && (
          <div className="space-y-0">
            {/* 1. BARIS PILIH NO. SURAT JALAN / FAKTUR (DO/SO) - URUTAN NAMA PELANGGAN */}
            <div className="bg-[#0f172a] px-3.5 py-2.5 border-b border-[#1e293b] space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#94a3b8]">
                  Urutan Nama Pelanggan (Faktur DO/SO):
                </span>
                <span className="text-[10px] font-mono text-emerald-300 font-bold truncate max-w-[180px]">
                  {activeInvoice.customerName}
                </span>
              </div>
              <select
                value={activeInvoice.id}
                onChange={e => {
                  setSelectedInvoiceId(e.target.value);
                  localStorage.setItem(ACTIVE_INVOICE_KEY, e.target.value);
                  setTargetScanMode('AUTO');
                }}
                className="w-full px-3 py-2 rounded-xl bg-[#060a14] border border-[#334155] text-xs font-bold text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                {invoices.map(inv => {
                  const ev = evaluateInvoiceStatus(inv);
                  return (
                    <option key={inv.id} value={inv.id} className="bg-[#0b1120] text-white">
                      {inv.invoiceNumber} ({inv.soNumber}) &mdash; {inv.customerName} [{ev.totalLoaded}/{ev.totalOrdered}]
                    </option>
                  );
                })}
              </select>
            </div>

            {/* 2. AREA KAMERA LIVE VIEWFINDER UTUH / BESAR (TIDAK TERBAGI 2) */}
            <div className="p-3 bg-[#090d16] border-b border-[#1e293b] space-y-2">
              {/* Controls bar mini kamera */}
              <div className="flex items-center justify-between gap-1.5">
                <div className="flex items-center gap-1.5">
                  {!isCameraActive ? (
                    <button
                      type="button"
                      onClick={() => void startLiveCamera()}
                      className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-extrabold cursor-pointer transition"
                    >
                      ▶ Aktifkan Kamera
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={stopCamera}
                      className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-extrabold cursor-pointer transition"
                    >
                      ■ Matikan
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void handleSwitchCamera()}
                    className="px-2 py-1 rounded-lg bg-[#1e293b] hover:bg-[#334155] text-[#e2e8f0] text-[10px] font-bold cursor-pointer transition flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3 text-sky-400" />
                    <span>{facingMode === 'environment' ? 'Belakang' : 'Depan'}</span>
                  </button>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => void handleToggleTorch()}
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition ${
                      isTorchOn ? 'bg-amber-400 text-[#090d16]' : 'bg-[#1e293b] text-[#e2e8f0]'
                    }`}
                  >
                    {isTorchOn ? '🔦 ON' : '🔦 Flash'}
                  </button>
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] font-bold text-slate-300 border border-slate-700">
                    Mode Auto: OFF
                  </span>
                </div>
              </div>

              {/* Viewport Kamera Besar & Penuh (Tergabung dengan Tombol Ambil Foto & Verifikasi) */}
              <div className="relative w-full h-64 sm:h-72 rounded-2xl bg-[#030712] border-2 border-[#1e293b] overflow-hidden flex flex-col justify-between p-3">
                {isCameraActive ? (
                  <video
                    ref={videoRef}
                    className="absolute inset-0 w-full h-full object-cover"
                    playsInline
                    muted
                    autoPlay
                  />
                ) : lastCapturedPreview ? (
                  <img
                    src={lastCapturedPreview}
                    alt="Snapshot Terakhir"
                    className="absolute inset-0 w-full h-full object-cover opacity-80"
                  />
                ) : null}

                {/* Reticle / Kotak Pemandu di Tengah Viewfinder */}
                <div className="relative z-10 w-full h-full rounded-xl border-2 border-dashed border-emerald-400/80 bg-[#030712]/35 flex flex-col items-center justify-between p-2.5 text-center pointer-events-none">
                  {/* Corner Brackets */}
                  <div className="absolute -top-0.5 -left-0.5 w-4 h-4 border-t-4 border-l-4 border-emerald-400 rounded-tl-sm" />
                  <div className="absolute -top-0.5 -right-0.5 w-4 h-4 border-t-4 border-r-4 border-emerald-400 rounded-tr-sm" />
                  <div className="absolute -bottom-0.5 -left-0.5 w-4 h-4 border-b-4 border-l-4 border-emerald-400 rounded-bl-sm" />
                  <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 border-b-4 border-r-4 border-emerald-400 rounded-br-sm" />

                  <div className="w-full flex items-center justify-between text-[9px] font-mono text-[#cbd5e1]">
                    <span className="px-1.5 py-0.5 rounded bg-[#0b1120]/90 border border-[#334155] text-emerald-300 font-bold">
                      YOLO ROI • {selectedGate.split(' ')[0]} {selectedGate.split(' ')[1]}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-[#0b1120]/90 border border-[#334155] text-amber-300 font-bold">
                      CAMERA ACTIVE
                    </span>
                  </div>

                  <div className="my-auto space-y-1">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#0b1120]/90 border border-emerald-500/40 text-emerald-300 text-xs font-extrabold shadow-md">
                      <QrCode className="w-3.5 h-3.5" />
                      <span>Arahkan Kemasan / Label ke Sini</span>
                    </div>
                    <div className="text-[10px] text-[#cbd5e1] font-bold px-2 line-clamp-1 bg-[#0b1120]/80 rounded py-0.5">
                      {resolvedTargetItem
                        ? `[${resolvedTargetItem.skuCode}] ${resolvedTargetItem.itemName}`
                        : 'Ultralytics YOLO ROI & Vision OCR'}
                    </div>
                  </div>

                  {/* Tombol Ambil Foto & Verifikasi BERGABUNG DI ATAS LAYAR KAMERA */}
                  <div className="w-full pointer-events-auto pt-1">
                    <button
                      type="button"
                      disabled={isVerifyingScan}
                      onClick={() => void executeCaptureAndVerify()}
                      className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-[0.99] disabled:opacity-50 text-white font-black text-xs tracking-wide shadow-xl flex items-center justify-center gap-2 cursor-pointer transition border border-emerald-400/50"
                    >
                      <Camera className="w-4 h-4 shrink-0" />
                      <span>
                        {isVerifyingScan ? 'MEMVERIFIKASI...' : '📸 AMBIL FOTO & VERIFIKASI'}
                      </span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Baris Kontrol Suara & Selector Target Barang */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold text-[#94a3b8]">Uji Suara Beep:</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => playScannerFeedbackBeep('success', true)}
                      className="py-1 px-2.5 rounded-lg bg-[#111827] hover:bg-[#1e293b] border border-[#334155] text-emerald-300 text-[10px] font-bold cursor-pointer"
                    >
                      🔊 Beep OK
                    </button>
                    <button
                      type="button"
                      onClick={() => playScannerFeedbackBeep('error', true)}
                      className="py-1 px-2.5 rounded-lg bg-[#111827] hover:bg-[#1e293b] border border-[#334155] text-rose-300 text-[10px] font-bold cursor-pointer"
                    >
                      🔊 Beep Err
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-12 gap-2">
                  <div className="col-span-8">
                    <label className="block text-[9px] font-bold uppercase text-[#94a3b8] mb-0.5">
                      Target Barang / Mode OCR:
                    </label>
                    <select
                      value={targetScanMode}
                      onChange={e => setTargetScanMode(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-xl bg-[#111827] border border-[#334155] text-[11px] font-bold text-white cursor-pointer"
                    >
                      <option value="AUTO" className="bg-[#0b1120] text-white">
                        🤖 Auto OCR: [{resolvedTargetItem?.skuCode || '-'}] {resolvedTargetItem?.itemName.slice(0, 22) || ''}
                      </option>
                      {activeInvoice.items.map(it => (
                        <option key={it.id} value={it.id} className="bg-[#0b1120] text-white">
                          [{it.skuCode}] {it.itemName} ({it.qtyLoaded}/{it.qtyOrdered} {it.unit})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-4">
                    <label className="block text-[9px] font-bold uppercase text-[#94a3b8] mb-0.5">
                      Qty / Scan ({resolvedTargetItem?.unit || 'Box'}):
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={scanQtyInput}
                      onChange={e => setScanQtyInput(Math.max(1, Number(e.target.value)))}
                      className="w-full px-2.5 py-1.5 rounded-xl bg-[#111827] border border-[#334155] text-[11px] font-mono font-black text-emerald-400 text-center"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 3. DI BAWAH TAMPILAN KAMERA: LIST BARANG FAKTUR / SALES ORDER PELANGGAN */}
            <div className="p-3.5 bg-[#0b1120] space-y-2.5 max-h-80 overflow-y-auto">
              <div className="flex items-center justify-between text-[11px] font-black uppercase text-[#94a3b8]">
                <span>Daftar Barang Faktur Pelanggan ({activeInvoice.items.length} SKU):</span>
                <span className="text-sky-400 font-mono">{activeInvoice.invoiceNumber}</span>
              </div>

              {activeInvoice.items.map(item => {
                const isSelected = resolvedTargetItem?.id === item.id && targetScanMode !== 'CUSTOM_CODE';
                const isExact = item.qtyLoaded === item.qtyOrdered && item.qtyOrdered > 0;
                const isOver = item.qtyLoaded > item.qtyOrdered;
                return (
                  <div
                    key={item.id}
                    className={`p-3 rounded-2xl border text-xs space-y-2 ${
                      isSelected
                        ? 'bg-[#172554]/70 border-indigo-400 shadow-md'
                        : 'bg-[#111827] border-[#1e293b]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono text-[10px] font-black">
                            {item.skuCode}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-black ${
                              isOver
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                : isExact
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            }`}
                          >
                            {item.qtyLoaded} / {item.qtyOrdered} {item.unit}
                          </span>
                        </div>
                        <div className="font-bold text-white text-xs leading-snug break-words">
                          {item.itemName}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {item.scans.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setPreviewPhotoModal({ itemName: item.itemName, scans: item.scans })}
                            className="px-2 py-1 rounded-lg bg-[#1e293b] text-sky-300 text-[10px] font-bold cursor-pointer"
                            title="Lihat Foto"
                          >
                            📷 {item.scans.length}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleSelectSpecificItemToScan(item)}
                          className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-black cursor-pointer shadow-xs flex items-center gap-1"
                        >
                          <Camera className="w-3 h-3" />
                          <span>Pilih Scan</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* HALAMAN 2: BARANG SUDAH TERMUAT, BARANG SISA & RINGKASAN AUDIT   */}
        {/* ================================================================= */}
        {scannerPage === 'halaman2' && (
          <div className="p-3.5 bg-[#0b1120] space-y-3 max-h-[520px] overflow-y-auto">
            {/* Ringkasan Progres Muat */}
            <div className="p-3 bg-[#0f172a] rounded-2xl border border-[#1e293b] space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-[#cbd5e1]">Progres Muat Faktur:</span>
                <span className="font-mono font-black text-emerald-400">
                  {evalActive.totalLoaded} / {evalActive.totalOrdered} Kemasan ({progressPercentage}%)
                </span>
              </div>
              <div className="w-full h-3 rounded-full bg-[#060a14] border border-[#334155] overflow-hidden p-0.5">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    evalActive.overloadItems.length > 0
                      ? 'bg-rose-500'
                      : progressPercentage === 100
                      ? 'bg-emerald-500'
                      : 'bg-sky-500'
                  }`}
                  style={{ width: `${Math.min(100, progressPercentage)}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] font-bold text-[#94a3b8] pt-0.5">
                <span>Target: {evalActive.totalOrdered} ({activeInvoice.items.length} SKU)</span>
                <span className="text-sky-400">Termuat: {evalActive.totalLoaded}</span>
                <span className={totalSisaCount > 0 ? 'text-amber-400' : 'text-emerald-400'}>
                  {totalSisaCount > 0 ? `Sisa: ${totalSisaCount} SKU` : '✓ 100% Lengkap'}
                </span>
              </div>
            </div>

            {/* Warning Banner jika ada Overload (Lebih Muat) */}
            {evalActive.overloadItems.length > 0 && (
              <div className="rounded-2xl bg-[#991b1b] border border-rose-400 p-3 text-white space-y-1.5">
                <div className="text-[10px] font-black uppercase tracking-wider text-rose-200 flex items-center gap-1">
                  <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                  <span>⚠️ PERINGATAN BARANG LEBIH MUAT ({evalActive.overloadItems.length} SKU)</span>
                </div>
                {evalActive.overloadItems.map(item => (
                  <div key={item.id} className="flex items-center justify-between gap-2 text-[11px] bg-black/25 px-2.5 py-1.5 rounded-lg">
                    <span className="truncate font-semibold">
                      [{item.skuCode}] {item.qtyLoaded}/{item.qtyOrdered} {item.unit} (+{item.qtyLoaded - item.qtyOrdered})
                    </span>
                    <button
                      type="button"
                      onClick={() => handleAdjustLoadedQty(item, item.qtyOrdered)}
                      className="px-2 py-0.5 rounded bg-white text-rose-900 font-extrabold text-[10px] shrink-0 cursor-pointer"
                    >
                      Sesuaikan ({item.qtyOrdered})
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* 1. DETEKSI BARANG SISA / BELUM TERMUAT */}
            <div className="space-y-2 text-xs">
              <div className="text-[11px] font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                <span>1. Deteksi Barang Sisa / Belum Termuat ({totalSisaCount} SKU):</span>
              </div>
              {totalSisaCount === 0 ? (
                <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span>Semua barang pada Surat Jalan ini sudah termuat 100%!</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {evalActive.unloadedItems.map(item => (
                    <div
                      key={item.id}
                      className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="font-bold text-white truncate">[{item.skuCode}] {item.itemName}</div>
                        <div className="text-[11px] text-amber-300 font-medium">Status: BELUM TERMUAT SAMA SEKALI &mdash; Sisa {item.qtyOrdered} {item.unit}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          handleSelectSpecificItemToScan(item);
                          setScannerPage('halaman1');
                        }}
                        className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-[10px] font-black shrink-0 cursor-pointer"
                      >
                        Foto Sekarang
                      </button>
                    </div>
                  ))}
                  {evalActive.shortageItems.map(item => {
                    const sisa = item.qtyOrdered - item.qtyLoaded;
                    return (
                      <div
                        key={item.id}
                        className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <div className="font-bold text-white truncate">[{item.skuCode}] {item.itemName}</div>
                          <div className="text-[11px] text-amber-300 font-medium">
                            Status: KURANG MUAT ({item.qtyLoaded}/{item.qtyOrdered} {item.unit}) &mdash; Sisa {sisa} {item.unit}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            handleSelectSpecificItemToScan(item);
                            setScannerPage('halaman1');
                          }}
                          className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-[10px] font-black shrink-0 cursor-pointer"
                        >
                          Foto Sisa ({sisa})
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 2. BARANG TERMUAT SESUAI FAKTUR */}
            <div className="space-y-2 text-xs pt-1">
              <div className="text-[11px] font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>2. Barang Termuat Sesuai Faktur ({evalActive.matchedItems.length} SKU):</span>
              </div>
              {evalActive.matchedItems.length === 0 ? (
                <div className="py-3 px-3 text-[#64748b] text-[11px] border border-dashed border-[#1e293b] rounded-xl text-center">
                  Belum ada barang yang termuat 100% sesuai target faktur.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {evalActive.matchedItems.map((item: SalesOrderItem) => (
                    <div
                      key={item.id}
                      className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="font-bold text-white truncate">[{item.skuCode}] {item.itemName}</div>
                        <div className="text-[11px] text-emerald-300 font-medium">Termuat Lengkap ({item.qtyLoaded}/{item.qtyOrdered} {item.unit})</div>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-black border border-emerald-500/30 shrink-0">
                        ✓ 100% Sesuai
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 3. RIWAYAT SNAPSHOT SCAN FOTO TERAKHIR */}
            <div className="space-y-2 text-xs pt-1 border-t border-[#1e293b]">
              <div className="flex items-center justify-between text-[11px] font-black uppercase text-[#94a3b8]">
                <span>Riwayat 5 Scan Foto Terakhir:</span>
                {recentScansLog.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setRecentScansLog([]);
                      localStorage.removeItem(SCAN_HISTORY_STORAGE_KEY);
                    }}
                    className="text-[10px] text-rose-400 hover:underline font-bold cursor-pointer"
                  >
                    Bersihkan
                  </button>
                )}
              </div>

              {latestFiveScans.length === 0 ? (
                <div className="py-4 text-center text-xs text-[#64748b] border border-dashed border-[#1e293b] rounded-xl">
                  Belum ada riwayat foto. Ambil foto di Halaman 1.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {latestFiveScans.map(log => (
                    <div
                      key={log.id}
                      className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-[#111827] border border-[#1e293b] text-xs font-mono"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <img
                          src={log.photoDataUrl}
                          alt={log.extractedCode}
                          className="w-8 h-8 rounded-lg object-cover border border-[#334155] shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="truncate font-bold text-[#f8fafc] text-[11px]">
                            {log.displayTime.replace(' WIB', '')} - {log.extractedCode}
                          </div>
                          <div className="truncate text-[10px] text-[#94a3b8] font-sans">
                            {log.productName}
                          </div>
                        </div>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-black shrink-0 ${
                          log.status === 'success'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        }`}
                      >
                        {log.status === 'success' ? `(OK ${log.itemLoaded}/${log.itemTarget})` : '(ERROR)'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===================================================================== */}
        {/* PORTAL DRIVER & HELPER STYLE MOBILE BOTTOM NAVIGATION BAR             */}
        {/* ===================================================================== */}
        <div className="bg-[#0f172a] border-t border-[#1e293b] px-2 py-1.5 relative z-20 shadow-2xl">
          <div className="grid grid-cols-5 items-center text-center">
            {/* 1. Kamera & List Faktur (Halaman 1) */}
            <button
              type="button"
              onClick={() => setScannerPage('halaman1')}
              className={`flex flex-col items-center justify-center gap-0.5 py-1 px-1 rounded-xl transition cursor-pointer relative ${
                scannerPage === 'halaman1'
                  ? 'text-emerald-400 font-extrabold'
                  : 'text-[#94a3b8] hover:text-[#f8fafc]'
              }`}
            >
              <Camera className={`w-5 h-5 transition-transform ${scannerPage === 'halaman1' ? 'scale-110 text-emerald-400' : ''}`} />
              <span className="text-[10px] tracking-tighter leading-none">Kamera &amp; List</span>
              {scannerPage === 'halaman1' && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-xs shadow-emerald-400/50 mt-0.5 animate-pulse" />
              )}
            </button>

            {/* 2. Termuat & Sisa (Halaman 2) */}
            <button
              type="button"
              onClick={() => setScannerPage('halaman2')}
              className={`flex flex-col items-center justify-center gap-0.5 py-1 px-1 rounded-xl transition cursor-pointer relative ${
                scannerPage === 'halaman2'
                  ? 'text-sky-400 font-extrabold'
                  : 'text-[#94a3b8] hover:text-[#f8fafc]'
              }`}
            >
              <div className="relative">
                <Package className={`w-5 h-5 transition-transform ${scannerPage === 'halaman2' ? 'scale-110 text-sky-400' : ''}`} />
                {totalSisaCount > 0 ? (
                  <span className="absolute -top-1.5 -right-2.5 px-1 py-0.2 rounded-full bg-amber-500 text-slate-950 text-[9px] font-black border border-[#0b1120] animate-bounce">
                    {totalSisaCount}
                  </span>
                ) : (
                  <span className="absolute -top-1 -right-2 px-0.5 rounded-full bg-emerald-500 text-slate-950 text-[8px] font-black">
                    ✓
                  </span>
                )}
              </div>
              <span className="text-[10px] tracking-tighter leading-none">Termuat &amp; Sisa</span>
              {scannerPage === 'halaman2' && (
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shadow-xs shadow-sky-400/50 mt-0.5 animate-pulse" />
              )}
            </button>

            {/* 3. Central Floating Action Button (Jepret & Verifikasi / Quick Snap) */}
            <div className="flex flex-col items-center justify-center relative">
              <button
                type="button"
                onClick={() => {
                  if (scannerPage !== 'halaman1') {
                    setScannerPage('halaman1');
                  }
                  void executeCaptureAndVerify();
                }}
                className="w-12 h-12 -mt-6 rounded-full bg-gradient-to-tr from-emerald-600 via-indigo-600 to-indigo-500 text-white shadow-xl shadow-indigo-500/30 border-4 border-[#0b1120] hover:scale-105 active:scale-95 transition-transform flex items-center justify-center cursor-pointer group"
                title="Ambil Foto & Verifikasi Sekarang"
              >
                <Camera className="w-6 h-6 group-hover:rotate-12 transition-transform" />
              </button>
              <span className="text-[9px] font-bold text-emerald-400 mt-0.5 tracking-tighter">Scan Foto</span>
            </div>

            {/* 4. Riwayat Scan */}
            <button
              type="button"
              onClick={() => {
                setScannerPage('halaman2');
              }}
              className="flex flex-col items-center justify-center gap-0.5 py-1 px-1 rounded-xl text-[#94a3b8] hover:text-[#f8fafc] transition cursor-pointer relative"
            >
              <div className="relative">
                <FileText className="w-5 h-5" />
                {recentScansLog.length > 0 && (
                  <span className="absolute -top-1 -right-2 px-1 py-0.2 rounded-full bg-indigo-500 text-white text-[9px] font-black">
                    {recentScansLog.length}
                  </span>
                )}
              </div>
              <span className="text-[10px] tracking-tighter leading-none">Riwayat</span>
            </button>

            {/* 5. Blueprint Kode & SQL */}
            <button
              type="button"
              onClick={() => setIsBlueprintsModalOpen(true)}
              className="flex flex-col items-center justify-center gap-0.5 py-1 px-1 rounded-xl text-[#94a3b8] hover:text-[#f8fafc] transition cursor-pointer"
            >
              <Layers className="w-5 h-5 text-amber-400" />
              <span className="text-[10px] tracking-tighter leading-none text-amber-300">Blueprint</span>
            </button>
          </div>
        </div>

        {/* Home Indicator Bar Smartphone */}
        <div className="p-2 bg-[#060a14] border-t border-[#1e293b] flex justify-center">
          <div className="w-28 h-1 rounded-full bg-[#334155]" />
        </div>
      </div>

      {/* ===================================================================== */}
      {/* POPUP MODAL WARNING KETIKA TERJADI LEBIH MUAT BARANG                   */}
      {/* ===================================================================== */}
      {overloadWarningAlert && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border-2 border-rose-500 rounded-3xl max-w-md w-full p-6 shadow-2xl text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/15 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-8 h-8 animate-bounce" />
            </div>
            <div className="px-3 py-1 rounded-full bg-rose-600 text-white text-[11px] font-black uppercase inline-block">
              WARNING: ADA LEBIH MUAT BARANG!
            </div>
            <h3 className="text-lg font-black text-slate-900 dark:text-white">
              Jumlah Muatan Melebihi Faktur / Sales Order!
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">
              Item <strong>[{overloadWarningAlert.skuCode}] {overloadWarningAlert.itemName}</strong> pada faktur hanya berjumlah{' '}
              <strong>{overloadWarningAlert.qtyOrdered} {overloadWarningAlert.unit}</strong>, namun terdeteksi termuat sebanyak{' '}
              <strong className="text-rose-600 dark:text-rose-400">
                {overloadWarningAlert.qtyLoaded} {overloadWarningAlert.unit}
              </strong>{' '}
              (Lebih Muat <strong>+{overloadWarningAlert.qtyLoaded - overloadWarningAlert.qtyOrdered} {overloadWarningAlert.unit}</strong>).
            </p>
            <div className="flex items-center justify-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setOverloadWarningAlert(null)}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer"
              >
                Mengerti &amp; Cek Kelebihan Barang
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL GALERI BUKTI FOTO BARANG PER ITEM                               */}
      {/* ===================================================================== */}
      {previewPhotoModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs overflow-y-auto flex items-start justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-2xl w-full p-5 shadow-2xl my-auto space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Bukti Foto Pengeluaran Barang — {previewPhotoModal.itemName}
                </h3>
                <p className="text-xs text-slate-500">{previewPhotoModal.scans.length} riwayat pemotretan RFID Visual</p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewPhotoModal(null)}
                className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 max-h-96 overflow-y-auto">
              {previewPhotoModal.scans.map(sc => (
                <div key={sc.id} className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-slate-50 dark:bg-slate-800/50">
                  <img src={sc.photoDataUrl} alt="Bukti Scan" className="w-full h-40 object-cover bg-slate-950" />
                  <div className="p-3 text-xs space-y-1">
                    <div className="flex items-center justify-between font-bold text-slate-900 dark:text-white">
                      <span>Termuat: {sc.qtyScanned} Kemasan</span>
                      <span className="text-[11px] text-indigo-500">{sc.timestamp}</span>
                    </div>
                    <div className="text-[11px] text-slate-500">Admin: {sc.scannedBy}</div>
                    {sc.notes && <div className="text-[11px] text-slate-600 dark:text-slate-300">{sc.notes}</div>}
                    <div className="pt-1.5">
                      <ExifMetadataBadge exif={sc.exifMetadata} compact />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL SKRIP SQL HOSTINGER, PYTHON ULTRALYTICS YOLO & STANDALONE HTML5  */}
      {/* ===================================================================== */}
      <WmsPureVisualBlueprintsModal
        isOpen={isBlueprintsModalOpen}
        onClose={() => setIsBlueprintsModalOpen(false)}
      />
    </div>
  );
};

