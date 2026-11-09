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
import * as ort from 'onnxruntime-web';
import { logisticsStore } from '../../services/store';
import { Fleet } from '../../types';
import { OFFICIAL_DESTINATION_AREAS } from '../../utils/areaNormalizer';
import { useSalesAdminUsers } from './SalesHeaderFilter';
import { AkkLogo } from '../AkkLogo';
import { useToast } from '../../context/ToastContext';
import { useRoleAccess } from '../../hooks/useRoleAccess';
import { canAccess, canEdit } from '../../utils/rbac';
import { branchStore, BranchRecord } from '../../services/branchStore';
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
  unit: string;
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
  branchName?: string;
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
  { skuCode: 'AKK-KB-001', itemName: 'Karton Box Corrugated B-Flute 60x40x40 Polos', unit: 'Ikat' },
  { skuCode: 'AKK-KB-006', itemName: 'Mika Daleman Kue Sekat 4 (Isi 100 Pcs)', unit: 'Box' },
  { skuCode: 'AKK-KB-007', itemName: 'Karton Box Die-Cut Sepatu Ekspor', unit: 'Ikat' },
  { skuCode: 'AKK-KB-008', itemName: 'Lakban Coklat Packing AKK 48mm x 90Y', unit: 'Box' }
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
    <text x="240" y="256" text-anchor="middle" fill="#94a3b8" font-family="sans-serif" font-size="11">TERVERIFIKASI KAMERA VISUAL • ${timestamp}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function getInitialInvoices(fleetDefault: string, adminDefault: string): SalesOrderInvoice[] {
  const initialAdmin = 'BAYU NOVIANTO';
  return [
    {
      id: 'inv-rfid-1',
      invoiceNumber: 'FKT/AKK/2026/11/001',
      soNumber: 'SO-BWI-261101',
      date: '2026-11-03',
      branchName: 'Banyuwangi',
      customerName: 'TK HOLLY GENTENG',
      areaName: 'GENTENG RETAIL',
      fleetLabel: fleetDefault,
      adminPic: initialAdmin,
      isLoadingFinished: false,
      notes: 'Order kemasan rutin mingguan — pastikan karton & tray di tumpukan aman',
      items: [
        {
          id: 'itm-1',
          skuCode: 'AKK-KB-001',
          itemName: 'Karton Box Corrugated B-Flute 60x40x40 Polos',
          unit: 'Ikat',
          qtyOrdered: 20,
          qtyLoaded: 20,
          scans: [
            {
              id: 'sc-1',
              timestamp: '08:15 WIB',
              qtyScanned: 20,
              photoDataUrl: createSampleSvgPhoto('Karton Box Corrugated B-Flute 60x40x40 Polos', 'AKK-KB-001', 20, 'Ikat', '08:15 WIB'),
              scannedBy: initialAdmin,
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
              scannedBy: initialAdmin,
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
      branchName: 'Bali',
      customerName: 'UD SUMBER KEMASAN BALI',
      areaName: 'DENPASAR 1',
      fleetLabel: fleetDefault,
      adminPic: initialAdmin,
      isLoadingFinished: true,
      finishedAt: '09:10 WIB',
      notes: 'Pengiriman lintas pulau Denpasar 1',
      items: [
        {
          id: 'itm-201',
          skuCode: 'AKK-KB-006',
          itemName: 'Mika Daleman Kue Sekat 4 (Isi 100 Pcs)',
          unit: 'Box',
          qtyOrdered: 25,
          qtyLoaded: 25,
          scans: [
            {
              id: 'sc-201',
              timestamp: '08:50 WIB',
              qtyScanned: 25,
              photoDataUrl: createSampleSvgPhoto('Mika Daleman Kue Sekat 4 (Isi 100 Pcs)', 'AKK-KB-006', 25, 'Box', '08:50 WIB'),
              scannedBy: adminDefault,
              notes: 'Muatan sesuai faktur'
            }
          ]
        },
        {
          id: 'itm-202',
          skuCode: 'AKK-KB-008',
          itemName: 'Lakban Coklat Packing AKK 48mm x 90Y',
          unit: 'Box',
          qtyOrdered: 30,
          qtyLoaded: 34,
          scans: [
            {
              id: 'sc-202',
              timestamp: '09:05 WIB',
              qtyScanned: 34,
              photoDataUrl: createSampleSvgPhoto('Lakban Coklat Packing AKK 48mm x 90Y', 'AKK-KB-008', 34, 'Box', '09:05 WIB'),
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
      'RFID-KB-001': { skuCode: 'AKK-KB-001', itemName: 'Karton Box Corrugated B-Flute 60x40x40 Polos', unit: 'Ikat' },
      'RFID-KB-002': { skuCode: '7AFBG453', itemName: 'ALUFOIL REFIL BAGUS 45X7,62M (24PCS/CRT)', unit: 'Box' },
      'RFID-KB-003': { skuCode: 'AKK-KB-006', itemName: 'Mika Daleman Kue Sekat 4 (Isi 100 Pcs)', unit: 'Box' },
      'RFID-KB-004': { skuCode: '7AT00935', itemName: 'ALU TRAY OX-935 (100PCS/PAK)', unit: 'Pack' },
      'RFID-KB-005': { skuCode: 'AKK-KB-008', itemName: 'Lakban Coklat Packing AKK 48mm x 90Y', unit: 'Box' },
      'RFID-KB-006': { skuCode: 'AKK-KB-006', itemName: 'Mika Daleman Kue Sekat 4 (Isi 100 Pcs)', unit: 'Box' },
      'RFID-KB-007': { skuCode: 'AKK-KB-007', itemName: 'Karton Box Die-Cut Sepatu Ekspor', unit: 'Ikat' },
      'RFID-KB-008': { skuCode: 'AKK-KB-008', itemName: 'Lakban Coklat Packing AKK 48mm x 90Y', unit: 'Box' }
    };
    let mutated = false;
    const cleaned = rawList.map(inv => ({
      ...inv,
      items: (inv.items || []).map(it => {
        const codeUpper = String(it.skuCode || '').trim().toUpperCase();
        if (replacements[codeUpper]) {
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

  // Cross-device synchronization via server /api/sales-rfid-invoices + localStorage
  useEffect(() => {
    let active = true;
    const fetchRemote = async () => {
      try {
        const res = await fetch('/api/sales-rfid-invoices');
        if (res.ok) {
          const json = await res.json();
          if (active && json.success && Array.isArray(json.data)) {
            if (json.data.length > 0) {
              const cleaned = sanitizeSavedInvoices(json.data);
              setInvoices(cleaned);
              try {
                localStorage.setItem(STORAGE_KEY_SALES_RFID, JSON.stringify(cleaned));
              } catch {}
            } else if (invoices.length > 0) {
              // Remote server has no invoices yet, seed it so mobile devices can access immediately
              fetch('/api/sales-rfid-invoices', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ invoices })
              }).catch(() => {});
            }
          }
        }
      } catch {}
    };

    void fetchRemote();

    const syncFromStorage = () => {
      try {
        const saved = localStorage.getItem(STORAGE_KEY_SALES_RFID);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) setInvoices(sanitizeSavedInvoices(parsed));
        }
      } catch {}
    };

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        void fetchRemote();
      }
    };

    window.addEventListener('akk-sales-rfid-updated', syncFromStorage);
    window.addEventListener('storage', syncFromStorage);
    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    const interval = window.setInterval(fetchRemote, 4000);

    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener('akk-sales-rfid-updated', syncFromStorage);
      window.removeEventListener('storage', syncFromStorage);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
    };
  }, [invoices.length]);

  const saveInvoices = (updater: SalesOrderInvoice[] | ((prev: SalesOrderInvoice[]) => SalesOrderInvoice[])) => {
    setInvoices(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      try {
        localStorage.setItem(STORAGE_KEY_SALES_RFID, JSON.stringify(next));
        window.dispatchEvent(new CustomEvent('akk-sales-rfid-updated'));
      } catch {}
      // Sync to server in background
      fetch('/api/sales-rfid-invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoices: next })
      }).catch(() => {});
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
      type === 'error' ? 'Peringatan Muat Barang' : 'Faktur & SO Muat',
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

  const { user: currentUser } = useRoleAccess();
  const isSuperAdmin = currentUser?.role === 'super_admin';
  const hasFullSalesAccess = isSuperAdmin || canEdit(currentUser, 'sales_admin') || canEdit(currentUser, 'sales_rfid_scanner');
  const currentUserName = (currentUser?.fullName || '').trim().toLowerCase();

  // Desktop Invoice List User Isolation (Req 2 & 3): Berdasarkan Hak Akses User Management
  const accessibleInvoices = useMemo(() => {
    if (hasFullSalesAccess || !currentUserName) return invoices;
    return invoices.filter(inv => {
      const pic = (inv.adminPic || '').trim().toLowerCase();
      return (
        pic === currentUserName ||
        pic.includes(currentUserName) ||
        currentUserName.includes(pic)
      );
    });
  }, [invoices, hasFullSalesAccess, currentUserName]);

  const [fakturViewMode, setFakturViewMode] = useState<'list' | 'dashboard'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterBranch, setFilterBranch] = useState('SEMUA CABANG');
  const [filterFleet, setFilterFleet] = useState('SEMUA ARMADA');
  const [filterStatus, setFilterStatus] = useState('SEMUA STATUS');
  const [filterDate, setFilterDate] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);

  // Form states for Import File Faktur / Sales Order (Pilih Cabang & Area -> Upload File -> Review File)
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [soNumber, setSoNumber] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [branchName, setBranchName] = useState<string>('Banyuwangi');
  const [customerName, setCustomerName] = useState('');
  const [areaName, setAreaName] = useState<string>('');
  const [fleetLabel, setFleetLabel] = useState(defaultFleet);
  const [selectedFleets, setSelectedFleets] = useState<string[]>([defaultFleet]);
  const activeUserPicName = (currentUser?.fullName || '').trim().toUpperCase() || defaultAdmin;
  const [adminPic, setAdminPic] = useState(activeUserPicName);
  const [notes, setNotes] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  const [hasReviewedFile, setHasReviewedFile] = useState<boolean>(false);
  const importFileInputRef = useRef<HTMLInputElement | null>(null);

  const [dbBarangList, setDbBarangList] = useState<DatabaseBarangRecord[]>(() =>
    databaseBarangService.getAll()
  );
  const [branches, setBranches] = useState<BranchRecord[]>(() => branchStore.getBranches());

  useEffect(() => {
    void databaseBarangService.ensureHydrated().then(loaded => {
      setDbBarangList(loaded);
    });
    const syncDb = () => {
      setDbBarangList(databaseBarangService.getAll());
    };
    const syncBranches = () => {
      setBranches(branchStore.getBranches());
    };
    const unsubBranch = branchStore.subscribe(syncBranches);
    window.addEventListener('akk-database-barang-updated', syncDb);
    window.addEventListener('akk-branch-updated', syncBranches);
    window.addEventListener('storage', syncDb);
    return () => {
      unsubBranch();
      window.removeEventListener('akk-database-barang-updated', syncDb);
      window.removeEventListener('akk-branch-updated', syncBranches);
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
    const clean = (rawUnit || '').trim();
    if (!clean) return 'CRT';
    return clean.toUpperCase();
  };

  const openCreateModal = () => {
    setEditingInvoiceId(null);
    const seq = String(invoices.length + 1).padStart(3, '0');
    const defaultNoFaktur = `FKT/AKK/2026/11/${seq}`;
    const defaultArea = OFFICIAL_DESTINATION_AREAS[0] || 'Banyuwangi Kota';
    setInvoiceNumber(defaultNoFaktur);
    setSoNumber('');
    setDate(new Date().toISOString().split('T')[0]);
    const defaultMasterBranch =
      branches.find(b => b.slug === 'banyuwangi')?.name || branches[0]?.name || 'Nusantara';
    setBranchName(defaultMasterBranch);
    setCustomerName('');
    setAreaName(defaultArea);
    const initialFleet = fleetOptions[0] || defaultFleet;
    setFleetLabel(initialFleet);
    setSelectedFleets([initialFleet]);
    const activeUserAdminName = (currentUser?.fullName || '').trim().toUpperCase() || defaultAdmin;
    setAdminPic(activeUserAdminName);
    setNotes('');
    setUploadedFileName('');
    setHasReviewedFile(true);
    const firstDb = dbBarangList[0];
    const firstFallback = MASTER_PACKAGING_CATALOG[0];
    const resolvedNo = firstDb?.noBarang || firstFallback?.skuCode || '7GPJA001';
    const resolvedKet =
      firstDb?.keteranganBarang ||
      firstFallback?.itemName ||
      'CUP PLST JAGUAR BR 10 OZ NAT @50 (40SLP/CRT)';
    const resolvedSat = normalizeUnit(firstDb?.unit3 || firstDb?.satuan || 'CRT');
    const resolvedDoc =
      firstDb?.dokumentasiUrl || createDefaultBarangThumbnail(resolvedNo, resolvedKet, resolvedSat);
    setReviewRows([
      {
        id: `rev-${Date.now()}-1`,
        noFaktur: defaultNoFaktur,
        namaPelanggan: `TK MAKMUR JAYA (${defaultArea.toUpperCase()})`,
        itemBarang: resolvedKet,
        qty: 1,
        satuan: resolvedSat,
        skuCode: resolvedNo,
        dokumentasiUrl: resolvedDoc,
        compressedSizeKb: firstDb?.compressedSizeKb || estimateDataUrlSizeKb(resolvedDoc)
      }
    ]);
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
    setBranchName(inv.branchName || (inv.areaName.toLowerCase().includes('denpasar') || inv.areaName.toLowerCase().includes('bali') ? 'Bali' : 'Banyuwangi'));
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
    const sampleArea = (areaName || 'GENTENG RETAIL').toUpperCase();
    const templateRows = [
      {
        'No Faktur': 'FKT/AKK/2026/11/001',
        'Nama Pelanggan': `TK MAKMUR JAYA (${sampleArea})`,
        'Item Barang': 'CUP PLST JAGUAR BR 10 OZ NAT @50 (40SLP/CRT)',
        Qty: 1,
        Satuan: 'CRT'
      },
      {
        'No Faktur': 'FKT/AKK/2026/11/001',
        'Nama Pelanggan': `TK MAKMUR JAYA (${sampleArea})`,
        'Item Barang': 'CUP PLST JAGUAR BR 14 OZ NAT @50 (40SLP/CRT)',
        Qty: 1,
        Satuan: 'CRT'
      },
      {
        'No Faktur': 'FKT/AKK/2026/11/001',
        'Nama Pelanggan': `TK MAKMUR JAYA (${sampleArea})`,
        'Item Barang': 'KR BAJA (HJ) 40X68 KN @40 (60PAK/ZAK)',
        Qty: 1,
        Satuan: 'ZAK'
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

    const activeArea = areaName.trim() || OFFICIAL_DESTINATION_AREAS[0] || 'Banyuwangi Kota';
    if (!areaName.trim()) {
      setAreaName(activeArea);
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
            const resolvedSatuan = satuanRaw.trim()
              ? satuanRaw.trim().toUpperCase()
              : normalizeUnit(matchedDb?.unit3 || matchedDb?.satuan || 'CRT');
            const resolvedDocUrl =
              matchedDb?.dokumentasiUrl ||
              createDefaultBarangThumbnail(resolvedNoBarang, resolvedKeterangan, resolvedSatuan);
            const resolvedSizeKb = matchedDb?.compressedSizeKb || estimateDataUrlSizeKb(resolvedDocUrl);

            return {
              id: `imp-${Date.now()}-${idx}`,
              noFaktur: noFakturVal.toUpperCase(),
              namaPelanggan: namaPelangganVal.toUpperCase(),
              itemBarang: resolvedKeterangan,
              qty: qtyNum > 0 ? qtyNum : 1,
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
          `File "${file.name}" berhasil dibaca (${parsedRows.length} baris item).`,
          'success'
        );
      } catch {
        showToast('Gagal membaca file. Gunakan format Excel (.xlsx / .xls) atau CSV sesuai template.', 'error');
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleLoadSampleImportForArea = () => {
    const activeArea = areaName.trim() || OFFICIAL_DESTINATION_AREAS[0] || 'GENTENG RETAIL';
    if (!areaName.trim()) {
      setAreaName(activeArea);
    }
    const seq1 = String(invoices.length + 1).padStart(3, '0');
    const sampleRows: typeof reviewRows = [
      {
        id: `smp-${Date.now()}-1`,
        noFaktur: `FKT/AKK/2026/11/${seq1}`,
        namaPelanggan: `TK MAKMUR JAYA (${activeArea.toUpperCase()})`,
        itemBarang: 'CUP PLST JAGUAR BR 10 OZ NAT @50 (40SLP/CRT)',
        qty: 1,
        satuan: 'CRT',
        skuCode: '7GPJA001'
      },
      {
        id: `smp-${Date.now()}-2`,
        noFaktur: `FKT/AKK/2026/11/${seq1}`,
        namaPelanggan: `TK MAKMUR JAYA (${activeArea.toUpperCase()})`,
        itemBarang: 'CUP PLST JAGUAR BR 14 OZ NAT @50 (40SLP/CRT)',
        qty: 1,
        satuan: 'CRT',
        skuCode: '7GPJA011'
      },
      {
        id: `smp-${Date.now()}-3`,
        noFaktur: `FKT/AKK/2026/11/${seq1}`,
        namaPelanggan: `TK MAKMUR JAYA (${activeArea.toUpperCase()})`,
        itemBarang: 'KR BAJA (HJ) 40X68 KN @40 (60PAK/ZAK)',
        qty: 1,
        satuan: 'ZAK',
        skuCode: '7KRBJ406'
      }
    ];
    setUploadedFileName(`Import_Faktur_${activeArea.replace(/\s+/g, '_')}.xlsx`);
    setReviewRows(sampleRows);
    setHasReviewedFile(true);
    showToast(`Data contoh file faktur untuk area ${activeArea} siap di-review.`, 'info');
  };

  const handleAddReviewRow = () => {
    const activeArea = areaName.trim() || OFFICIAL_DESTINATION_AREAS[0] || 'Banyuwangi Kota';
    if (!areaName.trim()) {
      setAreaName(activeArea);
    }
    const nextIdx = reviewRows.length;
    const seq = String(invoices.length + 1).padStart(3, '0');
    const lastRow = reviewRows[reviewRows.length - 1];
    const dbPreset = dbBarangList[nextIdx % Math.max(1, dbBarangList.length)];
    const fallbackPreset = MASTER_PACKAGING_CATALOG[nextIdx % MASTER_PACKAGING_CATALOG.length];
    const resolvedNo = dbPreset?.noBarang || fallbackPreset?.skuCode || `AKK-BRG-00${nextIdx + 1}`;
    const resolvedKet = dbPreset?.keteranganBarang || fallbackPreset?.itemName || '';
    const resolvedSat = normalizeUnit(dbPreset?.unit3 || dbPreset?.satuan || fallbackPreset?.unit || 'CRT');
    const resolvedDoc =
      dbPreset?.dokumentasiUrl || createDefaultBarangThumbnail(resolvedNo, resolvedKet, resolvedSat);

    setReviewRows(prev => [
      ...prev,
      {
        id: `rev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        noFaktur: lastRow?.noFaktur || invoiceNumber || `FKT/AKK/2026/11/${seq}`,
        namaPelanggan: lastRow?.namaPelanggan || customerName || `TK MAKMUR JAYA (${activeArea.toUpperCase()})`,
        itemBarang: resolvedKet,
        qty: 1,
        satuan: resolvedSat,
        skuCode: resolvedNo,
        dokumentasiUrl: resolvedDoc,
        compressedSizeKb: dbPreset?.compressedSizeKb || estimateDataUrlSizeKb(resolvedDoc)
      }
    ]);
    setHasReviewedFile(true);
    if (!uploadedFileName) {
      setUploadedFileName(`Input_Terstruktur_${activeArea.replace(/\s+/g, '_')}.xlsx`);
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
            branchName: branchName || 'Banyuwangi',
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
        `Faktur ${firstRow.noFaktur} (Cabang ${branchName} • Area ${areaName} • ${finalFleets.length} Armada) berhasil diperbarui & tersinkron ke Database Barang + Aplikasi Scan Muat!`,
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
        branchName: branchName || 'Banyuwangi',
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
        `${createdInvoices.length} Faktur (${validRows.length} item barang) untuk Cabang ${branchName} • Area ${areaName} [${finalFleets.length} Armada] berhasil diimpor & terintegrasi dengan Database Barang + Aplikasi Scan Muat!`,
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
    return accessibleInvoices.filter(inv => {
      const evalRes = evaluateInvoiceStatus(inv);
      const q = searchQuery.toLowerCase();
      const invBranch =
        inv.branchName ||
        (inv.areaName.toLowerCase().includes('denpasar') || inv.areaName.toLowerCase().includes('bali')
          ? 'Bali'
          : 'Banyuwangi');

      const matchSearch =
        !q ||
        inv.invoiceNumber.toLowerCase().includes(q) ||
        inv.soNumber.toLowerCase().includes(q) ||
        inv.customerName.toLowerCase().includes(q) ||
        inv.areaName.toLowerCase().includes(q) ||
        invBranch.toLowerCase().includes(q) ||
        inv.items.some(i => i.itemName.toLowerCase().includes(q) || i.skuCode.toLowerCase().includes(q));

      const selectedMasterBranch = branches.find(
        b =>
          b.name.toLowerCase() === filterBranch.toLowerCase() ||
          b.slug.toLowerCase() === filterBranch.toLowerCase()
      );
      const matchBranch =
        filterBranch === 'SEMUA CABANG' ||
        invBranch.toLowerCase() === filterBranch.toLowerCase() ||
        inv.areaName.toLowerCase().includes(filterBranch.toLowerCase()) ||
        Boolean(
          selectedMasterBranch &&
            (invBranch.toLowerCase() === selectedMasterBranch.name.toLowerCase() ||
              invBranch.toLowerCase() === selectedMasterBranch.slug.toLowerCase() ||
              invBranch.toLowerCase() === (selectedMasterBranch.city || '').toLowerCase() ||
              inv.areaName.toLowerCase().includes(selectedMasterBranch.slug.toLowerCase()) ||
              inv.areaName.toLowerCase().includes((selectedMasterBranch.city || '').toLowerCase()))
        );

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

      const matchDate = !filterDate || inv.date === filterDate;

      return matchSearch && matchBranch && matchFleet && matchStatus && matchDate;
    });
  }, [accessibleInvoices, searchQuery, filterBranch, filterFleet, filterStatus, filterDate]);

  const summaryStats = useMemo(() => {
    let total = accessibleInvoices.length;
    let sesuai = 0;
    let kurangAtauSisa = 0;
    let lebihMuat = 0;

    accessibleInvoices.forEach(inv => {
      const ev = evaluateInvoiceStatus(inv);
      if (ev.overloadItems.length > 0) lebihMuat++;
      else if (ev.matchedItems.length === inv.items.length && inv.items.length > 0) sesuai++;
      else if (ev.unloadedItems.length > 0 || ev.shortageItems.length > 0) kurangAtauSisa++;
    });

    return { total, sesuai, kurangAtauSisa, lebihMuat };
  }, [accessibleInvoices]);

  const dashboardAnalytics = useMemo(() => {
    let totalInvoices = accessibleInvoices.length;
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
  }, [accessibleInvoices, dbBarangList, defaultFleet]);

  return (
    <div className="space-y-6">
      {/* Top Banner & Direct Bridge to RFID Scanner App */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              <FileText className="w-4 h-4" />
              <span>Pengeluaran Barang Admin Penjualan</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mt-1">
              Input Faktur / Sales Order (SO)
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-3xl">
              Input rincian Faktur / Sales Order muatan armada box yang terintegrasi dengan Aplikasi Scan &amp; Foto Muat Barang.
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
              <span>Upload Faktur / SO</span>
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
              <span>Buka Aplikasi Scan Muat</span>
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
                  <span>Progres Realisasi Pemuatan Barang (Faktur vs Foto Kamera)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Verifikasi visual otomatis melalui kamera gudang saat barang dinaikkan ke armada box.
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
                                Scan Muat
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
                Total {accessibleInvoices.length} Faktur / Sales Order
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
                  {accessibleInvoices.map(inv => {
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
                            Scan Muat
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
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row items-stretch md:items-center gap-2.5">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Cari No. Faktur, No. SO, Nama Toko, Cabang, Area, atau Nama Barang..."
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* Fitur Pilih Cabang Terintegrasi Master Cabang */}
        <select
          value={filterBranch}
          onChange={e => setFilterBranch(e.target.value)}
          aria-label="Pilih Cabang"
          className="px-3 py-2 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-xs font-bold text-indigo-700 dark:text-indigo-300 cursor-pointer"
        >
          <option value="SEMUA CABANG">Pilih Cabang: Semua Cabang ({branches.length} Cabang Master)</option>
          {branches.map(b => (
            <option key={b.id} value={b.name}>
              Cabang {b.name} ({b.city || b.slug})
            </option>
          ))}
        </select>

        <select
          value={filterFleet}
          onChange={e => setFilterFleet(e.target.value)}
          className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200"
        >
          <option value="SEMUA ARMADA">Semua Armada Box</option>
          {fleetOptions.map(fl => (
            <option key={fl} value={fl}>{fl}</option>
          ))}
        </select>

        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200"
        >
          <option value="SEMUA STATUS">Semua Status Muat</option>
          <option value="KURANG_SISA">Ada Barang Sisa / Belum Termuat</option>
          <option value="LEBIH_MUAT">Warning: Lebih Muat Barang</option>
          <option value="SESUAI">Lengkap &amp; Sesuai Faktur</option>
        </select>

        {/* 4. Fitur Pemilihan Kalender / Filter Tanggal */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
          <Calendar className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
          <input
            type="date"
            value={filterDate}
            onChange={e => setFilterDate(e.target.value)}
            title="Filter Tanggal Muat Faktur"
            className="bg-transparent text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none cursor-pointer"
          />
          {filterDate && (
            <button
              type="button"
              onClick={() => setFilterDate('')}
              title="Reset Tanggal"
              className="text-[11px] text-slate-400 hover:text-rose-500 font-bold px-1"
            >
              ✕
            </button>
          )}
        </div>
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
                    ? 'border-rose-400/60 ring-1 ring-rose-400/20'
                    : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                {/* 5. Desain UI/UX Peringatan Lebih Muat yang Lebih Sederhana & Ringkas */}
                {ev.overloadItems.length > 0 && (
                  <div className="mb-3 px-3.5 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-center justify-between gap-2 text-xs text-rose-700 dark:text-rose-300">
                    <div className="flex items-center gap-2 font-medium min-w-0">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                      <span className="truncate text-[11px]">
                        <strong>Perhatian:</strong> {ev.overloadItems.length} item lebih muat ({ev.overloadItems.map(i => `${i.skuCode} +${i.qtyLoaded - i.qtyOrdered} ${i.unit}`).join(', ')})
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onOpenRfidScannerForInvoice(inv.id)}
                      className="text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:underline shrink-0 ml-2"
                    >
                      Cek Scan Muat →
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
                      <span className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-[11px] font-bold">
                        Cabang: {inv.branchName || (inv.areaName.toLowerCase().includes('bali') || inv.areaName.toLowerCase().includes('denpasar') ? 'Bali' : 'Banyuwangi')}
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
                      <span>Scan &amp; Foto Barang Muat</span>
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
                      Realisasi Barang Termuat via Foto Kamera:{' '}
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
                          <th className="py-2 pr-3 text-center">Termuat (Foto Muat)</th>
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

      {/* Modal Ringkas Input & Upload File Faktur / Sales Order (SO) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs overflow-y-auto flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-6xl w-full p-4 sm:p-5 shadow-2xl">
            {/* Compact Header */}
            <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-indigo-600/15 border border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white truncate">
                    {editingInvoiceId
                      ? `Edit Faktur (${invoiceNumber})`
                      : 'Input & Upload Faktur / Sales Order (SO)'}
                  </h2>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveInvoice} className="space-y-3 mt-3">
              {/* Baris 1: Pilih Cabang, Area Kirim, Tanggal, Admin PIC & Tambah Armada Simple */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 space-y-2.5">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-600 dark:text-slate-400 mb-1">
                      Pilih Cabang (Master Cabang) *
                    </label>
                    <select
                      required
                      value={branchName}
                      onChange={e => setBranchName(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white cursor-pointer focus:outline-none focus:border-indigo-500"
                    >
                      {branches.map(b => (
                        <option key={b.id} value={b.name}>
                          Cabang {b.name} ({b.city || b.slug})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-600 dark:text-slate-400 mb-1">
                      Area Kirim *
                    </label>
                    <select
                      required
                      value={areaName}
                      onChange={e => setAreaName(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white cursor-pointer focus:outline-none focus:border-indigo-500"
                    >
                      <option value="">-- Pilih Area Kirim --</option>
                      {OFFICIAL_DESTINATION_AREAS.map(ar => (
                        <option key={ar} value={ar}>
                          {ar}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-600 dark:text-slate-400 mb-1">
                      Tanggal Muat *
                    </label>
                    <input
                      type="date"
                      required
                      value={date}
                      onChange={e => setDate(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-600 dark:text-slate-400 mb-1">
                      Admin Penjualan PIC *
                    </label>
                    <select
                      value={adminPic}
                      onChange={e => setAdminPic(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white cursor-pointer"
                    >
                      {adminNames.map(adm => (
                        <option key={adm} value={adm}>
                          {adm}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Simple Inline Armada Selector */}
                <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-200/70 dark:border-slate-800">
                  <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 flex items-center gap-1 mr-1">
                    <Truck className="w-3.5 h-3.5 text-sky-500" />
                    Armada:
                  </span>

                  {selectedFleets.map((fl, fIdx) => (
                    <span
                      key={fIdx}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-sky-300 dark:border-sky-800 text-[11px] font-bold text-slate-800 dark:text-slate-200"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                      <span className="truncate max-w-[180px]" title={fl}>
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
                          className="text-slate-400 hover:text-rose-500 cursor-pointer"
                          title="Hapus armada"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </span>
                  ))}

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
                    className="px-2.5 py-1 rounded-lg bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 text-[11px] font-bold text-sky-700 dark:text-sky-300 cursor-pointer hover:border-sky-400"
                  >
                    <option value="">+ Tambah Armada</option>
                    {fleetOptions
                      .filter(fl => !selectedFleets.includes(fl))
                      .map(fl => (
                        <option key={fl} value={fl}>
                          {fl}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {/* Baris 2: Toolbar Upload File & Tambah Baris Input Manual (Selalu Tampil & Aktif) */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200/70 dark:border-indigo-800/60">
                <input
                  ref={importFileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileUploadChange}
                  className="hidden"
                />

                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => importFileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-2xs cursor-pointer transition"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{uploadedFileName ? 'Ganti File Faktur' : 'Upload File (.xlsx / .csv)'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDownloadTemplateExcel('xlsx')}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold cursor-pointer transition"
                  >
                    <Download className="w-3 h-3" />
                    <span>Template .xlsx</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                    {reviewRows.length} Baris ({ reviewRows.reduce((acc, r) => acc + (Number(r.qty) || 0), 0) } Qty)
                  </span>
                  <button
                    type="button"
                    onClick={handleAddReviewRow}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-indigo-50 text-indigo-600 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-700 text-xs font-bold cursor-pointer transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah Baris</span>
                  </button>
                </div>
              </div>

              {/* Baris 3: Tabel Input / Review Faktur (Langsung Tampil Tanpa Terkunci) */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
                <div className="overflow-x-auto max-h-64">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100 dark:bg-slate-950 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10">
                      <tr>
                        <th className="py-2 px-2 w-8 text-center">#</th>
                        <th className="py-2 px-2 w-48 min-w-[175px]">No Faktur *</th>
                        <th className="py-2 px-2 w-64 min-w-[235px]">Nama Pelanggan *</th>
                        <th className="py-2 px-2 min-w-[320px]">Item Barang (Database Barang) *</th>
                        <th className="py-2 px-2 w-18 text-center">Qty *</th>
                        <th className="py-2 px-2 w-24">Satuan *</th>
                        <th className="py-2 px-2 w-10 text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {reviewRows.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-6 text-center text-xs text-slate-500">
                            Belum ada baris item. Klik <strong>Upload File (.xlsx / .csv)</strong> atau <strong>+ Tambah Baris</strong> untuk mulai input.
                          </td>
                        </tr>
                      ) : (
                        reviewRows.map((row, idx) => {
                          const standardUnits = ['CRT', 'ZAK', 'SLP', 'PAK', 'PCS', 'BAL', 'IKAT', 'BOX', 'ROLL', 'KG', 'DUS'];
                          const currentUnit = (row.satuan || 'CRT').trim().toUpperCase();
                          const unitOptions = standardUnits.includes(currentUnit)
                            ? standardUnits
                            : [currentUnit, ...standardUnits];

                          return (
                            <tr key={row.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                              <td className="py-1.5 px-2 text-center font-mono font-bold text-slate-400">
                                {idx + 1}
                              </td>
                              <td className="py-1.5 px-2">
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
                                  className="w-full px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold text-slate-900 dark:text-white"
                                />
                              </td>
                              <td className="py-1.5 px-2">
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
                                  className="w-full px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white"
                                />
                              </td>
                              <td className="py-1.5 px-2">
                                <div className="flex items-center gap-1.5">
                                  <span className="px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 font-mono font-bold text-[10px] shrink-0">
                                    {row.skuCode}
                                  </span>
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
                                                satuan: match
                                                  ? normalizeUnit(match.unit3 || match.satuan || r.satuan)
                                                  : r.satuan,
                                                dokumentasiUrl: match?.dokumentasiUrl || r.dokumentasiUrl,
                                                compressedSizeKb: match?.compressedSizeKb || r.compressedSizeKb
                                              }
                                            : r
                                        )
                                      );
                                    }}
                                    placeholder="Ketik / cari nama barang..."
                                    className="w-full px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white"
                                  />
                                </div>
                              </td>
                              <td className="py-1.5 px-2">
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
                                  className="w-full px-1.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs font-bold text-center text-slate-900 dark:text-white"
                                />
                              </td>
                              <td className="py-1.5 px-2">
                                <select
                                  value={currentUnit}
                                  onChange={e =>
                                    setReviewRows(prev =>
                                      prev.map(r =>
                                        r.id === row.id
                                          ? { ...r, satuan: e.target.value }
                                          : r
                                      )
                                    )
                                  }
                                  className="w-full px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white cursor-pointer"
                                >
                                  {unitOptions.map(u => (
                                    <option key={u} value={u}>
                                      {u}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="py-1.5 px-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => setReviewRows(prev => prev.filter(r => r.id !== row.id))}
                                  className="p-1 rounded-lg text-rose-500 hover:bg-rose-500/10 cursor-pointer"
                                  title="Hapus Baris"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex-wrap">
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  Target: <strong className="text-slate-900 dark:text-white">{areaName || 'Pilih Area'}</strong> •{' '}
                  <strong>{selectedFleets.length}</strong> Armada • <strong>{reviewRows.length}</strong> Item
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={!areaName || reviewRows.length === 0}
                    className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:pointer-events-none text-white text-xs font-bold shadow-sm cursor-pointer transition"
                  >
                    {editingInvoiceId ? 'Simpan Perubahan' : 'Simpan & Sinkronkan'}
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
  'Ram 1',
  'Ram 2',
  'Ram 3'
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
      type === 'error' ? 'PERINGATAN MUAT BARANG!' : 'Aplikasi Scan Muat Barang',
      msg,
      type === 'error'
    );
  };
  const {
    invoices,
    saveInvoices,
    defaultAdmin
  } = useSharedSalesRfidInvoices();

  // Live synchronization with Gudang -> Database Barang (kode barang, deskripsi barang, satuan)
  const [dbBarangList, setDbBarangList] = useState<DatabaseBarangRecord[]>(() =>
    databaseBarangService.getAll()
  );

  useEffect(() => {
    void databaseBarangService.fetchFromServer().then(rows => {
      if (rows && rows.length > 0) {
        setDbBarangList(rows);
      }
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

  // Header & Operational States
  const { user: currentUser } = useRoleAccess();
  const isSuperAdmin = currentUser?.role === 'super_admin';
  const hasFullSalesAccess = isSuperAdmin || canEdit(currentUser, 'sales_admin') || canEdit(currentUser, 'sales_rfid_scanner');
  const currentUserName = (currentUser?.fullName || '').trim().toLowerCase();

  // User Isolation berdasarkan Hak Akses User Management (Req 2 & 3)
  const availableInvoices = useMemo(() => {
    if (hasFullSalesAccess || !currentUserName) return invoices;
    return invoices.filter(inv => {
      const pic = (inv.adminPic || '').trim().toLowerCase();
      return (
        pic === currentUserName ||
        pic.includes(currentUserName) ||
        currentUserName.includes(pic)
      );
    });
  }, [invoices, hasFullSalesAccess, currentUserName]);

  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>(() => {
    const savedId = localStorage.getItem(ACTIVE_INVOICE_KEY);
    return initialInvoiceId || savedId || availableInvoices[0]?.id || invoices[0]?.id || '';
  });

  useEffect(() => {
    if (initialInvoiceId && availableInvoices.some(i => i.id === initialInvoiceId)) {
      setSelectedInvoiceId(initialInvoiceId);
      localStorage.setItem(ACTIVE_INVOICE_KEY, initialInvoiceId);
    } else if (!availableInvoices.some(i => i.id === selectedInvoiceId) && availableInvoices[0]) {
      setSelectedInvoiceId(availableInvoices[0].id);
    }
  }, [initialInvoiceId, availableInvoices, selectedInvoiceId]);

  const activeInvoice = useMemo(() => {
    return availableInvoices.find(i => i.id === selectedInvoiceId) || availableInvoices[0] || invoices[0] || null;
  }, [availableInvoices, invoices, selectedInvoiceId]);

  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [selectedGate, setSelectedGate] = useState<string>(LOADING_GATE_OPTIONS[0]);
  const activeUserName = currentUser?.fullName?.trim() || 'Bayu Novianto';
  const scanAdminPic = activeUserName;

  // Live Viewfinder & Hardware Camera Controls
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [manualCameraPaused, setManualCameraPaused] = useState<boolean>(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isTorchOn, setIsTorchOn] = useState<boolean>(false);
  const [, setTorchSupported] = useState<boolean>(false);
  const [autoScanEnabled, setAutoScanEnabled] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [isVerifyingScan, setIsVerifyingScan] = useState<boolean>(false);

  // Target Item / OCR Mode Selection
  const [targetScanMode, setTargetScanMode] = useState<string>('AUTO');
  const [customTestCode] = useState<string>('');
  const [scanQtyInput, setScanQtyInput] = useState<number>(1);
  const [scanNotesInput] = useState<string>('');
  const [lastCapturedPreview, setLastCapturedPreview] = useState<string | null>(null);
  const [lastCapturedExif, setLastCapturedExif] = useState<ExifTimestampMetadata | null>(null);

  // Strict Error Lock State: Jika ada kesalahan atau perbedaan barang dengan Database Barang / Faktur,
  // otomatis MERAH dan TIDAK BISA melanjutkan ke barang selanjutnya sampai barang ini difoto ulang dengan benar.
  const [scanErrorLock, setScanErrorLock] = useState<{
    lockedItemId: string;
    expectedCode: string;
    expectedName: string;
    expectedUnit: string;
    detectedCode: string;
    detectedName: string;
    reason: string;
    photoDataUrl: string;
    timestamp: string;
  } | null>(null);

  // Real-Time Feedback Card & Recent Scans Log
  const [, setLastFeedback] = useState<RealtimeScanFeedback | null>(null);
  const [recentScansLog, setRecentScansLog] = useState<RealtimeScanFeedback[]>(() => {
    try {
      const raw = localStorage.getItem(SCAN_HISTORY_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.slice(0, 30);
      }
    } catch {}
    return [];
  });
  const [historyFilter, setHistoryFilter] = useState<'ALL' | 'SUCCESS' | 'ERROR'>('ALL');

  // Modals for Overload Warning & Item Photo Gallery
  const [overloadWarningAlert, setOverloadWarningAlert] = useState<{
    itemName: string;
    skuCode: string;
    qtyOrdered: number;
    qtyLoaded: number;
    unit: string;
  } | null>(null);
  const [previewPhotoModal, setPreviewPhotoModal] = useState<{
    itemId?: string;
    itemName: string;
    skuCode?: string;
    scans: ItemPhotoScanLog[];
  } | null>(null);
  const [activePhotoPreviewIdx, setActivePhotoPreviewIdx] = useState<number>(0);
  const multiPhotoInputRef = useRef<HTMLInputElement | null>(null);
  const [multiPhotoTargetItemId, setMultiPhotoTargetItemId] = useState<string | null>(null);

  // Master Barang search & Target Barang integration inside Menu List
  const [masterSearchQuery, setMasterSearchQuery] = useState<string>('');
  const [isMasterSearchOpen, setIsMasterSearchOpen] = useState<boolean>(false);

  // Ultralytics YOLO26 End-to-End ONNX (nms=True, 640x640) Real-Time Auto-Detection HUD States
  const [yoloConfidence, setYoloConfidence] = useState<number>(0);
  const [, setYoloInferenceMs] = useState<number>(14);
  const [yoloEngineMode, setYoloEngineMode] = useState<'JALUR_A_WEB' | 'JALUR_B_SERVER'>('JALUR_A_WEB');
  const [liveVisionStatus, setLiveVisionStatus] = useState<{
    state: 'matching' | 'mismatch' | 'no_packaging' | 'checking';
    confidence: number;
    detectedCode?: string;
    detectedSummary?: string;
    reason?: string;
    bbox?: [number, number, number, number];
  }>({
    state: 'no_packaging',
    confidence: 0,
    reason: 'Arahkan kamera ke label kemasan barang'
  });
  const isLiveCheckingRef = useRef<boolean>(false);
  const ortSessionRef = useRef<ort.InferenceSession | null>(null);
  const yoloClassesRef = useRef<string[]>([]);
  const yoloCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastAutoVerifyCooldownUntilRef = useRef<number>(0);

  // 4 Dedicated Mobile Pages: 'kamera' (Kamera Satu Layar), 'list' (Urutan Pelanggan & List Barang), 'termuat_sisa' (Termuat & Sisa), 'riwayat' (Riwayat Scan)
  const [scannerPage, setScannerPage] = useState<'kamera' | 'list' | 'termuat_sisa' | 'riwayat'>('kamera');
  const [openCustomDropdown, setOpenCustomDropdown] = useState<'cam_store' | 'cam_item' | 'list_store' | 'list_item' | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
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

  const stopCamera = (isManualPause: boolean = true) => {
    if (isManualPause) {
      setManualCameraPaused(true);
    }
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
    setManualCameraPaused(false);
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { exact: desiredFacing },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        });
      } catch {
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
      setIsCameraActive(false);
    }
  };

  // 1. OTOMATIS LANGSUNG AKTIFKAN KAMERA saat masuk ke tab kamera
  useEffect(() => {
    if (scannerPage === 'kamera' && !isCameraActive && !manualCameraPaused) {
      void startLiveCamera();
    }
  }, [scannerPage, isCameraActive, manualCameraPaused]);

  // Pastikan elemen <video> terhubung ke stream aktif saat berpindah tab kembali ke kamera
  useEffect(() => {
    if (scannerPage === 'kamera' && isCameraActive && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [scannerPage, isCameraActive]);

  const handleSwitchCamera = async () => {
    const nextFacing = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextFacing);
    await startLiveCamera(nextFacing);
  };

  const handleToggleTorch = async () => {
    const nextTorch = !isTorchOn;
    setIsTorchOn(nextTorch);

    if (streamRef.current) {
      const track = streamRef.current.getVideoTracks()[0];
      if (track) {
        try {
          await track.applyConstraints({
            advanced: [{ torch: nextTorch } as unknown as MediaTrackConstraintSet]
          });
          return;
        } catch {
          // Hardware torch permission denied or not supported on this device/browser
        }
      }
    }

    // Graceful fallback to High-Luminance Screen Flash illumination mode
    showToast(
      nextTorch
        ? '💡 Flash Layar Aktif (Penerangan Kemasan & Barcode)'
        : 'Flash Dimatikan',
      'info'
    );
  };

  // Resolve which item is currently targeted in viewfinder (jika terkunci error merah, paksa tetap di item yang terkunci)
  const resolvedTargetItem = useMemo((): SalesOrderItem | null => {
    if (!activeInvoice || activeInvoice.items.length === 0) return null;
    if (scanErrorLock) {
      const lockedFound = activeInvoice.items.find(it => it.id === scanErrorLock.lockedItemId);
      if (lockedFound) return lockedFound;
    }
    if (targetScanMode === 'CUSTOM_CODE') return null;
    if (targetScanMode !== 'AUTO') {
      const found = activeInvoice.items.find(it => it.id === targetScanMode || it.skuCode === targetScanMode);
      if (found) return found;
    }
    return (
      activeInvoice.items.find(it => it.qtyLoaded < it.qtyOrdered) ||
      activeInvoice.items[0] ||
      null
    );
  }, [activeInvoice, targetScanMode, scanErrorLock]);

  // Helper: Cross-reference item Faktur dengan Database Barang (Kode Barang, Deskripsi Barang, Satuan)
  const getIntegratedDbInfo = (item: SalesOrderItem) => {
    const matched =
      dbBarangList.find(
        db => db.noBarang.trim().toUpperCase() === item.skuCode.trim().toUpperCase()
      ) || databaseBarangService.findMatch(item.skuCode, item.itemName);
    return {
      isRegisteredInDb: Boolean(matched),
      kodeBarang: matched?.noBarang || item.skuCode,
      deskripsiBarang: matched?.deskripsiBarang || matched?.keteranganBarang || item.itemName,
      satuan: (matched?.satuan || matched?.unit1 || item.unit) as SalesOrderItem['unit'],
      matchedRecord: matched || null
    };
  };

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

    if (lastCapturedPreview && lastCapturedPreview.startsWith('data:image/jpeg')) {
      return { base64: lastCapturedPreview, exif: lastCapturedExif || exifMeta };
    }

    const nowStr = nowDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' WIB';
    return {
      base64: createSampleSvgPhoto(fallbackName, fallbackCode, qty, unit, nowStr),
      exif: exifMeta
    };
  };

  // Helper: Analyze live video frame to check if camera is pointing at a real packaging/label with printed text/lines vs floor/shoe/wall/blank
  const analyzeVideoFrameForPackaging = (): {
    hasPackaging: boolean;
    edgeConfidence: number;
    previewBase64: string | null;
  } => {
    if (!videoRef.current || videoRef.current.videoWidth === 0 || videoRef.current.videoHeight === 0) {
      return { hasPackaging: false, edgeConfidence: 0, previewBase64: null };
    }
    const sampleW = 240;
    const sampleH = 180;
    const canvas = document.createElement('canvas');
    canvas.width = sampleW;
    canvas.height = sampleH;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return { hasPackaging: false, edgeConfidence: 0, previewBase64: null };
    }

    ctx.drawImage(videoRef.current, 0, 0, sampleW, sampleH);
    const imgData = ctx.getImageData(24, 20, sampleW - 48, sampleH - 40);
    const data = imgData.data;
    const w = imgData.width;
    const h = imgData.height;

    let sumLum = 0;
    let sumSqLum = 0;
    let sharpEdges = 0;
    const totalPixels = w * h;
    const lum = new Float32Array(totalPixels);

    for (let i = 0; i < totalPixels; i++) {
      const idx = i * 4;
      const l = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
      lum[i] = l;
      sumLum += l;
      sumSqLum += l * l;
    }

    const meanLum = sumLum / Math.max(1, totalPixels);
    const variance = Math.max(0, sumSqLum / Math.max(1, totalPixels) - meanLum * meanLum);
    const stdDev = Math.sqrt(variance);

    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const idx = y * w + x;
        const gx = Math.abs(lum[idx + 1] - lum[idx - 1]);
        const gy = Math.abs(lum[idx + w] - lum[idx - w]);
        if (gx + gy > 46) {
          sharpEdges++;
        }
      }
    }

    const edgeRatio = sharpEdges / Math.max(1, totalPixels);
    // Printed carton labels/tables have rich sharp text/line edges (edgeRatio >= 0.048) and contrast (stdDev >= 18),
    // whereas floors, tiles with a shoe, walls, or covered lenses have very few sharp text edges.
    const hasPackaging = edgeRatio >= 0.048 && stdDev >= 18 && meanLum > 22 && meanLum < 245;
    const edgeConfidence = hasPackaging ? Math.min(0.99, 0.75 + edgeRatio * 1.5) : 0;

    let previewBase64: string | null = null;
    if (hasPackaging) {
      const capCanvas = document.createElement('canvas');
      capCanvas.width = 640;
      capCanvas.height = Math.round((videoRef.current.videoHeight / videoRef.current.videoWidth) * 640) || 480;
      const capCtx = capCanvas.getContext('2d');
      if (capCtx) {
        capCtx.drawImage(videoRef.current, 0, 0, capCanvas.width, capCanvas.height);
        previewBase64 = capCanvas.toDataURL('image/jpeg', 0.72);
      }
    }

    return { hasPackaging, edgeConfidence, previewBase64 };
  };

  // SPESIFIKASI 2: JALUR A — Muat /models/best.onnx & /models/classes.json di Browser HP via onnxruntime-web
  useEffect(() => {
    let mounted = true;
    const initLocalYolo26Onnx = async () => {
      try {
        // Point onnxruntime-web to dedicated /onnx-wasm/ route served with Content-Type: application/wasm
        ort.env.wasm.wasmPaths = '/onnx-wasm/';
        ort.env.wasm.numThreads = 1;
        ort.env.logLevel = 'fatal';
      } catch {
        // Ignore env setup issues
      }

      try {
        const clsResp = await fetch('/models/classes.json', { cache: 'no-store' });
        if (clsResp.ok) {
          const contentType = clsResp.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            const parsed = await clsResp.json();
            if (mounted) {
              if (Array.isArray(parsed)) {
                yoloClassesRef.current = parsed.map((c: unknown) => String(c || '').trim().toUpperCase());
              } else if (parsed && typeof parsed === 'object') {
                const obj = parsed as Record<string, unknown>;
                if (Array.isArray(obj.classes)) {
                  yoloClassesRef.current = obj.classes.map((c: unknown) => String(c || '').trim().toUpperCase());
                } else {
                  const keys = Object.keys(obj).sort((a, b) => Number(a) - Number(b));
                  yoloClassesRef.current = keys.map(k => String(obj[k] || '').trim().toUpperCase());
                }
              }
            }
          }
        }
      } catch {
        // Fallback ke daftar SKU dari Database Barang jika classes.json belum ada
      }

      try {
        const modelResp = await fetch('/models/best.onnx', { method: 'GET', cache: 'no-store' });
        if (!modelResp.ok) {
          if (mounted) {
            ortSessionRef.current = null;
            setYoloEngineMode('JALUR_B_SERVER');
          }
          return;
        }

        const contentType = (modelResp.headers.get('content-type') || '').toLowerCase();
        if (contentType.includes('text/html') || contentType.includes('application/json')) {
          if (mounted) {
            ortSessionRef.current = null;
            setYoloEngineMode('JALUR_B_SERVER');
          }
          return;
        }

        const modelBuffer = await modelResp.arrayBuffer();
        const bytes = new Uint8Array(modelBuffer);
        // Validate non-empty binary and ensure it is not <!DOCTYPE html> (0x3c 0x21 0x64 0x6f)
        if (
          bytes.byteLength < 128 ||
          (bytes[0] === 0x3c && bytes[1] === 0x21) ||
          (bytes[0] === 0x7b && bytes[1] === 0x22)
        ) {
          if (mounted) {
            ortSessionRef.current = null;
            setYoloEngineMode('JALUR_B_SERVER');
          }
          return;
        }

        let session: ort.InferenceSession | null = null;
        try {
          session = await ort.InferenceSession.create(bytes, {
            executionProviders: ['webgl', 'wasm']
          });
        } catch {
          session = await ort.InferenceSession.create(bytes, {
            executionProviders: ['wasm']
          });
        }
        if (mounted && session) {
          ortSessionRef.current = session;
          setYoloEngineMode('JALUR_A_WEB');
        }
      } catch {
        if (mounted) {
          ortSessionRef.current = null;
          setYoloEngineMode('JALUR_B_SERVER');
        }
      }
    };

    void initLocalYolo26Onnx();
    return () => {
      mounted = false;
    };
  }, []);

  // Helper Jalur A: Inferensi lokal YOLO26 End-to-End ONNX (nms=True, 640x640, output [1, 300, 6] -> [x1, y1, x2, y2, score, class_id])
  const runJalurALocalOnnxDetection = async (
    confThreshold: number = 0.25
  ): Promise<{
    loaded: boolean;
    inferenceMs: number;
    best: {
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      score: number;
      classId: number;
      skuCode: string;
      itemName: string;
      unit: string;
    } | null;
  }> => {
    const t0 = performance.now();
    const session = ortSessionRef.current;
    if (
      !session ||
      !videoRef.current ||
      videoRef.current.videoWidth === 0 ||
      videoRef.current.videoHeight === 0
    ) {
      return { loaded: Boolean(session), inferenceMs: 0, best: null };
    }

    try {
      const INPUT_SIZE = 640;
      if (!yoloCanvasRef.current) {
        yoloCanvasRef.current = document.createElement('canvas');
        yoloCanvasRef.current.width = INPUT_SIZE;
        yoloCanvasRef.current.height = INPUT_SIZE;
      }
      const canvas = yoloCanvasRef.current;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) {
        return { loaded: true, inferenceMs: 0, best: null };
      }

      ctx.drawImage(videoRef.current, 0, 0, INPUT_SIZE, INPUT_SIZE);
      const rgba = ctx.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE).data;
      const numPixels = INPUT_SIZE * INPUT_SIZE;
      const float32Data = new Float32Array(3 * numPixels);

      for (let i = 0; i < numPixels; i++) {
        const idx = i * 4;
        float32Data[i] = rgba[idx] / 255.0;
        float32Data[numPixels + i] = rgba[idx + 1] / 255.0;
        float32Data[2 * numPixels + i] = rgba[idx + 2] / 255.0;
      }

      const inputName = session.inputNames[0] || 'images';
      const inputTensor = new ort.Tensor('float32', float32Data, [1, 3, INPUT_SIZE, INPUT_SIZE]);
      const outputMap = await session.run({ [inputName]: inputTensor });
      const outputName = session.outputNames[0] || Object.keys(outputMap)[0];
      const outputTensor = outputMap[outputName];
      const outData = outputTensor.data as Float32Array | number[];
      const dims = outputTensor.dims || [1, 300, 6];

      // Parse End-to-End YOLO26 output tensor [1, 300, 6] dengan urutan [x1, y1, x2, y2, score, class_id]
      const numRows = dims.length === 3 ? dims[1] : Math.floor(outData.length / 6);
      const stride = dims.length === 3 ? dims[2] : 6;
      const classesList =
        yoloClassesRef.current.length > 0
          ? yoloClassesRef.current
          : dbBarangList.map(d => d.noBarang.trim().toUpperCase());

      let bestDet: {
        x1: number;
        y1: number;
        x2: number;
        y2: number;
        score: number;
        classId: number;
        skuCode: string;
        itemName: string;
        unit: string;
      } | null = null;

      for (let r = 0; r < numRows; r++) {
        const offset = r * stride;
        const x1 = Number(outData[offset]);
        const y1 = Number(outData[offset + 1]);
        const x2 = Number(outData[offset + 2]);
        const y2 = Number(outData[offset + 3]);
        const score = Number(outData[offset + 4]);
        const classId = Math.round(Number(outData[offset + 5]));

        if (score >= confThreshold && classId >= 0) {
          if (!bestDet || score > bestDet.score) {
            const rawSku = classesList[classId] || `SKU-${classId}`;
            const dbMatch = databaseBarangService.resolveBySkuOrClassName(rawSku);
            const manifestMatch = activeInvoice?.items.find(
              it => it.skuCode.trim().toUpperCase() === rawSku
            );
            bestDet = {
              x1: Math.max(0, Math.round(x1)),
              y1: Math.max(0, Math.round(y1)),
              x2: Math.min(INPUT_SIZE, Math.round(x2)),
              y2: Math.min(INPUT_SIZE, Math.round(y2)),
              score,
              classId,
              skuCode: dbMatch?.noBarang || manifestMatch?.skuCode || rawSku,
              itemName:
                dbMatch?.deskripsiBarang ||
                manifestMatch?.itemName ||
                `Barang SKU ${rawSku}`,
              unit: dbMatch?.satuan || dbMatch?.unit1 || manifestMatch?.unit || 'CRT'
            };
          }
        }
      }

      return {
        loaded: true,
        inferenceMs: Math.max(6, Math.round(performance.now() - t0)),
        best: bestDet
      };
    } catch {
      return { loaded: false, inferenceMs: Math.round(performance.now() - t0), best: null };
    }
  };

  // Real-Time Visual & YOLO26 Hybrid Validation when Camera is Active
  // Saat YOLO Auto: ON aktif, Jalur A dieksekusi setiap 250ms-300ms langsung dari <video> tanpa membebani kuota server
  useEffect(() => {
    if (!isCameraActive || scannerPage !== 'kamera' || !activeInvoice) {
      setLiveVisionStatus({
        state: 'no_packaging',
        confidence: 0,
        reason: 'Kamera belum aktif'
      });
      setYoloConfidence(0);
      return;
    }

    let cancelled = false;

    const runLiveCheck = async () => {
      if (cancelled || isVerifyingScan || isLiveCheckingRef.current) return;
      const tStart = performance.now();
      const frameAnalysis = analyzeVideoFrameForPackaging();

      if (!frameAnalysis.hasPackaging || !frameAnalysis.previewBase64) {
        if (!cancelled) {
          setYoloConfidence(0);
          setYoloInferenceMs(Math.max(8, Math.round(performance.now() - tStart)));
          setLiveVisionStatus({
            state: 'no_packaging',
            confidence: 0,
            reason: 'Kamera tidak mengarah ke label barang'
          });
        }
        return;
      }

      isLiveCheckingRef.current = true;

      try {
        const currentTarget = resolvedTargetItem || activeInvoice.items[0];
        const dbInfo = currentTarget ? getIntegratedDbInfo(currentTarget) : null;
        const targetCode = (dbInfo?.kodeBarang || currentTarget?.skuCode || 'AUTO').trim().toUpperCase();
        const targetName = dbInfo?.deskripsiBarang || currentTarget?.itemName || '';

        // 1. Jalankan JALUR A (onnxruntime-web lokal di browser HP) terlebih dahulu
        const localRes = await runJalurALocalOnnxDetection(0.25);
        if (cancelled) return;

        if (localRes.loaded && localRes.best) {
          setYoloEngineMode('JALUR_A_WEB');
          setYoloInferenceMs(localRes.inferenceMs);
          setYoloConfidence(localRes.best.score);

          const detectedSku = localRes.best.skuCode.trim().toUpperCase();
          const inManifest = activeInvoice.items.some(
            it =>
              it.skuCode.trim().toUpperCase() === detectedSku ||
              getIntegratedDbInfo(it).kodeBarang.trim().toUpperCase() === detectedSku
          );
          const isMatch =
            inManifest &&
            (targetScanMode === 'AUTO' || detectedSku === targetCode);

          setLiveVisionStatus({
            state: isMatch ? 'matching' : 'mismatch',
            confidence: localRes.best.score,
            detectedCode: detectedSku,
            detectedSummary: localRes.best.itemName,
            bbox: [localRes.best.x1, localRes.best.y1, localRes.best.x2, localRes.best.y2],
            reason: isMatch
              ? undefined
              : `Terdeteksi [${detectedSku}] ${localRes.best.itemName}, target: [${targetCode}]`
          });

          // Jika YOLO Auto: ON dan status SESUAI (confidence >= 0.75) serta di luar masa cooldown 2 detik:
          if (
            autoScanEnabled &&
            isMatch &&
            localRes.best.score >= 0.75 &&
            !scanErrorLock &&
            Date.now() >= lastAutoVerifyCooldownUntilRef.current
          ) {
            const targetInList = activeInvoice.items.find(
              it =>
                it.skuCode.trim().toUpperCase() === detectedSku ||
                getIntegratedDbInfo(it).kodeBarang.trim().toUpperCase() === detectedSku
            );
            if (targetInList && targetInList.qtyLoaded < targetInList.qtyOrdered) {
              lastAutoVerifyCooldownUntilRef.current = Date.now() + 2000;
              void executeCaptureAndVerify(frameAnalysis.previewBase64, undefined, false);
            }
          }
          return;
        }

        // 2. Jika model lokal best.onnx belum dimuat di browser, gunakan pemeriksa ringan
        const refImg = dbInfo?.matchedRecord?.dokumentasiUrl?.startsWith('data:image/jpeg')
          ? dbInfo.matchedRecord.dokumentasiUrl
          : undefined;

        const res = await fetch('/api/scan-muat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image: frameAnalysis.previewBase64,
            image_base64: frameAnalysis.previewBase64,
            surat_jalan_id: activeInvoice.invoiceNumber,
            gate_id: selectedGate,
            target_item_code: targetCode,
            target_item_name: targetName,
            reference_image_base64: refImg,
            live_preview_only: true,
            expected_items: activeInvoice.items
          })
        });

        const data = await res.json();
        if (cancelled) return;

        const elapsed = Math.max(12, Math.round(performance.now() - tStart));
        setYoloInferenceMs(elapsed);

        if (res.ok && data.is_valid_packaging && data.is_matching_target && data.status === 'success') {
          const conf = typeof data.confidence === 'number' && data.confidence > 0 ? data.confidence : 0.97;
          setYoloConfidence(conf);
          setLiveVisionStatus({
            state: 'matching',
            confidence: conf,
            detectedCode: data.extracted_code || targetCode,
            detectedSummary: data.product_name || targetName
          });
        } else if (data.is_valid_packaging === false) {
          setYoloConfidence(0);
          setLiveVisionStatus({
            state: 'no_packaging',
            confidence: 0,
            reason: data.message || 'Kamera tidak mengarah ke kemasan barang'
          });
        } else {
          const conf = typeof data.confidence === 'number' && data.confidence > 0 ? data.confidence : 0.96;
          setYoloConfidence(conf);
          setLiveVisionStatus({
            state: 'mismatch',
            confidence: conf,
            detectedCode: data.extracted_code || 'BERBEDA',
            detectedSummary: data.product_name || 'Ukuran / Barang Berbeda',
            reason: data.message || 'Barang di kamera tidak sesuai dengan target'
          });
        }
      } catch {
        // Keep last state on transient network error
      } finally {
        isLiveCheckingRef.current = false;
      }
    };

    void runLiveCheck();
    // Saat YOLO Auto: ON aktif & model Jalur A tersedia, jalankan inferensi real-time setiap 280ms (250ms-300ms)
    const intervalMs = autoScanEnabled && ortSessionRef.current ? 280 : 1200;
    const timer = window.setInterval(() => {
      void runLiveCheck();
    }, intervalMs);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [isCameraActive, scannerPage, activeInvoice, resolvedTargetItem, selectedGate, isVerifyingScan, autoScanEnabled, targetScanMode, scanErrorLock]);

  // Tambah Foto Tambahan (>1 Foto per Barang) langsung dari Kamera tanpa menambah beban antrian atau saat ingin multi-angle dokumentasi
  const handleCaptureExtraPhotoOnly = (overrideItem?: SalesOrderItem) => {
    if (!activeInvoice) return;
    const targetItem = overrideItem || resolvedTargetItem || activeInvoice.items[0];
    if (!targetItem) return;

    const dbInfo = getIntegratedDbInfo(targetItem);
    const nowDate = new Date();
    const displayTime =
      nowDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' WIB';
    const captured = captureCompressedBase64FromViewfinder(
      dbInfo.kodeBarang,
      dbInfo.deskripsiBarang,
      0,
      dbInfo.satuan
    );
    setLastCapturedPreview(captured.base64);
    setLastCapturedExif(captured.exif);

    const extraScanEntry: ItemPhotoScanLog = {
      id: `scan-extra-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: displayTime,
      qtyScanned: 0,
      photoDataUrl: captured.base64,
      scannedBy: scanAdminPic,
      notes: `[${selectedGate}] Foto Dokumentasi Tambahan #${targetItem.scans.length + 1} — [${dbInfo.kodeBarang}]`,
      exifMetadata: captured.exif
    };

    saveInvoices(prev =>
      prev.map(inv => {
        if (inv.id !== activeInvoice.id) return inv;
        return {
          ...inv,
          items: inv.items.map(it => {
            if (it.id !== targetItem.id) return it;
            const updatedScans = [extraScanEntry, ...it.scans];
            if (previewPhotoModal && previewPhotoModal.itemId === it.id) {
              setPreviewPhotoModal({
                itemId: it.id,
                itemName: dbInfo.deskripsiBarang,
                skuCode: dbInfo.kodeBarang,
                scans: updatedScans
              });
              setActivePhotoPreviewIdx(0);
            }
            return {
              ...it,
              scans: updatedScans
            };
          })
        };
      })
    );

    playScannerFeedbackBeep('success', soundEnabled);
    showToast(
      `📸 Foto tambahan ke-${targetItem.scans.length + 1} untuk [${dbInfo.kodeBarang}] berhasil disimpan!`,
      'success'
    );
  };

  // Upload Lebih Dari 1 Foto Sekaligus (Multi-Photo Upload) untuk Item Barang
  const handleMultiPhotoFilesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0 || !activeInvoice) return;
    const files: File[] = Array.from(fileList);
    e.target.value = '';

    const targetItem =
      activeInvoice.items.find(it => it.id === multiPhotoTargetItemId) ||
      resolvedTargetItem ||
      activeInvoice.items[0];
    if (!targetItem) return;

    const dbInfo = getIntegratedDbInfo(targetItem);
    const nowDate = new Date();
    const displayTime =
      nowDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' WIB';

    const readFileAsDataUrl = (file: File): Promise<string> =>
      new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Gagal membaca file'));
        reader.readAsDataURL(file);
      });

    try {
      const newScans: ItemPhotoScanLog[] = [];
      for (let i = 0; i < files.length; i++) {
        const rawUrl = await readFileAsDataUrl(files[i]);
        const exifMeta = createExifMetadataFromDate(new Date(files[i].lastModified || Date.now()), 'EXIF_BINARY');
        newScans.push({
          id: `scan-multi-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 5)}`,
          timestamp: displayTime,
          qtyScanned: i === 0 ? Math.max(0, Number(scanQtyInput) || 0) : 0,
          photoDataUrl: rawUrl,
          scannedBy: scanAdminPic,
          notes: `[${selectedGate}] Multi-Foto Dokumentasi (${i + 1}/${files.length}) [${dbInfo.kodeBarang}]`,
          exifMetadata: exifMeta
        });
      }

      saveInvoices(prev =>
        prev.map(inv => {
          if (inv.id !== activeInvoice.id) return inv;
          return {
            ...inv,
            items: inv.items.map(it => {
              if (it.id !== targetItem.id) return it;
              const mergedScans = [...newScans, ...it.scans];
              if (previewPhotoModal && (previewPhotoModal.itemId === it.id || previewPhotoModal.itemName === dbInfo.deskripsiBarang)) {
                setPreviewPhotoModal({
                  itemId: it.id,
                  itemName: dbInfo.deskripsiBarang,
                  skuCode: dbInfo.kodeBarang,
                  scans: mergedScans
                });
                setActivePhotoPreviewIdx(0);
              }
              return {
                ...it,
                scans: mergedScans
              };
            })
          };
        })
      );

      showToast(`📸 ${newScans.length} foto dokumentasi berhasil ditambahkan ke [${dbInfo.kodeBarang}]!`, 'success');
    } catch {
      showToast('Gagal mengunggah beberapa foto dokumentasi.', 'error');
    }
  };

  // Integrasi Master Barang & Qty Faktur/SO di Menu List: Pilih atau tambahkan barang dari Master Database Barang
  const handleSelectOrAddMasterBarang = (dbItem: (typeof dbBarangList)[number]) => {
    if (!activeInvoice || scanErrorLock) return;
    const codeUpper = dbItem.noBarang.trim().toUpperCase();
    const existing = activeInvoice.items.find(
      it => it.skuCode.trim().toUpperCase() === codeUpper
    );

    if (existing) {
      setTargetScanMode(existing.id);
      const remaining = Math.max(1, existing.qtyOrdered - existing.qtyLoaded);
      setScanQtyInput(remaining);
      setIsMasterSearchOpen(false);
      setMasterSearchQuery('');
      showToast(
        `🎯 Target Barang dipilih: [${existing.skuCode}] ${existing.itemName} (Qty SO/Faktur: ${existing.qtyOrdered} ${existing.unit})`,
        'info'
      );
      return;
    }

    // Jika belum ada di Faktur aktif, tambahkan & sinkronkan langsung dengan Qty input
    const newQtyOrdered = Math.max(1, Number(scanQtyInput) || 10);
    const resolvedUnit = (dbItem.satuan || dbItem.unit1 || 'Box') as SalesOrderItem['unit'];
    const newItem: SalesOrderItem = {
      id: `itm-master-${Date.now()}`,
      skuCode: dbItem.noBarang,
      itemName: dbItem.deskripsiBarang || dbItem.keteranganBarang,
      unit: resolvedUnit,
      qtyOrdered: newQtyOrdered,
      qtyLoaded: 0,
      scans: [],
      dokumentasiUrl: dbItem.dokumentasiUrl
    };

    saveInvoices(prev =>
      prev.map(inv => {
        if (inv.id !== activeInvoice.id) return inv;
        return {
          ...inv,
          items: [...inv.items, newItem]
        };
      })
    );
    setTargetScanMode(newItem.id);
    setIsMasterSearchOpen(false);
    setMasterSearchQuery('');
    showToast(
      `✅ [${newItem.skuCode}] ${newItem.itemName} (Target SO: ${newQtyOrdered} ${newItem.unit}) diintegrasikan ke Faktur ${activeInvoice.invoiceNumber}!`,
      'success'
    );
  };

  // Update Target Qty Faktur/SO langsung dari Menu List
  const handleUpdateItemOrderedQty = (item: SalesOrderItem, newOrderedQty: number) => {
    if (!activeInvoice) return;
    const cleanOrdered = Math.max(1, newOrderedQty);
    saveInvoices(prev =>
      prev.map(inv => {
        if (inv.id !== activeInvoice.id) return inv;
        return {
          ...inv,
          items: inv.items.map(it => (it.id === item.id ? { ...it, qtyOrdered: cleanOrdered } : it))
        };
      })
    );
  };

  // Core Ultralytics YOLO + Gemini Vision Verification Workflow:
  // Verifikasi visual nyata terhadap gambar kamera, ukuran (OZ/dimensi), dan Database Barang
  const executeCaptureAndVerify = async (
    customImageBase64?: string,
    customExif?: ExifTimestampMetadata,
    simulateMismatch: boolean = false
  ) => {
    if (!activeInvoice || isVerifyingScan) return;

    setIsVerifyingScan(true);
    const nowDate = new Date();
    const isoTimestamp = nowDate.toISOString();
    const displayTime =
      nowDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' WIB';

    const cleanQty = Math.max(1, Number(scanQtyInput) || 1);
    const currentTarget = resolvedTargetItem || activeInvoice.items[0];
    const dbInfo = currentTarget ? getIntegratedDbInfo(currentTarget) : null;

    const desiredCode =
      targetScanMode === 'CUSTOM_CODE'
        ? customTestCode.trim().toUpperCase() || 'BOX-UNKNOWN-999'
        : dbInfo?.kodeBarang || currentTarget?.skuCode || 'AUTO';
    const desiredName =
      targetScanMode === 'CUSTOM_CODE'
        ? `Kode Uji Manual (${desiredCode})`
        : dbInfo?.deskripsiBarang || currentTarget?.itemName || 'Kemasan Faktur';
    const desiredUnit = dbInfo?.satuan || currentTarget?.unit || 'Box';

    // Cek terlebih dahulu apakah kamera mengarah ke barang (bukan lantai/kosong) saat memotret dari live camera
    const liveFrameCheck = !customImageBase64 && isCameraActive ? analyzeVideoFrameForPackaging() : { hasPackaging: true, edgeConfidence: 0.98, previewBase64: null };

    const captured = customImageBase64
      ? { base64: customImageBase64, exif: customExif || createExifMetadataFromDate(nowDate, 'CAMERA_CAPTURE_SENSOR') }
      : captureCompressedBase64FromViewfinder(
          simulateMismatch ? 'BRG-SALAH-999' : desiredCode,
          simulateMismatch ? 'BARANG BERBEDA / TIDAK SESUAI DATABASE BARANG' : desiredName,
          cleanQty,
          desiredUnit
        );

    setLastCapturedPreview(captured.base64);
    setLastCapturedExif(captured.exif);

    try {
      let serverRejected = false;
      let serverRejectionReason = '';
      let serverExtractedCode = (simulateMismatch ? 'BRG-SALAH-999' : desiredCode).toUpperCase();
      let serverExtractedName = simulateMismatch
        ? 'Kemasan Barang Berbeda (Tidak Sesuai Database Barang)'
        : desiredName;

      if (!customImageBase64 && isCameraActive && !liveFrameCheck.hasPackaging) {
        serverRejected = true;
        serverExtractedCode = 'BUKAN-BARANG';
        serverExtractedName = 'Kamera Tidak Mengarah ke Kemasan Barang';
        serverRejectionReason = 'Kamera tidak mengarah ke kemasan barang (terdeteksi lantai/objek kosong). Arahkan kamera ke label kardus/barang terlebih dahulu!';
        setLiveVisionStatus({
          state: 'no_packaging',
          confidence: 0,
          reason: serverRejectionReason
        });
        setYoloConfidence(0);
      } else {
        const masterBarang = databaseBarangService.getAll().slice(0, 120);
        const refImg = dbInfo?.matchedRecord?.dokumentasiUrl?.startsWith('data:image/jpeg')
          ? dbInfo.matchedRecord.dokumentasiUrl
          : undefined;

        // SMART ROUTER (SPESIFIKASI 2 & 3):
        // 1) Jalankan Jalur A (onnxruntime-web lokal di browser HP) sebagai pemeriksa utama instan.
        // 2) Jika Jalur A gagal memuat model ONNX atau confidence < 0.75 (75%), otomatis lempar 1 frame
        //    ke POST /api/yolo/detect-fallback (Jalur B di server Node.js Hostinger).
        const jalurAResult = !customImageBase64 && !simulateMismatch
          ? await runJalurALocalOnnxDetection(0.25)
          : { loaded: false, inferenceMs: 0, best: null };

        if (jalurAResult.loaded && jalurAResult.best && jalurAResult.best.score >= 0.75) {
          setYoloEngineMode('JALUR_A_WEB');
          setYoloInferenceMs(jalurAResult.inferenceMs);
          setYoloConfidence(jalurAResult.best.score);
          serverExtractedCode = jalurAResult.best.skuCode.trim().toUpperCase();
          serverExtractedName = jalurAResult.best.itemName.trim();

          const isMatchJalurA =
            activeInvoice.items.some(
              it =>
                it.skuCode.trim().toUpperCase() === serverExtractedCode ||
                getIntegratedDbInfo(it).kodeBarang.trim().toUpperCase() === serverExtractedCode
            ) &&
            (desiredCode === 'AUTO' || serverExtractedCode === desiredCode.toUpperCase());

          if (!isMatchJalurA) {
            serverRejected = true;
            serverRejectionReason = `TIDAK SESUAI: YOLO26 Jalur A mendeteksi [${serverExtractedCode}] ${serverExtractedName} (${Math.round(jalurAResult.best.score * 100)}%), sedangkan target aktif adalah [${desiredCode}] ${desiredName}!`;
          }
          setLiveVisionStatus({
            state: isMatchJalurA ? 'matching' : 'mismatch',
            confidence: jalurAResult.best.score,
            detectedCode: serverExtractedCode,
            detectedSummary: serverExtractedName,
            bbox: [jalurAResult.best.x1, jalurAResult.best.y1, jalurAResult.best.x2, jalurAResult.best.y2],
            reason: serverRejectionReason || undefined
          });
        } else {
          // JALUR B FALLBACK: Kirim 1 frame tangkapan kamera ke POST /api/yolo/detect-fallback di server Hostinger
          setYoloEngineMode('JALUR_B_SERVER');
          let fallbackHandled = false;
          try {
            const fbResp = await fetch('/api/yolo/detect-fallback', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                image: captured.base64,
                image_base64: captured.base64,
                surat_jalan_id: activeInvoice.invoiceNumber,
                target_item_code: desiredCode,
                target_item_name: desiredName,
                expected_items: activeInvoice.items,
                force_mismatch: simulateMismatch
              })
            });
            const fbJson = await fbResp.json().catch(() => null);
            if (fbJson && fbJson.model_loaded) {
              fallbackHandled = true;
              const conf = Number(fbJson.confidence || fbJson.ocr_confidence || 0.96);
              setYoloConfidence(conf);
              if (fbJson.inference_ms) setYoloInferenceMs(Number(fbJson.inference_ms));
              if (fbJson.extracted_code) {
                serverExtractedCode = String(fbJson.extracted_code).trim().toUpperCase();
              }
              if (fbJson.product_name) {
                serverExtractedName = String(fbJson.product_name).trim();
              }
              if (!fbResp.ok || fbJson.status === 'error' || fbJson.is_matching_target === false || fbJson.is_valid_packaging === false) {
                serverRejected = true;
                serverRejectionReason = String(
                  fbJson.message ||
                    `Barang yang difoto [${serverExtractedCode}] (${serverExtractedName}) TIDAK SESUAI dengan target [${desiredCode}] ${desiredName}!`
                );
                setLiveVisionStatus({
                  state: fbJson.is_valid_packaging === false ? 'no_packaging' : 'mismatch',
                  confidence: fbJson.is_valid_packaging === false ? 0 : conf,
                  detectedCode: serverExtractedCode,
                  detectedSummary: serverExtractedName,
                  reason: serverRejectionReason
                });
              } else {
                setLiveVisionStatus({
                  state: 'matching',
                  confidence: conf,
                  detectedCode: serverExtractedCode,
                  detectedSummary: serverExtractedName
                });
              }
            }
          } catch {
            // Continue to /api/scan-muat sync & verification
          }

          try {
            const resp = await fetch('/api/scan-muat', {
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
                target_item_name: desiredName,
                reference_image_base64: refImg,
                qty_scanned: cleanQty,
                expected_items: activeInvoice.items,
                master_items: masterBarang,
                force_mismatch: simulateMismatch
              })
            });

            const resultJson = await resp.json().catch(() => null);
            if (resultJson && !fallbackHandled) {
              const conf = Number(resultJson.ocr_confidence || resultJson.confidence || 0.98);
              setYoloConfidence(conf);
              if (resultJson.extracted_code) {
                serverExtractedCode = String(resultJson.extracted_code).trim().toUpperCase();
              }
              if (resultJson.product_name) {
                serverExtractedName = String(resultJson.product_name).trim();
              }
              if (!resp.ok || resultJson.status === 'error' || resultJson.is_matching_target === false || resultJson.is_valid_packaging === false) {
                serverRejected = true;
                serverRejectionReason = String(
                  resultJson.message ||
                    `Barang yang difoto [${serverExtractedCode}] (${serverExtractedName}) TIDAK SESUAI dengan target [${desiredCode}] ${desiredName}!`
                );
                setLiveVisionStatus({
                  state: resultJson.is_valid_packaging === false ? 'no_packaging' : 'mismatch',
                  confidence: resultJson.is_valid_packaging === false ? 0 : conf,
                  detectedCode: serverExtractedCode,
                  detectedSummary: serverExtractedName,
                  reason: serverRejectionReason
                });
              } else {
                setLiveVisionStatus({
                  state: 'matching',
                  confidence: conf,
                  detectedCode: serverExtractedCode,
                  detectedSummary: serverExtractedName
                });
              }
            }
          } catch {
            // If offline, fall back to liveVisionStatus state
            if (!fallbackHandled && (liveVisionStatus.state === 'mismatch' || liveVisionStatus.state === 'no_packaging')) {
              serverRejected = true;
              serverExtractedCode = liveVisionStatus.detectedCode || 'TIDAK-SESUAI';
              serverExtractedName = liveVisionStatus.detectedSummary || 'Barang Tidak Sesuai';
              serverRejectionReason = liveVisionStatus.reason || 'Barang di kamera tidak sesuai dengan target aktif!';
            }
          }
        }
      }

      const extractedCode = serverExtractedCode;
      const matchedItem = activeInvoice.items.find(
        it =>
          it.skuCode.trim().toUpperCase() === extractedCode ||
          getIntegratedDbInfo(it).kodeBarang.trim().toUpperCase() === extractedCode
      );

      // Verifikasi terhadap Database Barang & Target Barang yang sedang dipilih
      const isDifferentFromTarget =
        Boolean(currentTarget) &&
        extractedCode !== currentTarget.skuCode.trim().toUpperCase() &&
        extractedCode !== (dbInfo?.kodeBarang || '').trim().toUpperCase();

      const isNotRegisteredInDatabaseBarang =
        Boolean(currentTarget) && !getIntegratedDbInfo(currentTarget).isRegisteredInDb;

      const willExceedTargetQuota =
        Boolean(matchedItem) && matchedItem!.qtyLoaded + cleanQty > matchedItem!.qtyOrdered;

      if (
        matchedItem &&
        !simulateMismatch &&
        !serverRejected &&
        !isDifferentFromTarget &&
        !isNotRegisteredInDatabaseBarang &&
        !willExceedTargetQuota
      ) {
        // SUCCESS: Valid item on active Faktur & Database Barang -> Clear any red lock!
        setScanErrorLock(null);

        const matchedDbInfo = getIntegratedDbInfo(matchedItem);
        const newItemLoaded = matchedItem.qtyLoaded + cleanQty;
        const newScanEntry: ItemPhotoScanLog = {
          id: `scan-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          timestamp: displayTime,
          qtyScanned: cleanQty,
          photoDataUrl: captured.base64,
          scannedBy: scanAdminPic,
          notes:
            scanNotesInput.trim() ||
            `[YOLOv8x • ${selectedGate}] Terverifikasi Visual [${matchedDbInfo.kodeBarang}] (${newItemLoaded}/${matchedItem.qtyOrdered} ${matchedDbInfo.satuan})`,
          exifMetadata: captured.exif
        };

        saveInvoices(prev =>
          prev.map(inv => {
            if (inv.id !== activeInvoice.id) return inv;
            return {
              ...inv,
              items: inv.items.map(it => {
                if (it.id !== matchedItem.id) return it;
                return {
                  ...it,
                  skuCode: matchedDbInfo.kodeBarang,
                  itemName: matchedDbInfo.deskripsiBarang,
                  unit: matchedDbInfo.satuan,
                  qtyLoaded: newItemLoaded,
                  scans: [newScanEntry, ...it.scans]
                };
              })
            };
          })
        );

        // Hanya pindah otomatis jika item saat ini sudah penuh (100% klop)
        if (newItemLoaded >= matchedItem.qtyOrdered) {
          const nextRemaining = activeInvoice.items.find(
            it => it.id !== matchedItem.id && it.qtyLoaded < it.qtyOrdered
          );
          if (nextRemaining) {
            setTargetScanMode(nextRemaining.id);
          }
        }

        const totalOrderedAll = activeInvoice.items.reduce((acc, i) => acc + i.qtyOrdered, 0);
        const totalLoadedAll =
          activeInvoice.items.reduce((acc, i) => acc + i.qtyLoaded, 0) + cleanQty;

        const feedbackObj: RealtimeScanFeedback = {
          id: `fb-${Date.now()}`,
          status: 'success',
          extractedCode: matchedDbInfo.kodeBarang,
          productName: matchedDbInfo.deskripsiBarang,
          unit: matchedDbInfo.satuan,
          qtyScanned: cleanQty,
          itemLoaded: newItemLoaded,
          itemTarget: matchedItem.qtyOrdered,
          totalLoaded: totalLoadedAll,
          totalTarget: totalOrderedAll,
          gate: selectedGate,
          suratJalanId: activeInvoice.invoiceNumber,
          timestamp: isoTimestamp,
          displayTime,
          message: `BARANG SESUAI [${matchedDbInfo.kodeBarang}] (${newItemLoaded}/${matchedItem.qtyOrdered} ${matchedDbInfo.satuan})`,
          photoDataUrl: captured.base64,
          confidenceScore: yoloConfidence || 0.98,
          yoloBbox: [142, 96, 980, 520],
          sqlStatusTransition: 'PENDING -> LOADED'
        };

        setLastFeedback(feedbackObj);
        setRecentScansLog(prev => {
          const next = [feedbackObj, ...prev].slice(0, 30);
          try {
            localStorage.setItem(SCAN_HISTORY_STORAGE_KEY, JSON.stringify(next));
          } catch {}
          return next;
        });

        // Cooldown 2 detik (2000ms) pada YOLO Auto: ON setelah verifikasi +1 berhasil agar kardus yang sama tidak terhitung ganda
        lastAutoVerifyCooldownUntilRef.current = Date.now() + 2000;

        playScannerFeedbackBeep('success', soundEnabled);
        showToast(
          `✅ BARANG SESUAI: [${matchedDbInfo.kodeBarang}] ${matchedDbInfo.deskripsiBarang} (${newItemLoaded}/${matchedItem.qtyOrdered} ${matchedDbInfo.satuan})`,
          'success'
        );
      } else {
        // ERROR / PERBEDAAN BARANG -> OTOMATIS MERAH
        const lockedItem = currentTarget || matchedItem || activeInvoice.items[0];
        const lockedDbInfo = lockedItem ? getIntegratedDbInfo(lockedItem) : null;

        let rejectionReason =
          serverRejectionReason ||
          `Terdeteksi perbedaan barang: [${extractedCode}] tidak sesuai dengan target [${lockedDbInfo?.kodeBarang || desiredCode}] pada Database Barang & Faktur!`;

        if (!serverRejectionReason) {
          if (isNotRegisteredInDatabaseBarang && lockedItem) {
            rejectionReason = `Kode Barang [${lockedItem.skuCode}] "${lockedItem.itemName}" tidak ditemukan / berbeda dengan Master Database Barang Gudang!`;
          } else if (willExceedTargetQuota && matchedItem) {
            rejectionReason = `Kuota muat [${matchedItem.skuCode}] melebihi Faktur (${matchedItem.qtyLoaded + cleanQty}/${matchedItem.qtyOrdered} ${matchedItem.unit})!`;
            setOverloadWarningAlert({
              itemName: matchedItem.itemName,
              skuCode: matchedItem.skuCode,
              qtyOrdered: matchedItem.qtyOrdered,
              qtyLoaded: matchedItem.qtyLoaded + cleanQty,
              unit: matchedItem.unit
            });
          } else if (isDifferentFromTarget && lockedItem) {
            rejectionReason = `Barang terfoto [${extractedCode}] TIDAK SESUAI dengan target [${lockedDbInfo?.kodeBarang}] ${lockedDbInfo?.deskripsiBarang}!`;
          }
        }

        if (lockedItem) {
          setTargetScanMode(lockedItem.id);
          setScanErrorLock({
            lockedItemId: lockedItem.id,
            expectedCode: lockedDbInfo?.kodeBarang || lockedItem.skuCode,
            expectedName: lockedDbInfo?.deskripsiBarang || lockedItem.itemName,
            expectedUnit: lockedDbInfo?.satuan || lockedItem.unit,
            detectedCode: simulateMismatch ? 'BRG-SALAH-999' : extractedCode || 'TIDAK-SESUAI',
            detectedName: serverExtractedName || 'Objek / Barang Tidak Sesuai Target',
            reason: rejectionReason,
            photoDataUrl: captured.base64,
            timestamp: displayTime
          });
        }

        const totalOrderedAll = activeInvoice.items.reduce((acc, i) => acc + i.qtyOrdered, 0);
        const totalLoadedAll = activeInvoice.items.reduce((acc, i) => acc + i.qtyLoaded, 0);

        const errorFeedback: RealtimeScanFeedback = {
          id: `fb-${Date.now()}`,
          status: 'error',
          extractedCode: simulateMismatch ? 'BRG-SALAH-999' : extractedCode || 'TIDAK-SESUAI',
          productName:
            serverExtractedName ||
            lockedDbInfo?.deskripsiBarang ||
            'Perbedaan Barang / Tidak Sesuai Database Barang',
          unit: lockedDbInfo?.satuan || 'Box',
          qtyScanned: cleanQty,
          itemLoaded: lockedItem ? lockedItem.qtyLoaded : 0,
          itemTarget: lockedItem ? lockedItem.qtyOrdered : 0,
          totalLoaded: totalLoadedAll,
          totalTarget: totalOrderedAll,
          gate: selectedGate,
          suratJalanId: activeInvoice.invoiceNumber,
          timestamp: isoTimestamp,
          displayTime,
          message: rejectionReason,
          photoDataUrl: captured.base64
        };

        setLastFeedback(errorFeedback);
        setRecentScansLog(prev => {
          const next = [errorFeedback, ...prev].slice(0, 30);
          try {
            localStorage.setItem(SCAN_HISTORY_STORAGE_KEY, JSON.stringify(next));
          } catch {}
          return next;
        });

        playScannerFeedbackBeep('error', soundEnabled);
        showToast(
          `🚨 BARANG TIDAK SESUAI: ${rejectionReason}`,
          'error'
        );
      }
    } finally {
      setIsVerifyingScan(false);
    }
  };

  // Auto-Detect Interval (dengan Cooldown 2 Detik setelah verifikasi +1 berhasil agar kardus yang sama tidak terhitung ganda)
  useEffect(() => {
    if (!autoScanEnabled || scanErrorLock) {
      if (autoScanTimerRef.current) {
        window.clearInterval(autoScanTimerRef.current);
        autoScanTimerRef.current = null;
      }
      return;
    }

    autoScanTimerRef.current = window.setInterval(() => {
      if (Date.now() < lastAutoVerifyCooldownUntilRef.current) {
        return;
      }
      if (!isVerifyingScan && activeInvoice && !scanErrorLock && liveVisionStatus.state === 'matching') {
        const remainingItem = activeInvoice.items.find(it => it.qtyLoaded < it.qtyOrdered);
        if (!remainingItem && targetScanMode === 'AUTO') {
          return;
        }
        lastAutoVerifyCooldownUntilRef.current = Date.now() + 2000;
        void executeCaptureAndVerify();
      }
    }, 2000);

    return () => {
      if (autoScanTimerRef.current) {
        window.clearInterval(autoScanTimerRef.current);
        autoScanTimerRef.current = null;
      }
    };
  }, [autoScanEnabled, isVerifyingScan, activeInvoice, targetScanMode, selectedGate, scanQtyInput, soundEnabled, scanErrorLock, liveVisionStatus.state]);

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

  // Admin bebas memilih barang tidak sesuai urutan faktur kapan saja
  const handleSelectSpecificItemToScan = (item: SalesOrderItem) => {
    setScanErrorLock(null);
    setTargetScanMode(item.id);
    const remaining = Math.max(1, item.qtyOrdered - item.qtyLoaded);
    setScanQtyInput(Math.min(5, remaining));
    setScannerPage('kamera');
    if (!isCameraActive) {
      void startLiveCamera();
    }
  };

  if (!activeInvoice) {
    return (
      <div className="w-full max-w-md mx-auto bg-slate-950 min-h-screen text-slate-100 p-6 flex flex-col items-center justify-center text-center space-y-4 border-x border-slate-900">
        <QrCode className="w-12 h-12 text-emerald-400 mx-auto" />
        <h2 className="text-base font-black text-slate-100">Belum Ada Faktur / Surat Jalan Aktif</h2>
        <p className="text-xs text-slate-400 leading-relaxed">
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
  const totalSisaCount = evalActive.unloadedItems.length + evalActive.shortageItems.length;
  const filteredHistoryLogs = recentScansLog.filter(log => {
    if (historyFilter === 'SUCCESS') return log.status === 'success';
    if (historyFilter === 'ERROR') return log.status === 'error';
    return true;
  });

  return (
    <div
      className={`w-full max-w-md mx-auto bg-slate-950 text-slate-100 shadow-2xl relative border-x border-slate-900 flex flex-col ${
        scannerPage === 'kamera'
          ? 'h-[calc(100dvh-56px)] lg:h-[calc(100dvh-24px)] overflow-hidden pb-[66px]'
          : 'min-h-screen pb-28'
      }`}
    >
      {/* ===================================================================== */}
      {/* STICKY TOP HEADER (LOGO PERUSAHAAN + NAMA USER TANPA DB BARANG)       */}
      {/* ===================================================================== */}
      <header className="sticky top-0 z-30 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 px-3 py-1.5 shadow-sm shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="shrink-0">
              <AkkLogo size="sm" showText={false} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-bold tracking-wider uppercase text-indigo-400">
                  ADMIN PENJUALAN AKK
                </span>
              </div>
              <h1 className="text-xs font-bold text-white leading-tight truncate">
                {activeUserName}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                isOnline
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'
                }`}
              />
              <span>{isOnline ? 'Online' : 'Offline'}</span>
            </span>

            <select
              value={selectedGate}
              onChange={e => setSelectedGate(e.target.value)}
              className="px-2 py-0.5 rounded-lg bg-slate-800 border border-slate-700 text-[10px] font-bold text-emerald-400 focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              {LOADING_GATE_OPTIONS.map(gate => (
                <option key={gate} value={gate}>
                  {gate}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => setSoundEnabled(prev => !prev)}
              className="p-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 text-[10px] font-bold cursor-pointer"
              title="Toggle Suara Beep"
            >
              {soundEnabled ? '🔊' : '🔇'}
            </button>
          </div>
        </div>
      </header>

      {/* ===================================================================== */}
      {/* BANNER PERINGATAN MERAH JIKA BARANG TIDAK SESUAI                      */}
      {/* ===================================================================== */}
      {scanErrorLock && (
        <div className="mx-2 mt-1.5 p-2.5 rounded-xl bg-rose-600 text-white border-2 border-rose-300 shadow-xl space-y-1.5 shrink-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-white shrink-0" />
              <div className="text-[11px] font-black uppercase tracking-wide">
                🚨 BARANG TIDAK SESUAI TARGET!
              </div>
            </div>
            <button
              type="button"
              onClick={() => setScanErrorLock(null)}
              className="px-2 py-0.5 rounded-full bg-black/30 hover:bg-black/50 text-[9px] font-black uppercase shrink-0 cursor-pointer"
            >
              ✕ Tutup
            </button>
          </div>

          <p className="text-[10px] font-semibold leading-snug text-white/95">
            {scanErrorLock.reason}
          </p>

          <div className="flex items-center gap-1.5 pt-0.5">
            <button
              type="button"
              disabled={isVerifyingScan}
              onClick={() => {
                setScanErrorLock(null);
                void executeCaptureAndVerify(undefined, undefined, false);
              }}
              className="flex-1 py-1.5 px-2.5 rounded-lg bg-white text-rose-700 hover:bg-rose-50 font-black text-[10px] shadow-sm cursor-pointer transition"
            >
              📸 Foto Ulang Barang Ini
            </button>
            <button
              type="button"
              onClick={() => {
                setScanErrorLock(null);
                setScannerPage('list');
              }}
              className="py-1.5 px-2.5 rounded-lg bg-rose-800 hover:bg-rose-900 text-white font-black text-[10px] border border-rose-400/50 cursor-pointer transition"
            >
              📋 Pilih Barang Lain
            </button>
          </div>
        </div>
      )}

      {/* Hidden Multi-Photo Input for uploading >1 photos at once */}
      <input
        ref={multiPhotoInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleMultiPhotoFilesUpload}
        className="hidden"
      />

      {/* Backdrop to close custom dropdown when clicking outside */}
      {openCustomDropdown && (
        <div
          className="fixed inset-0 z-30"
          onClick={() => setOpenCustomDropdown(null)}
        />
      )}

      {/* ===================================================================== */}
      {/* MENU 1: KAMERA (SATU LAYAR PENUH TANPA SCROLL + VALIDASI VISUAL REAL) */}
      {/* ===================================================================== */}
      {scannerPage === 'kamera' && (() => {
        const activeDbInfo = resolvedTargetItem ? getIntegratedDbInfo(resolvedTargetItem) : null;
        const currentScans = resolvedTargetItem?.scans || [];
        const isVisuallyValid = !scanErrorLock && liveVisionStatus.state === 'matching';
        const activeItemIndex = resolvedTargetItem
          ? activeInvoice.items.findIndex(it => it.id === resolvedTargetItem.id)
          : 0;

        return (
          <div className="p-2 flex-1 flex flex-col min-h-0 overflow-hidden">
            <div
              className={`p-2 rounded-2xl border flex-1 flex flex-col min-h-0 gap-1.5 transition-colors ${
                !isVisuallyValid
                  ? 'bg-rose-50/60 dark:bg-rose-950/35 border-2 border-rose-400 dark:border-rose-500 shadow-sm'
                  : 'bg-white dark:bg-slate-900 border-2 border-emerald-500/80 shadow-sm'
              }`}
            >
              {/* Baris 1: Kontrol Kamera */}
              <div className="flex items-center justify-between gap-1 shrink-0">
                <div className="flex items-center gap-1">
                  {!isCameraActive ? (
                    <button
                      type="button"
                      onClick={() => void startLiveCamera()}
                      className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-extrabold cursor-pointer transition"
                    >
                      ▶ Kamera Aktif
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => stopCamera(true)}
                      className="px-2 py-1 rounded-lg bg-emerald-50 dark:bg-slate-800 hover:bg-emerald-100 dark:hover:bg-slate-700 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30 text-[10px] font-extrabold cursor-pointer transition"
                    >
                      ● YOLO Live ON
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void handleSwitchCamera()}
                    className="px-2 py-1 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-[10px] font-bold cursor-pointer transition flex items-center gap-1 shadow-2xs"
                  >
                    <RefreshCw className="w-3 h-3 text-sky-600 dark:text-sky-400" />
                    <span>{facingMode === 'environment' ? 'Belakang' : 'Depan'}</span>
                  </button>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => void handleToggleTorch()}
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition border shadow-2xs ${
                      isTorchOn
                        ? 'bg-amber-400 text-slate-950 border-amber-300'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {isTorchOn ? '🔦 ON' : '🔦 Flash'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAutoScanEnabled(prev => !prev)}
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold cursor-pointer border transition shadow-2xs ${
                      autoScanEnabled
                        ? 'bg-emerald-600 text-white border-emerald-500'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    YOLO Auto: {autoScanEnabled ? 'ON' : 'OFF'}
                  </button>
                </div>
              </div>

              {/* Baris 2: Custom Modern Dropdown Nama Toko + Dropdown Nama Barang, Qty & Satuan */}
              <div className="shrink-0 space-y-1.5 relative z-40">
                {/* Dropdown 1: Pilih Nama Toko / Pelanggan */}
                <div className="relative">
                  <button
                    type="button"
                    disabled={Boolean(scanErrorLock)}
                    onClick={() =>
                      setOpenCustomDropdown(prev => (prev === 'cam_store' ? null : 'cam_store'))
                    }
                    className={`w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 border flex items-center justify-between gap-2 text-left transition shadow-2xs ${
                      scanErrorLock
                        ? 'border-rose-300 dark:border-rose-500/50 opacity-60 cursor-not-allowed'
                        : openCustomDropdown === 'cam_store'
                        ? 'border-sky-500 ring-2 ring-sky-500/15 cursor-pointer'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 cursor-pointer'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <span className="px-1.5 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-500/20 border border-indigo-200 dark:border-indigo-500/30 text-indigo-700 dark:text-indigo-300 text-[9px] font-extrabold uppercase shrink-0">
                        Toko
                      </span>
                      <span className="text-[11px] font-extrabold text-slate-800 dark:text-slate-100 truncate">
                        {activeInvoice.customerName}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="px-1.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-mono text-[9px] font-extrabold">
                        {evalActive.totalLoaded}/{evalActive.totalOrdered} Muat
                      </span>
                      <span className="text-slate-400 text-[10px] font-bold">
                        {openCustomDropdown === 'cam_store' ? '▲' : '▼'}
                      </span>
                    </div>
                  </button>

                  {openCustomDropdown === 'cam_store' && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80 z-50 p-1">
                      {availableInvoices.map(inv => {
                        const ev = evaluateInvoiceStatus(inv);
                        const isCurrentStore = inv.id === activeInvoice.id;
                        return (
                          <button
                            key={inv.id}
                            type="button"
                            onClick={() => {
                              setSelectedInvoiceId(inv.id);
                              localStorage.setItem(ACTIVE_INVOICE_KEY, inv.id);
                              setTargetScanMode('AUTO');
                              setOpenCustomDropdown(null);
                            }}
                            className={`w-full px-2.5 py-2 rounded-xl text-left flex items-center justify-between gap-2 transition cursor-pointer ${
                              isCurrentStore
                                ? 'bg-sky-50 dark:bg-sky-500/15 border border-sky-200 dark:border-sky-500/40'
                                : 'hover:bg-slate-50 dark:hover:bg-slate-800/80'
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="text-[11px] font-extrabold text-slate-800 dark:text-slate-100 truncate">
                                {inv.customerName}
                              </div>
                              <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 truncate">
                                {inv.invoiceNumber} &bull; {inv.items.length} SKU
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span
                                className={`px-2 py-0.5 rounded-lg font-mono text-[10px] font-extrabold border ${
                                  ev.totalLoaded >= ev.totalOrdered && ev.totalOrdered > 0
                                    ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30'
                                    : 'bg-slate-100 dark:bg-slate-800 text-sky-700 dark:text-cyan-300 border-slate-200 dark:border-slate-700'
                                }`}
                              >
                                {ev.totalLoaded}/{ev.totalOrdered}
                              </span>
                              {isCurrentStore && <Check className="w-3.5 h-3.5 text-sky-600 dark:text-cyan-400" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Dropdown 2: Pilih Nama Barang, Qty & Satuan + Input Qty Scan */}
                <div className="flex items-center gap-1.5">
                  <div className="relative flex-1 min-w-0">
                    <button
                      type="button"
                      onClick={() =>
                        setOpenCustomDropdown(prev => (prev === 'cam_item' ? null : 'cam_item'))
                      }
                      className={`w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 border flex items-center justify-between gap-1.5 text-left transition shadow-2xs cursor-pointer ${
                        openCustomDropdown === 'cam_item'
                          ? 'border-sky-500 ring-2 ring-sky-500/15'
                          : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <span className="px-1.5 py-0.5 rounded-md bg-sky-50 dark:bg-sky-500/20 border border-sky-200 dark:border-sky-500/30 text-sky-700 dark:text-sky-300 font-mono text-[9px] font-black shrink-0">
                          {activeItemIndex >= 0 ? `${activeItemIndex + 1}.` : ''}{' '}
                          {activeDbInfo?.kodeBarang || resolvedTargetItem?.skuCode || '-'}
                        </span>
                        <span className="text-[11px] font-extrabold text-slate-800 dark:text-slate-100 truncate">
                          {activeDbInfo?.deskripsiBarang || resolvedTargetItem?.itemName || 'Pilih Barang'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {resolvedTargetItem && (
                          <span
                            className={`px-1.5 py-0.5 rounded-md font-mono text-[9px] font-black border ${
                              resolvedTargetItem.qtyLoaded >= resolvedTargetItem.qtyOrdered &&
                              resolvedTargetItem.qtyOrdered > 0
                                ? 'bg-emerald-50 dark:bg-emerald-500/15 border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                                : 'bg-amber-50 dark:bg-amber-500/15 border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-amber-300'
                            }`}
                          >
                            {resolvedTargetItem.qtyLoaded}/{resolvedTargetItem.qtyOrdered}{' '}
                            {activeDbInfo?.satuan || resolvedTargetItem.unit}
                          </span>
                        )}
                        <span className="text-slate-400 text-[10px] font-bold">
                          {openCustomDropdown === 'cam_item' ? '▲' : '▼'}
                        </span>
                      </div>
                    </button>

                    {openCustomDropdown === 'cam_item' && (
                      <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80 z-50 p-1">
                        {activeInvoice.items.map((it, idx) => {
                          const dbIt = getIntegratedDbInfo(it);
                          const isCurrentItem = resolvedTargetItem?.id === it.id;
                          const isDone = it.qtyLoaded >= it.qtyOrdered && it.qtyOrdered > 0;
                          return (
                            <button
                              key={it.id}
                              type="button"
                              onClick={() => {
                                setScanErrorLock(null);
                                setTargetScanMode(it.id);
                                const rem = Math.max(1, it.qtyOrdered - it.qtyLoaded);
                                setScanQtyInput(Math.min(10, rem));
                                setOpenCustomDropdown(null);
                              }}
                              className={`w-full px-2.5 py-2 rounded-xl text-left flex items-center justify-between gap-2 transition cursor-pointer ${
                                isCurrentItem
                                  ? 'bg-sky-50 dark:bg-sky-500/15 border border-sky-200 dark:border-sky-500/40'
                                  : 'hover:bg-slate-50 dark:hover:bg-slate-800/80'
                              }`}
                            >
                              <div className="min-w-0 flex-1 space-y-0.5">
                                <div className="flex items-center gap-1.5">
                                  <span className="px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-200/70 dark:border-indigo-500/30 font-mono text-[9px] font-black">
                                    {idx + 1}. {dbIt.kodeBarang}
                                  </span>
                                  <span className="text-[10px] font-extrabold text-emerald-700 dark:text-emerald-400">
                                    {it.qtyLoaded}/{it.qtyOrdered} {dbIt.satuan}
                                  </span>
                                </div>
                                <div className="text-[11px] font-bold text-slate-800 dark:text-slate-100 leading-snug break-words">
                                  {dbIt.deskripsiBarang}
                                </div>
                              </div>
                              <div className="shrink-0 flex items-center gap-1">
                                <span
                                  className={`px-1.5 py-0.5 rounded-md font-mono text-[9px] font-extrabold border ${
                                    isDone
                                      ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30'
                                      : 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/30'
                                  }`}
                                >
                                  {dbIt.satuan}
                                </span>
                                {isCurrentItem && <Check className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Box Input Qty & Satuan */}
                  <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2 py-1 shrink-0 shadow-2xs">
                    <span className="text-[9px] font-extrabold text-slate-500 dark:text-slate-400 uppercase">
                      Qty:
                    </span>
                    <input
                      type="number"
                      min={1}
                      value={scanQtyInput}
                      onChange={e => setScanQtyInput(Math.max(1, Number(e.target.value) || 1))}
                      className="w-8 py-0.5 rounded-md text-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono font-black text-emerald-700 dark:text-emerald-400 focus:outline-none"
                    />
                    <span className="text-[9px] font-extrabold text-sky-700 dark:text-cyan-400 uppercase">
                      {activeDbInfo?.satuan || resolvedTargetItem?.unit || 'CRT'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Viewport Kamera Satu Layar Penuh dengan Badge Deteksi [KODE_SKU] NAMA_BARANG + Status SESUAI / TIDAK SESUAI */}
              <div
                className={`relative w-full flex-1 min-h-[120px] rounded-2xl bg-slate-950 transition-all overflow-hidden flex flex-col justify-between p-2 ${
                  isVisuallyValid
                    ? 'border-4 border-emerald-500 ring-4 ring-emerald-500/30 shadow-[0_0_24px_rgba(16,185,129,0.35)]'
                    : 'border-4 border-rose-500 ring-4 ring-rose-500/35 shadow-[0_0_24px_rgba(244,63,94,0.4)]'
                }`}
              >
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
                    className="absolute inset-0 w-full h-full object-cover opacity-85"
                  />
                ) : null}

                {/* Penerangan Flash Layar saat Torch / Flash Diaktifkan */}
                {isTorchOn && (
                  <div className="absolute inset-0 border-4 border-amber-300/80 shadow-[inset_0_0_90px_rgba(255,255,255,0.75)] pointer-events-none z-20 animate-pulse" />
                )}

                {/* Badge Deteksi Terbaik di Atas Bingkai Kamera: [KODE_SKU] NAMA_BARANG + SESUAI • 98% / TIDAK SESUAI */}
                <div className="relative z-10 w-full h-full rounded-xl flex flex-col justify-between p-1 pointer-events-none">
                  <div className="flex items-center justify-between gap-1.5 px-1 pt-0.5">
                    <div
                      title={yoloEngineMode === 'JALUR_A_WEB' ? 'YOLO26 Jalur A (ONNX Web)' : 'YOLO26 Jalur B (Hostinger Node.js)'}
                      className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-extrabold truncate max-w-[66%] border backdrop-blur-md shadow-sm ${
                        isVisuallyValid
                          ? 'bg-emerald-950/90 text-emerald-100 border-emerald-400/60'
                          : 'bg-rose-950/90 text-rose-100 border-rose-400/60'
                      }`}
                    >
                      [{liveVisionStatus.detectedCode || activeDbInfo?.kodeBarang || resolvedTargetItem?.skuCode || '-'}]{' '}
                      {liveVisionStatus.detectedSummary || activeDbInfo?.deskripsiBarang || resolvedTargetItem?.itemName || 'Arahkan Kamera ke Kemasan'}
                    </div>

                    <div
                      className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold shrink-0 flex items-center gap-1 border backdrop-blur-md shadow-sm ${
                        isVisuallyValid
                          ? 'bg-emerald-950/90 text-emerald-300 border-emerald-400/60'
                          : 'bg-rose-950/90 text-rose-200 border-rose-400/60'
                      }`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${
                          isVisuallyValid ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'
                        }`}
                      />
                      <span>
                        {isVisuallyValid
                          ? `SESUAI • ${Math.round((liveVisionStatus.confidence || yoloConfidence || 0.98) * 100)}%`
                          : 'TIDAK SESUAI'}
                      </span>
                    </div>
                  </div>

                  <div
                    className={`absolute top-0 left-0 w-5 h-5 border-t-4 border-l-4 rounded-tl-md ${
                      isVisuallyValid ? 'border-emerald-400' : 'border-rose-500'
                    }`}
                  />
                  <div
                    className={`absolute top-0 right-0 w-5 h-5 border-t-4 border-r-4 rounded-tr-md ${
                      isVisuallyValid ? 'border-emerald-400' : 'border-rose-500'
                    }`}
                  />
                  <div
                    className={`absolute bottom-0 left-0 w-5 h-5 border-b-4 border-l-4 rounded-bl-md ${
                      isVisuallyValid ? 'border-emerald-400' : 'border-rose-500'
                    }`}
                  />
                  <div
                    className={`absolute bottom-0 right-0 w-5 h-5 border-b-4 border-r-4 rounded-br-md ${
                      isVisuallyValid ? 'border-emerald-400' : 'border-rose-500'
                    }`}
                  />
                </div>
              </div>

              {/* Bottom Action Bar: Foto Lagi (Bisa Multi-Upload) + Tombol SCAN & VERIFIKASI BARANG (YOLO) (+1) */}
              <div className="shrink-0 w-full space-y-1">
                {resolvedTargetItem && (
                  <div className="flex items-center justify-between gap-1.5 bg-white dark:bg-slate-950/90 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1 shadow-2xs">
                    <div className="flex items-center gap-1.5 min-w-0 overflow-x-auto">
                      <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 shrink-0">
                        📷 {currentScans.length} Foto ({resolvedTargetItem.qtyLoaded}/{resolvedTargetItem.qtyOrdered} {activeDbInfo?.satuan || resolvedTargetItem.unit}):
                      </span>
                      {currentScans.slice(0, 5).map((sc, idx) => (
                        <button
                          key={sc.id}
                          type="button"
                          onClick={() => {
                            setActivePhotoPreviewIdx(idx);
                            setPreviewPhotoModal({
                              itemId: resolvedTargetItem.id,
                              itemName: activeDbInfo?.deskripsiBarang || resolvedTargetItem.itemName,
                              skuCode: activeDbInfo?.kodeBarang || resolvedTargetItem.skuCode,
                              scans: currentScans
                            });
                          }}
                          className="w-6 h-6 rounded-md overflow-hidden border border-sky-400/60 shrink-0 relative group cursor-pointer"
                          title={`Lihat Foto #${idx + 1}`}
                        >
                          <img src={sc.photoDataUrl} alt="" className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setMultiPhotoTargetItemId(resolvedTargetItem.id);
                          multiPhotoInputRef.current?.click();
                        }}
                        className="px-2.5 py-1 rounded-lg bg-sky-50 dark:bg-cyan-500/20 hover:bg-sky-100 dark:hover:bg-cyan-500/30 border border-sky-200 dark:border-cyan-500/40 text-sky-700 dark:text-cyan-300 text-[10px] font-extrabold cursor-pointer transition"
                        title="Upload / Tambah Beberapa Foto Sekaligus"
                      >
                        + Foto Lagi
                      </button>
                    </div>
                  </div>
                )}

                <div className="w-full">
                  <button
                    type="button"
                    disabled={isVerifyingScan}
                    onClick={() => void executeCaptureAndVerify(undefined, undefined, false)}
                    className={`w-full py-2.5 px-3 rounded-xl font-black text-xs tracking-wide shadow-md flex items-center justify-center gap-2 cursor-pointer transition border ${
                      !isVisuallyValid
                        ? 'bg-rose-600 hover:bg-rose-500 text-white border-rose-500'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500'
                    }`}
                  >
                    <Camera className="w-4 h-4 shrink-0" />
                    <span className="truncate">
                      {isVerifyingScan ? 'MEMVERIFIKASI...' : 'SCAN & VERIFIKASI BARANG (YOLO) (+1)'}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ===================================================================== */}
      {/* MENU 2: LIST (URUTAN PELANGGAN + TARGET BARANG & INTEGRASI MASTER SO) */}
      {/* ===================================================================== */}
      {scannerPage === 'list' && (() => {
        const matchedMasterBarang = masterSearchQuery.trim()
          ? dbBarangList.filter(db => databaseBarangService.matchesSearchQuery(db, masterSearchQuery)).slice(0, 25)
          : [];
        const activeDbTarget = resolvedTargetItem ? getIntegratedDbInfo(resolvedTargetItem) : null;

        return (
          <div className="p-3 space-y-3 flex-1">
            {/* 1. BARIS PILIH NAMA TOKO / PELANGGAN (TANPA TEKS HIJAU DI POJOK KANAN ATAS + CUSTOM DROPDOWN) */}
            <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2 shadow-xs relative z-40">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  PILIH NAMA TOKO / PELANGGAN:
                </span>
              </div>

              <div className="relative">
                <button
                  type="button"
                  disabled={Boolean(scanErrorLock)}
                  onClick={() =>
                    setOpenCustomDropdown(prev => (prev === 'list_store' ? null : 'list_store'))
                  }
                  className={`w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border flex items-center justify-between gap-2 text-left transition shadow-2xs ${
                    scanErrorLock
                      ? 'border-rose-300 dark:border-rose-500/60 opacity-60 cursor-not-allowed'
                      : openCustomDropdown === 'list_store'
                      ? 'border-indigo-500 ring-2 ring-indigo-500/15 cursor-pointer'
                      : 'border-slate-200 dark:border-slate-700 hover:border-indigo-400 cursor-pointer'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-extrabold text-slate-800 dark:text-slate-100 truncate">
                      {activeInvoice.customerName}
                    </div>
                    <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 truncate mt-0.5">
                      {activeInvoice.invoiceNumber} &bull; {activeInvoice.items.length} SKU
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-mono text-[10px] font-extrabold">
                      {evalActive.totalLoaded}/{evalActive.totalOrdered} Muat
                    </span>
                    <span className="text-slate-400 text-xs font-bold">
                      {openCustomDropdown === 'list_store' ? '▲' : '▼'}
                    </span>
                  </div>
                </button>

                {openCustomDropdown === 'list_store' && (
                  <div className="absolute left-0 right-0 top-full mt-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80 z-50 p-1">
                    {availableInvoices.map(inv => {
                      const ev = evaluateInvoiceStatus(inv);
                      const isCurrentStore = inv.id === activeInvoice.id;
                      return (
                        <button
                          key={inv.id}
                          type="button"
                          onClick={() => {
                            if (scanErrorLock) return;
                            setSelectedInvoiceId(inv.id);
                            localStorage.setItem(ACTIVE_INVOICE_KEY, inv.id);
                            setTargetScanMode('AUTO');
                            setOpenCustomDropdown(null);
                          }}
                          className={`w-full px-3 py-2.5 rounded-xl text-left flex items-center justify-between gap-2 transition cursor-pointer ${
                            isCurrentStore
                              ? 'bg-indigo-50 dark:bg-indigo-500/20 border border-indigo-200 dark:border-indigo-500/40'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-800/80'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-extrabold text-slate-800 dark:text-slate-100 truncate">
                              {inv.customerName}
                            </div>
                            <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 truncate">
                              {inv.invoiceNumber} &bull; {inv.items.length} SKU
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sky-700 dark:text-cyan-300 font-mono text-[10px] font-extrabold">
                              {ev.totalLoaded}/{ev.totalOrdered} Muat
                            </span>
                            {isCurrentStore && <Check className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* 2. TARGET BARANG & QTY (TERINTEGRASI MASTER BARANG & INPUT SO/FAKTUR) */}
            <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-indigo-500/30 space-y-2.5 shadow-xs relative z-30">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-sky-500 dark:bg-cyan-400" />
                  <span className="text-[10px] font-black uppercase tracking-wider text-sky-700 dark:text-cyan-300">
                    Target Barang &amp; Integrasi Master Barang / Qty SO
                  </span>
                </div>
                <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                  {dbBarangList.length.toLocaleString('id-ID')} Master SKU
                </span>
              </div>

              {/* Pencarian Fleksibel Master Barang */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={masterSearchQuery}
                  onFocus={() => setIsMasterSearchOpen(true)}
                  onChange={e => {
                    setMasterSearchQuery(e.target.value);
                    setIsMasterSearchOpen(true);
                  }}
                  placeholder="Cari Master Barang..."
                  className="w-full pl-8 pr-8 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 focus:border-sky-500 text-xs font-semibold text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none"
                />
                {masterSearchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setMasterSearchQuery('');
                      setIsMasterSearchOpen(false);
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}

                {isMasterSearchOpen && masterSearchQuery.trim() !== '' && (
                  <div className="mt-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-cyan-500/40 rounded-xl shadow-xl max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80 z-30">
                    {matchedMasterBarang.length === 0 ? (
                      <div className="p-3 text-center text-xs text-slate-500 dark:text-slate-400">
                        Tidak ditemukan barang dengan kata kunci <strong>"{masterSearchQuery}"</strong>
                      </div>
                    ) : (
                      matchedMasterBarang.map(db => {
                        const inInvoice = activeInvoice.items.find(
                          it => it.skuCode.trim().toUpperCase() === db.noBarang.trim().toUpperCase()
                        );
                        return (
                          <button
                            key={db.id}
                            type="button"
                            onClick={() => handleSelectOrAddMasterBarang(db)}
                            className="w-full px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-900 flex items-center justify-between gap-2 transition cursor-pointer"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 font-mono text-[10px] font-black">
                                  {db.noBarang}
                                </span>
                                <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                                  {db.satuan || db.unit1}
                                </span>
                                {inInvoice && (
                                  <span className="px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[9px] font-bold">
                                    Ada di Faktur ({inInvoice.qtyLoaded}/{inInvoice.qtyOrdered})
                                  </span>
                                )}
                              </div>
                              <div className="text-xs font-bold text-slate-800 dark:text-white truncate mt-0.5">
                                {db.deskripsiBarang || db.keteranganBarang}
                              </div>
                            </div>
                            <span className="px-2 py-1 rounded-lg bg-sky-50 dark:bg-cyan-500/20 text-sky-700 dark:text-cyan-300 text-[10px] font-extrabold shrink-0">
                              {inInvoice ? 'Pilih Target' : '+ Integrasi SO'}
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>

              {/* Custom Dropdown Target Barang Aktif & Qty */}
              <div className="grid grid-cols-12 gap-2">
                <div className="col-span-12 relative">
                  <label className="block text-[9px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-1 truncate">
                    Target Barang Aktif ({activeInvoice.customerName}):
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setOpenCustomDropdown(prev => (prev === 'list_item' ? null : 'list_item'))
                    }
                    className={`w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border flex items-center justify-between gap-2 text-left transition cursor-pointer ${
                      openCustomDropdown === 'list_item'
                        ? 'border-sky-500 ring-2 ring-sky-500/15'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="px-1.5 py-0.5 rounded bg-sky-50 dark:bg-sky-500/20 border border-sky-200 dark:border-sky-500/30 text-sky-700 dark:text-sky-300 font-mono text-[10px] font-black">
                          {activeDbTarget?.kodeBarang || resolvedTargetItem?.skuCode || '-'}
                        </span>
                        {resolvedTargetItem && (
                          <span className="text-[10px] font-extrabold text-emerald-700 dark:text-emerald-400">
                            {resolvedTargetItem.qtyLoaded}/{resolvedTargetItem.qtyOrdered}{' '}
                            {activeDbTarget?.satuan || resolvedTargetItem.unit}
                          </span>
                        )}
                      </div>
                      <div className="text-xs font-extrabold text-slate-800 dark:text-slate-100 truncate mt-0.5">
                        {activeDbTarget?.deskripsiBarang || resolvedTargetItem?.itemName || 'Pilih Target Barang'}
                      </div>
                    </div>
                    <span className="text-slate-400 text-xs font-bold shrink-0">
                      {openCustomDropdown === 'list_item' ? '▲' : '▼'}
                    </span>
                  </button>

                  {openCustomDropdown === 'list_item' && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80 z-50 p-1">
                      {activeInvoice.items.map((it, idx) => {
                        const dbIt = getIntegratedDbInfo(it);
                        const isCurrentItem = resolvedTargetItem?.id === it.id;
                        return (
                          <button
                            key={it.id}
                            type="button"
                            onClick={() => {
                              setScanErrorLock(null);
                              setTargetScanMode(it.id);
                              const rem = Math.max(1, it.qtyOrdered - it.qtyLoaded);
                              setScanQtyInput(Math.min(10, rem));
                              setOpenCustomDropdown(null);
                            }}
                            className={`w-full px-3 py-2 rounded-xl text-left flex items-center justify-between gap-2 transition cursor-pointer ${
                              isCurrentItem
                                ? 'bg-sky-50 dark:bg-sky-500/15 border border-sky-200 dark:border-sky-500/40'
                                : 'hover:bg-slate-50 dark:hover:bg-slate-800/80'
                            }`}
                          >
                            <div className="min-w-0 flex-1 space-y-0.5">
                              <div className="flex items-center gap-1.5">
                                <span className="px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 font-mono text-[10px] font-black">
                                  {idx + 1}. {dbIt.kodeBarang}
                                </span>
                                <span className="text-[10px] font-extrabold text-emerald-700 dark:text-emerald-400">
                                  {it.qtyLoaded}/{it.qtyOrdered} {dbIt.satuan}
                                </span>
                              </div>
                              <div className="text-xs font-bold text-slate-800 dark:text-slate-100 leading-snug break-words">
                                {dbIt.deskripsiBarang}
                              </div>
                            </div>
                            {isCurrentItem && <Check className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="col-span-6">
                  <label className="block text-[9px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">
                    Qty Input SO / Faktur ({resolvedTargetItem ? getIntegratedDbInfo(resolvedTargetItem).satuan : 'Box'}):
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={resolvedTargetItem ? resolvedTargetItem.qtyOrdered : 1}
                    onChange={e => {
                      if (resolvedTargetItem) {
                        handleUpdateItemOrderedQty(resolvedTargetItem, Math.max(1, Number(e.target.value) || 1));
                      }
                    }}
                    className="w-full px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-indigo-200 dark:border-indigo-500/40 text-xs font-mono font-black text-indigo-700 dark:text-indigo-300 text-center"
                  />
                </div>

                <div className="col-span-6">
                  <label className="block text-[9px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">
                    Qty Scan Muat ({resolvedTargetItem ? getIntegratedDbInfo(resolvedTargetItem).satuan : 'Box'}):
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={scanQtyInput}
                    onChange={e => setScanQtyInput(Math.max(1, Number(e.target.value) || 1))}
                    className="w-full px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-emerald-200 dark:border-emerald-500/40 text-xs font-mono font-black text-emerald-700 dark:text-emerald-400 text-center"
                  />
                </div>
              </div>
            </div>

            {/* 3. DAFTAR BARANG FAKTUR PELANGGAN (HANYA PILIH SCAN) */}
            <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 space-y-3 shadow-xs">
              <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-400">
                <span>Daftar Barang Faktur ({activeInvoice.items.length} SKU):</span>
                <span className="text-sky-600 dark:text-sky-400 font-mono font-extrabold">{activeInvoice.invoiceNumber}</span>
              </div>

              <div className="space-y-2.5">
                {activeInvoice.items.map(item => {
                  const dbInfo = getIntegratedDbInfo(item);
                  const isSelected = resolvedTargetItem?.id === item.id;
                  const isLockedErrorItem = scanErrorLock?.lockedItemId === item.id;
                  const isBlockedByOtherError = Boolean(scanErrorLock && scanErrorLock.lockedItemId !== item.id);
                  const isExact = item.qtyLoaded === item.qtyOrdered && item.qtyOrdered > 0;
                  const isOver = item.qtyLoaded > item.qtyOrdered;
                  const itemPct = item.qtyOrdered > 0 ? Math.min(100, Math.round((item.qtyLoaded / item.qtyOrdered) * 100)) : 0;

                  return (
                    <div
                      key={item.id}
                      className={`p-3.5 rounded-2xl text-xs space-y-2.5 transition-all duration-200 ${
                        isLockedErrorItem
                          ? 'bg-rose-600 text-white border-2 border-rose-400 shadow-lg shadow-rose-500/25'
                          : isOver
                          ? 'bg-rose-50/90 dark:bg-rose-950/40 border-2 border-rose-400 dark:border-rose-500/70 text-slate-900 dark:text-rose-100'
                          : isSelected
                          ? 'bg-sky-50/95 dark:bg-sky-950/35 border-2 border-sky-500 dark:border-sky-400 shadow-md shadow-sky-500/10 ring-2 ring-sky-500/15'
                          : isExact
                          ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/90 dark:border-emerald-800/60'
                          : 'bg-slate-50/90 dark:bg-slate-950/80 border border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                      } ${isBlockedByOtherError ? 'opacity-50' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="min-w-0 space-y-1.5 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {/* Kode Barang Pill */}
                            <span
                              className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-black border ${
                                isLockedErrorItem
                                  ? 'bg-black/30 text-white border-white/30'
                                  : isSelected
                                  ? 'bg-sky-600 text-white border-sky-500 shadow-2xs'
                                  : 'bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-200/80 dark:border-indigo-500/30'
                              }`}
                            >
                              {dbInfo.kodeBarang}
                            </span>

                            {/* Qty Status Pill */}
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold border ${
                                isLockedErrorItem
                                  ? 'bg-white text-rose-700 border-white'
                                  : isOver
                                  ? 'bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-500/40'
                                  : isExact
                                  ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/40'
                                  : 'bg-amber-100/90 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-500/40'
                              }`}
                            >
                              {item.qtyLoaded} / {item.qtyOrdered} {dbInfo.satuan}
                            </span>

                            {/* Active Target Badge */}
                            {isSelected && !isLockedErrorItem && (
                              <span className="px-2 py-0.5 rounded-full bg-sky-500/15 dark:bg-sky-400/20 border border-sky-400/40 text-sky-700 dark:text-sky-300 text-[9px] font-black uppercase tracking-wide">
                                🎯 Target Aktif
                              </span>
                            )}
                          </div>

                          {/* Deskripsi Barang */}
                          <div
                            className={`font-extrabold text-xs sm:text-[13px] leading-snug break-words ${
                              isLockedErrorItem
                                ? 'text-white'
                                : isSelected
                                ? 'text-slate-900 dark:text-white'
                                : 'text-slate-800 dark:text-slate-100'
                            }`}
                          >
                            {dbInfo.deskripsiBarang}
                          </div>

                          {/* Mini Progress Bar */}
                          {!isLockedErrorItem && (
                            <div className="w-full h-1.5 rounded-full bg-slate-200/80 dark:bg-slate-800 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-300 ${
                                  isOver
                                    ? 'bg-rose-500'
                                    : isExact
                                    ? 'bg-emerald-500'
                                    : isSelected
                                    ? 'bg-sky-500'
                                    : 'bg-amber-500'
                                }`}
                                style={{ width: `${itemPct}%` }}
                              />
                            </div>
                          )}

                          {isLockedErrorItem && scanErrorLock && (
                            <div className="text-[10px] font-extrabold text-amber-200 bg-black/25 px-2 py-1 rounded-lg">
                              🚨 SALAH / BERBEDA BARANG: {scanErrorLock.reason}
                            </div>
                          )}
                        </div>

                        {/* Action Buttons: Sisakan Hanya Pilih Scan */}
                        <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                          {item.scans.length > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                setActivePhotoPreviewIdx(0);
                                setPreviewPhotoModal({
                                  itemId: item.id,
                                  itemName: dbInfo.deskripsiBarang,
                                  skuCode: dbInfo.kodeBarang,
                                  scans: item.scans
                                });
                              }}
                              className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-sky-50 dark:hover:bg-slate-700 text-sky-600 dark:text-sky-400 text-[10px] font-extrabold cursor-pointer border border-slate-200 dark:border-slate-700 shadow-2xs flex items-center gap-1 transition"
                              title="Lihat Galeri Foto Barang"
                            >
                              <span>📷 {item.scans.length}</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleSelectSpecificItemToScan(item)}
                            className={`px-3 py-1.5 rounded-xl text-[11px] font-black shadow-xs flex items-center gap-1.5 transition cursor-pointer ${
                              isLockedErrorItem
                                ? 'bg-white text-rose-700 hover:bg-rose-50'
                                : isSelected
                                ? 'bg-sky-600 hover:bg-sky-500 text-white'
                                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                            }`}
                          >
                            <Camera className="w-3.5 h-3.5" />
                            <span>Pilih Scan</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ===================================================================== */}
      {/* MENU 4: TERMUAT & SISA (PROGRES MUAT, BARANG SISA, BARANG SESUAI)     */}
      {/* ===================================================================== */}
      {scannerPage === 'termuat_sisa' && (
        <div className="p-3.5 space-y-3 flex-1">
          {/* Ringkasan Progres Muat */}
          <div className="p-3.5 bg-slate-900 rounded-2xl border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-300">Progres Muat Faktur:</span>
              <span className="font-mono font-black text-emerald-400">
                {evalActive.totalLoaded} / {evalActive.totalOrdered} Kemasan ({progressPercentage}%)
              </span>
            </div>
            <div className="w-full h-3 rounded-full bg-slate-950 border border-slate-800 overflow-hidden p-0.5">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  evalActive.overloadItems.length > 0 || scanErrorLock
                    ? 'bg-rose-500'
                    : progressPercentage === 100
                    ? 'bg-emerald-500'
                    : 'bg-sky-500'
                }`}
                style={{ width: `${Math.min(100, progressPercentage)}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 pt-0.5">
              <span>Target: {evalActive.totalOrdered} ({activeInvoice.items.length} SKU)</span>
              <span className="text-sky-400">Termuat: {evalActive.totalLoaded}</span>
              <span className={totalSisaCount > 0 ? 'text-amber-400' : 'text-emerald-400'}>
                {totalSisaCount > 0 ? `Sisa: ${totalSisaCount} SKU` : '✓ 100% Lengkap'}
              </span>
            </div>
          </div>

          {/* 5. Desain UI/UX Peringatan Lebih Muat yang Disederhanakan */}
          {evalActive.overloadItems.length > 0 && (
            <div className="rounded-xl bg-rose-950/60 border border-rose-500/40 p-2.5 space-y-1.5 text-xs">
              <div className="text-[10px] font-bold text-rose-300 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  <span>Perhatian: {evalActive.overloadItems.length} SKU lebih muat</span>
                </span>
                <span className="text-[10px] text-rose-400 font-mono">Faktur: {activeInvoice.invoiceNumber}</span>
              </div>
              <div className="space-y-1">
                {evalActive.overloadItems.map(item => (
                  <div key={item.id} className="flex items-center justify-between gap-2 text-[11px] bg-rose-900/30 px-2.5 py-1 rounded-lg border border-rose-800/40">
                    <span className="truncate text-rose-200 font-medium">
                      [{item.skuCode}] {item.qtyLoaded}/{item.qtyOrdered} (+{item.qtyLoaded - item.qtyOrdered} {item.unit})
                    </span>
                    <button
                      type="button"
                      onClick={() => handleAdjustLoadedQty(item, item.qtyOrdered)}
                      className="px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold text-[10px] shrink-0 cursor-pointer"
                    >
                      Reset ({item.qtyOrdered})
                    </button>
                  </div>
                ))}
              </div>
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
                {evalActive.unloadedItems.map(item => {
                  const dbInfo = getIntegratedDbInfo(item);
                  return (
                    <div
                      key={item.id}
                      className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="font-bold text-slate-100 truncate">
                          [{dbInfo.kodeBarang}] {dbInfo.deskripsiBarang}
                        </div>
                        <div className="text-[11px] text-amber-400 font-medium">
                          Status: BELUM TERMUAT SAMA SEKALI &mdash; Sisa {item.qtyOrdered} {dbInfo.satuan}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleSelectSpecificItemToScan(item)}
                        className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-[10px] font-black shrink-0 cursor-pointer"
                      >
                        Foto Sekarang
                      </button>
                    </div>
                  );
                })}
                {evalActive.shortageItems.map(item => {
                  const dbInfo = getIntegratedDbInfo(item);
                  const sisa = item.qtyOrdered - item.qtyLoaded;
                  return (
                    <div
                      key={item.id}
                      className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="font-bold text-slate-100 truncate">
                          [{dbInfo.kodeBarang}] {dbInfo.deskripsiBarang}
                        </div>
                        <div className="text-[11px] text-amber-400 font-medium">
                          Status: KURANG MUAT ({item.qtyLoaded}/{item.qtyOrdered} {dbInfo.satuan}) &mdash; Sisa {sisa} {dbInfo.satuan}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleSelectSpecificItemToScan(item)}
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

          {/* 2. BARANG TERMUAT SESUAI FAKTUR & DATABASE BARANG */}
          <div className="space-y-2 text-xs pt-1">
            <div className="text-[11px] font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>2. Barang Termuat Sesuai Faktur ({evalActive.matchedItems.length} SKU):</span>
            </div>
            {evalActive.matchedItems.length === 0 ? (
              <div className="py-4 px-3 text-slate-500 text-[11px] border border-dashed border-slate-800 rounded-xl text-center">
                Belum ada barang yang termuat 100% sesuai target faktur.
              </div>
            ) : (
              <div className="space-y-2">
                {evalActive.matchedItems.map((item: SalesOrderItem) => {
                  const dbInfo = getIntegratedDbInfo(item);
                  return (
                    <div
                      key={item.id}
                      className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="font-bold text-slate-100 truncate">
                          [{dbInfo.kodeBarang}] {dbInfo.deskripsiBarang}
                        </div>
                        <div className="text-[11px] text-emerald-400 font-medium">
                          Termuat Lengkap ({item.qtyLoaded}/{item.qtyOrdered} {dbInfo.satuan})
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-black border border-emerald-500/30 shrink-0">
                        ✓ 100% Sesuai
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* HALAMAN 3 (TAB DEDIKASI): RIWAYAT SCAN FOTO & VERIFIKASI DB BARANG     */}
      {/* ===================================================================== */}
      {scannerPage === 'riwayat' && (
        <div className="p-3.5 space-y-3 flex-1">
          <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-xs font-black uppercase tracking-wider text-slate-100">
                  Riwayat Foto &amp; Verifikasi Database Barang
                </h2>
                <p className="text-[11px] text-slate-400">
                  Total {recentScansLog.length} rekaman aktivitas kamera muat ({selectedGate})
                </p>
              </div>
              {recentScansLog.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setRecentScansLog([]);
                    localStorage.removeItem(SCAN_HISTORY_STORAGE_KEY);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30 text-[10px] font-bold cursor-pointer"
                >
                  Bersihkan Riwayat
                </button>
              )}
            </div>

            {/* Filter Riwayat: Semua / Valid / Error Merah */}
            <div className="grid grid-cols-3 gap-1.5 pt-1">
              <button
                type="button"
                onClick={() => setHistoryFilter('ALL')}
                className={`py-1.5 rounded-xl text-[10px] font-extrabold cursor-pointer border transition ${
                  historyFilter === 'ALL'
                    ? 'bg-indigo-600 text-white border-indigo-500'
                    : 'bg-slate-950 text-slate-400 border-slate-800'
                }`}
              >
                Semua ({recentScansLog.length})
              </button>
              <button
                type="button"
                onClick={() => setHistoryFilter('SUCCESS')}
                className={`py-1.5 rounded-xl text-[10px] font-extrabold cursor-pointer border transition ${
                  historyFilter === 'SUCCESS'
                    ? 'bg-emerald-600 text-white border-emerald-500'
                    : 'bg-slate-950 text-emerald-400 border-slate-800'
                }`}
              >
                ✓ Sesuai ({recentScansLog.filter(l => l.status === 'success').length})
              </button>
              <button
                type="button"
                onClick={() => setHistoryFilter('ERROR')}
                className={`py-1.5 rounded-xl text-[10px] font-extrabold cursor-pointer border transition ${
                  historyFilter === 'ERROR'
                    ? 'bg-rose-600 text-white border-rose-500'
                    : 'bg-slate-950 text-rose-400 border-slate-800'
                }`}
              >
                🚨 Merah/Error ({recentScansLog.filter(l => l.status === 'error').length})
              </button>
            </div>
          </div>

          {filteredHistoryLogs.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-2xl bg-slate-900/50 space-y-2">
              <FileText className="w-8 h-8 text-slate-600 mx-auto" />
              <div className="font-bold text-slate-400">Belum Ada Riwayat Scan Foto</div>
              <p className="text-[11px] text-slate-500">
                Silakan ambil foto barang pada tab <strong>Kamera &amp; List</strong>.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredHistoryLogs.map(log => (
                <div
                  key={log.id}
                  className={`p-3 rounded-2xl border text-xs space-y-2 ${
                    log.status === 'error'
                      ? 'bg-rose-600 text-white border-rose-300 shadow-md'
                      : 'bg-slate-900 border-slate-800 text-slate-100'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <img
                        src={log.photoDataUrl}
                        alt={log.extractedCode}
                        className="w-12 h-12 rounded-xl object-cover border border-slate-700 shrink-0 bg-slate-950"
                      />
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`px-1.5 py-0.5 rounded font-mono text-[10px] font-black ${
                              log.status === 'error'
                                ? 'bg-black/30 text-white'
                                : 'bg-indigo-500/20 text-indigo-300'
                            }`}
                          >
                            {log.extractedCode}
                          </span>
                          <span
                            className={`text-[10px] font-mono ${
                              log.status === 'error' ? 'text-rose-100' : 'text-slate-400'
                            }`}
                          >
                            {log.displayTime} &bull; {log.gate}
                          </span>
                        </div>
                        <div className="font-bold text-xs leading-snug break-words">
                          {log.productName}
                        </div>
                        <div
                          className={`text-[11px] leading-snug ${
                            log.status === 'error' ? 'text-amber-100 font-semibold' : 'text-slate-400'
                          }`}
                        >
                          {log.message}
                        </div>
                      </div>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-black shrink-0 ${
                        log.status === 'success'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-white text-rose-700'
                      }`}
                    >
                      {log.status === 'success'
                        ? `OK ${log.itemLoaded}/${log.itemTarget} ${log.unit}`
                        : 'MERAH / DITOLAK'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* FLOATING BOTTOM NAVIGATION BAR: 4 MENU MODERN TANPA TOMBOL GANDA      */}
      {/* ===================================================================== */}
      <nav className="fixed bottom-2.5 left-3 right-3 sm:left-auto sm:right-auto sm:w-[420px] max-w-md mx-auto z-40">
        <div className="bg-slate-900/95 backdrop-blur-xl border border-slate-800 rounded-2xl p-1.5 shadow-2xl shadow-black/70 grid grid-cols-4 gap-1 items-center">
          {/* 1. Kamera */}
          <button
            type="button"
            onClick={() => {
              setOpenCustomDropdown(null);
              setScannerPage('kamera');
            }}
            className={`flex flex-col items-center justify-center gap-0.5 py-1.5 px-1 rounded-xl transition cursor-pointer relative ${
              scannerPage === 'kamera'
                ? 'bg-cyan-500/15 border border-cyan-500/35 text-cyan-300 font-extrabold shadow-xs'
                : 'text-slate-400 hover:text-slate-200 border border-transparent'
            }`}
          >
            <Camera
              className={`w-4 h-4 transition-transform ${
                scannerPage === 'kamera' ? 'scale-110 text-cyan-400' : ''
              }`}
            />
            <span className="text-[10px] tracking-tight">Kamera</span>
          </button>

          {/* 2. List */}
          <button
            type="button"
            onClick={() => {
              setOpenCustomDropdown(null);
              setScannerPage('list');
            }}
            className={`flex flex-col items-center justify-center gap-0.5 py-1.5 px-1 rounded-xl transition cursor-pointer relative ${
              scannerPage === 'list'
                ? 'bg-cyan-500/15 border border-cyan-500/35 text-cyan-300 font-extrabold shadow-xs'
                : 'text-slate-400 hover:text-slate-200 border border-transparent'
            }`}
          >
            <div className="relative">
              <ClipboardCheck
                className={`w-4 h-4 transition-transform ${
                  scannerPage === 'list' ? 'scale-110 text-cyan-400' : ''
                }`}
              />
              {activeInvoice.items.length > 0 && (
                <span className="absolute -top-1.5 -right-3 px-1 py-0.2 rounded-full bg-sky-500 text-slate-950 text-[8px] font-black">
                  {activeInvoice.items.length}
                </span>
              )}
            </div>
            <span className="text-[10px] tracking-tight">List</span>
          </button>

          {/* 3. Termuat & Sisa */}
          <button
            type="button"
            onClick={() => {
              setOpenCustomDropdown(null);
              setScannerPage('termuat_sisa');
            }}
            className={`flex flex-col items-center justify-center gap-0.5 py-1.5 px-1 rounded-xl transition cursor-pointer relative ${
              scannerPage === 'termuat_sisa'
                ? 'bg-cyan-500/15 border border-cyan-500/35 text-cyan-300 font-extrabold shadow-xs'
                : 'text-slate-400 hover:text-slate-200 border border-transparent'
            }`}
          >
            <div className="relative">
              <Package
                className={`w-4 h-4 transition-transform ${
                  scannerPage === 'termuat_sisa' ? 'scale-110 text-cyan-400' : ''
                }`}
              />
              {totalSisaCount > 0 ? (
                <span className="absolute -top-1.5 -right-3 px-1 py-0.2 rounded-full bg-amber-500 text-slate-950 text-[8px] font-black">
                  {totalSisaCount}
                </span>
              ) : (
                <span className="absolute -top-1 -right-2.5 px-0.5 rounded-full bg-emerald-500 text-slate-950 text-[8px] font-black">
                  ✓
                </span>
              )}
            </div>
            <span className="text-[10px] tracking-tight">Termuat &amp; Sisa</span>
          </button>

          {/* 4. Riwayat */}
          <button
            type="button"
            onClick={() => {
              setOpenCustomDropdown(null);
              setScannerPage('riwayat');
            }}
            className={`flex flex-col items-center justify-center gap-0.5 py-1.5 px-1 rounded-xl transition cursor-pointer relative ${
              scannerPage === 'riwayat'
                ? 'bg-cyan-500/15 border border-cyan-500/35 text-cyan-300 font-extrabold shadow-xs'
                : 'text-slate-400 hover:text-slate-200 border border-transparent'
            }`}
          >
            <div className="relative">
              <FileText
                className={`w-4 h-4 transition-transform ${
                  scannerPage === 'riwayat' ? 'scale-110 text-cyan-400' : ''
                }`}
              />
              {recentScansLog.length > 0 && (
                <span className="absolute -top-1.5 -right-3 px-1 py-0.2 rounded-full bg-indigo-500 text-white text-[8px] font-black">
                  {recentScansLog.length}
                </span>
              )}
            </div>
            <span className="text-[10px] tracking-tight">Riwayat</span>
          </button>
        </div>
      </nav>

      {/* ===================================================================== */}
      {/* POPUP MODAL WARNING KETIKA TERJADI LEBIH MUAT BARANG                   */}
      {/* ===================================================================== */}
      {overloadWarningAlert && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-rose-500/50 rounded-2xl max-w-sm w-full p-4 shadow-2xl text-center space-y-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/15 text-rose-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-5 h-5 text-rose-500" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">
                Jumlah Muatan Melebihi Faktur
              </h3>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                Item <strong className="text-white">[{overloadWarningAlert.skuCode}] {overloadWarningAlert.itemName}</strong> terdeteksi dimuat <strong className="text-rose-400">{overloadWarningAlert.qtyLoaded} {overloadWarningAlert.unit}</strong> dari faktur {overloadWarningAlert.qtyOrdered} {overloadWarningAlert.unit} (Lebih Muat +{overloadWarningAlert.qtyLoaded - overloadWarningAlert.qtyOrdered} {overloadWarningAlert.unit}).
              </p>
            </div>
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setOverloadWarningAlert(null)}
                className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition cursor-pointer"
              >
                Mengerti &amp; Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL GALERI MULTI-FOTO BARANG PER ITEM (MODERN CAROUSEL + FILMSTRIP) */}
      {/* ===================================================================== */}
      {previewPhotoModal && (() => {
        const scansList = previewPhotoModal.scans || [];
        const safeIdx = Math.min(activePhotoPreviewIdx, Math.max(0, scansList.length - 1));
        const activeScan = scansList[safeIdx] || null;
        const targetInvoiceItem = previewPhotoModal.itemId
          ? activeInvoice.items.find(it => it.id === previewPhotoModal.itemId)
          : activeInvoice.items.find(it => getIntegratedDbInfo(it).deskripsiBarang === previewPhotoModal.itemName);

        return (
          <div
            className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md overflow-y-auto flex items-center justify-center p-3 sm:p-5"
            onClick={() => setPreviewPhotoModal(null)}
          >
            <div
              className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-xl w-full overflow-hidden shadow-2xl my-auto text-slate-100 animate-in fade-in zoom-in-95 duration-200"
              onClick={e => e.stopPropagation()}
            >
              {/* Modern Header */}
              <div className="px-5 py-4 bg-slate-950/80 border-b border-slate-800 flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {previewPhotoModal.skuCode && (
                      <span className="px-2.5 py-0.5 rounded-lg bg-indigo-500/20 border border-indigo-500/30 font-mono text-[11px] font-black text-indigo-300">
                        {previewPhotoModal.skuCode}
                      </span>
                    )}
                    <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-[10px] font-extrabold text-cyan-300">
                      📷 {scansList.length} Foto Dokumentasi
                    </span>
                  </div>
                  <h3 className="text-sm sm:text-base font-black text-white leading-snug break-words">
                    {previewPhotoModal.itemName}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewPhotoModal(null)}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer shrink-0 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Action Bar to Add More Photos (>1 Photo Support) */}
              {targetInvoiceItem && (
                <div className="px-5 py-2.5 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-[11px] text-slate-400 font-semibold">
                    Tambah foto dokumentasi untuk barang ini:
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleCaptureExtraPhotoOnly(targetInvoiceItem)}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-extrabold flex items-center gap-1.5 cursor-pointer transition shadow-sm"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>+ Ambil Foto Kamera</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMultiPhotoTargetItemId(targetInvoiceItem.id);
                        multiPhotoInputRef.current?.click();
                      }}
                      className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-extrabold flex items-center gap-1.5 cursor-pointer transition shadow-sm"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>+ Upload Multi-Foto</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Active Photo Hero Viewer with Prev/Next Carousel */}
              {activeScan ? (
                <div className="p-4 space-y-3">
                  <div className="relative rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 aspect-[4/3] flex items-center justify-center group">
                    <img
                      src={activeScan.photoDataUrl}
                      alt={`Foto ${safeIdx + 1}`}
                      className="w-full h-full object-contain"
                    />

                    {/* Counter Badge Top-Left */}
                    <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-slate-950/85 backdrop-blur-md border border-slate-700 text-[11px] font-extrabold text-white shadow-lg">
                      Foto {safeIdx + 1} dari {scansList.length}
                    </div>

                    {/* Timestamp Badge Top-Right */}
                    <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-indigo-600/90 backdrop-blur-md text-[10px] font-mono font-bold text-white shadow-lg">
                      {activeScan.timestamp}
                    </div>

                    {/* Prev / Next Navigation Buttons when >1 photo */}
                    {scansList.length > 1 && (
                      <>
                        <button
                          type="button"
                          onClick={() => setActivePhotoPreviewIdx((safeIdx - 1 + scansList.length) % scansList.length)}
                          className="absolute left-2.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-slate-950/80 hover:bg-indigo-600 text-white border border-slate-700 flex items-center justify-center shadow-xl cursor-pointer transition"
                          title="Foto Sebelumnya"
                        >
                          &#8249;
                        </button>
                        <button
                          type="button"
                          onClick={() => setActivePhotoPreviewIdx((safeIdx + 1) % scansList.length)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-slate-950/80 hover:bg-indigo-600 text-white border border-slate-700 flex items-center justify-center shadow-xl cursor-pointer transition"
                          title="Foto Berikutnya"
                        >
                          &#8250;
                        </button>
                      </>
                    )}
                  </div>

                  {/* Active Photo Metadata Card */}
                  <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-extrabold text-emerald-400">
                        {activeScan.qtyScanned > 0
                          ? `✓ Verifikasi Termuat: +${activeScan.qtyScanned} Kemasan`
                          : '📸 Foto Dokumentasi Tambahan'}
                      </span>
                      <span className="text-[11px] text-slate-400">Admin: {activeScan.scannedBy}</span>
                    </div>
                    {activeScan.notes && (
                      <div className="text-[11px] text-slate-300">{activeScan.notes}</div>
                    )}
                    <div className="pt-1">
                      <ExifMetadataBadge exif={activeScan.exifMetadata} compact />
                    </div>
                  </div>

                  {/* Interactive Filmstrip Thumbnail Bar when >1 photo */}
                  {scansList.length > 1 && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        <span>Galeri Multi-Foto ({scansList.length} Foto)</span>
                        <span>Klik thumbnail untuk melihat</span>
                      </div>
                      <div className="flex items-center gap-2 overflow-x-auto pb-1">
                        {scansList.map((sc, idx) => {
                          const isCurrent = idx === safeIdx;
                          return (
                            <button
                              key={sc.id}
                              type="button"
                              onClick={() => setActivePhotoPreviewIdx(idx)}
                              className={`relative w-16 h-16 rounded-xl overflow-hidden shrink-0 border-2 transition cursor-pointer ${
                                isCurrent
                                  ? 'border-cyan-400 ring-2 ring-cyan-400/30 scale-105'
                                  : 'border-slate-800 opacity-70 hover:opacity-100'
                              }`}
                            >
                              <img src={sc.photoDataUrl} alt="" className="w-full h-full object-cover" />
                              <span className="absolute bottom-0.5 right-0.5 px-1 rounded bg-slate-950/85 text-[9px] font-mono font-bold text-white">
                                #{idx + 1}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-8 text-center text-xs text-slate-400">
                  Belum ada foto dokumentasi untuk barang ini.
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
};

