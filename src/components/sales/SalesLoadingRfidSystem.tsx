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
  Edit3
} from 'lucide-react';
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
}

export interface SalesOrderInvoice {
  id: string;
  invoiceNumber: string;
  soNumber: string;
  date: string;
  customerName: string;
  areaName: string;
  fleetLabel: string;
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
  { skuCode: 'RFID-KB-001', itemName: 'Karton Box Corrugated B-Flute 60x40x40 Polos', unit: 'Ikat' },
  { skuCode: 'RFID-KB-002', itemName: 'Karton Box Duplex Cetak Custom 30x20x15', unit: 'Box' },
  { skuCode: 'RFID-KB-003', itemName: 'Box Kemasan Roti & Kue Ivory 22x22x8', unit: 'Bal' },
  { skuCode: 'RFID-KB-004', itemName: 'Box Pizza E-Flute Kraft Coklat 25x25x5', unit: 'Ikat' },
  { skuCode: 'RFID-KB-005', itemName: 'Paper Bag Kraft Coklat Tebal Uk. L', unit: 'Pack' },
  { skuCode: 'RFID-KB-006', itemName: 'Mika Daleman Kue Sekat 4 (Isi 100 Pcs)', unit: 'Box' },
  { skuCode: 'RFID-KB-007', itemName: 'Karton Box Die-Cut Sepatu Ekspor', unit: 'Ikat' },
  { skuCode: 'RFID-KB-008', itemName: 'Lakban Coklat Packing AKK 48mm x 90Y', unit: 'Box' }
];

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
      notes: 'Order kemasan rutin mingguan — pastikan box duplex di tumpukan atas',
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
          skuCode: 'RFID-KB-002',
          itemName: 'Karton Box Duplex Cetak Custom 30x20x15',
          unit: 'Box',
          qtyOrdered: 15,
          qtyLoaded: 10,
          scans: [
            {
              id: 'sc-2',
              timestamp: '08:22 WIB',
              qtyScanned: 10,
              photoDataUrl: createSampleSvgPhoto('Karton Box Duplex Cetak Custom 30x20x15', 'RFID-KB-002', 10, 'Box', '08:22 WIB'),
              scannedBy: adminDefault,
              notes: 'Kloter pertama 10 box masuk armada'
            }
          ]
        },
        {
          id: 'itm-3',
          skuCode: 'RFID-KB-004',
          itemName: 'Box Pizza E-Flute Kraft Coklat 25x25x5',
          unit: 'Ikat',
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
          skuCode: 'RFID-KB-003',
          itemName: 'Box Kemasan Roti & Kue Ivory 22x22x8',
          unit: 'Bal',
          qtyOrdered: 25,
          qtyLoaded: 25,
          scans: [
            {
              id: 'sc-201',
              timestamp: '08:50 WIB',
              qtyScanned: 25,
              photoDataUrl: createSampleSvgPhoto('Box Kemasan Roti & Kue Ivory 22x22x8', 'RFID-KB-003', 25, 'Bal', '08:50 WIB'),
              scannedBy: adminDefault,
              notes: 'Muatan sesuai faktur'
            }
          ]
        },
        {
          id: 'itm-202',
          skuCode: 'RFID-KB-005',
          itemName: 'Paper Bag Kraft Coklat Tebal Uk. L',
          unit: 'Pack',
          qtyOrdered: 30,
          qtyLoaded: 34,
          scans: [
            {
              id: 'sc-202',
              timestamp: '09:05 WIB',
              qtyScanned: 34,
              photoDataUrl: createSampleSvgPhoto('Paper Bag Kraft Coklat Tebal Uk. L', 'RFID-KB-005', 34, 'Pack', '09:05 WIB'),
              scannedBy: adminDefault,
              notes: 'Terbawa 4 pack ekstra dari palet sebelah'
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

  const [invoices, setInvoices] = useState<SalesOrderInvoice[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SALES_RFID);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
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
          if (Array.isArray(parsed)) setInvoices(parsed);
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

  const [searchQuery, setSearchQuery] = useState('');
  const [filterFleet, setFilterFleet] = useState('SEMUA ARMADA');
  const [filterStatus, setFilterStatus] = useState('SEMUA STATUS');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);

  // Form states for creating/editing Faktur / Sales Order
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [soNumber, setSoNumber] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [customerName, setCustomerName] = useState('');
  const [areaName, setAreaName] = useState<string>(OFFICIAL_DESTINATION_AREAS[0] || 'DENPASAR 1');
  const [fleetLabel, setFleetLabel] = useState(defaultFleet);
  const [adminPic, setAdminPic] = useState(defaultAdmin);
  const [notes, setNotes] = useState('');
  const [draftItems, setDraftItems] = useState<Array<{
    id: string;
    skuCode: string;
    itemName: string;
    unit: SalesOrderItem['unit'];
    qtyOrdered: number;
  }>>([
    {
      id: 'dr-1',
      skuCode: 'RFID-KB-001',
      itemName: 'Karton Box Corrugated B-Flute 60x40x40 Polos',
      unit: 'Ikat',
      qtyOrdered: 15
    }
  ]);

  const openCreateModal = () => {
    const seq = String(invoices.length + 1).padStart(3, '0');
    setEditingInvoiceId(null);
    setInvoiceNumber(`FKT/AKK/2026/11/${seq}`);
    setSoNumber(`SO-BWI-2611${seq}`);
    setDate(new Date().toISOString().split('T')[0]);
    setCustomerName('');
    setAreaName(OFFICIAL_DESTINATION_AREAS[0] || 'DENPASAR 1');
    setFleetLabel(fleetOptions[0] || defaultFleet);
    setAdminPic(adminNames[0] || defaultAdmin);
    setNotes('');
    setDraftItems([
      {
        id: `dr-${Date.now()}`,
        skuCode: 'RFID-KB-001',
        itemName: 'Karton Box Corrugated B-Flute 60x40x40 Polos',
        unit: 'Ikat',
        qtyOrdered: 20
      }
    ]);
    setIsModalOpen(true);
  };

  const openEditModal = (inv: SalesOrderInvoice) => {
    setEditingInvoiceId(inv.id);
    setInvoiceNumber(inv.invoiceNumber);
    setSoNumber(inv.soNumber);
    setDate(inv.date);
    setCustomerName(inv.customerName);
    setAreaName(inv.areaName);
    setFleetLabel(inv.fleetLabel);
    setAdminPic(inv.adminPic);
    setNotes(inv.notes || '');
    setDraftItems(
      inv.items.map(it => ({
        id: it.id,
        skuCode: it.skuCode,
        itemName: it.itemName,
        unit: it.unit,
        qtyOrdered: it.qtyOrdered
      }))
    );
    setIsModalOpen(true);
  };

  const handleAddDraftItem = () => {
    const nextIdx = draftItems.length + 1;
    const preset = MASTER_PACKAGING_CATALOG[nextIdx % MASTER_PACKAGING_CATALOG.length];
    setDraftItems(prev => [
      ...prev,
      {
        id: `dr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        skuCode: `RFID-KB-00${nextIdx}`,
        itemName: preset?.itemName || '',
        unit: preset?.unit || 'Box',
        qtyOrdered: 10
      }
    ]);
  };

  const handleSelectCatalogPreset = (rowId: string, skuCode: string) => {
    const found = MASTER_PACKAGING_CATALOG.find(c => c.skuCode === skuCode);
    if (!found) return;
    setDraftItems(prev =>
      prev.map(r =>
        r.id === rowId
          ? { ...r, skuCode: found.skuCode, itemName: found.itemName, unit: found.unit }
          : r
      )
    );
  };

  const handleSaveInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoiceNumber.trim() || !customerName.trim()) {
      showToast('Mohon lengkapi Nomor Faktur dan Nama Pelanggan/Toko.', 'error');
      return;
    }
    const validItems = draftItems.filter(d => d.itemName.trim() && Number(d.qtyOrdered) > 0);
    if (validItems.length === 0) {
      showToast('Tambahkan minimal 1 item barang dengan jumlah > 0 pada Faktur/SO.', 'error');
      return;
    }

    if (editingInvoiceId) {
      saveInvoices(prev =>
        prev.map(inv => {
          if (inv.id !== editingInvoiceId) return inv;
          const mergedItems: SalesOrderItem[] = validItems.map(d => {
            const existing = inv.items.find(old => old.id === d.id);
            return {
              id: d.id,
              skuCode: d.skuCode.trim().toUpperCase(),
              itemName: d.itemName.trim(),
              unit: d.unit,
              qtyOrdered: Number(d.qtyOrdered),
              qtyLoaded: existing ? existing.qtyLoaded : 0,
              scans: existing ? existing.scans : []
            };
          });
          return {
            ...inv,
            invoiceNumber: invoiceNumber.trim().toUpperCase(),
            soNumber: soNumber.trim().toUpperCase(),
            date,
            customerName: customerName.trim().toUpperCase(),
            areaName,
            fleetLabel,
            adminPic,
            notes: notes.trim(),
            items: mergedItems
          };
        })
      );
      showToast(`Faktur ${invoiceNumber} berhasil diperbarui & tersinkron ke Aplikasi RFID!`, 'success');
    } else {
      const newInv: SalesOrderInvoice = {
        id: `inv-${Date.now()}`,
        invoiceNumber: invoiceNumber.trim().toUpperCase(),
        soNumber: soNumber.trim().toUpperCase() || `SO-${Date.now().toString().slice(-5)}`,
        date,
        customerName: customerName.trim().toUpperCase(),
        areaName,
        fleetLabel,
        adminPic,
        isLoadingFinished: false,
        notes: notes.trim(),
        items: validItems.map((d, i) => ({
          id: `itm-${Date.now()}-${i}`,
          skuCode: d.skuCode.trim().toUpperCase() || `RFID-00${i + 1}`,
          itemName: d.itemName.trim(),
          unit: d.unit,
          qtyOrdered: Number(d.qtyOrdered),
          qtyLoaded: 0,
          scans: []
        }))
      };
      saveInvoices(prev => [newInv, ...prev]);
      showToast(`Faktur ${newInv.invoiceNumber} berhasil dibuat! Silakan lanjutkan foto barang di Aplikasi Scan RFID.`, 'success');
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

      const matchFleet = filterFleet === 'SEMUA ARMADA' || inv.fleetLabel === filterFleet;
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
            <button
              type="button"
              onClick={openCreateModal}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-sm transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ Input Faktur / Sales Order Baru</span>
            </button>
            <button
              type="button"
              onClick={() => {
                const firstId = invoices[0]?.id || '';
                onOpenRfidScannerForInvoice(firstId);
              }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white border border-slate-700 text-xs font-bold transition cursor-pointer"
            >
              <Camera className="w-4 h-4 text-sky-400" />
              <span>Buka Aplikasi Scan &amp; Foto (RFID)</span>
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
                      <span className="flex items-center gap-1">
                        <Truck className="w-3.5 h-3.5 text-sky-500" />
                        Armada Box: <strong>{inv.fleetLabel}</strong>
                      </span>
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

      {/* Modal Input / Edit Faktur & Sales Order */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs overflow-y-auto flex items-start justify-center p-3 sm:p-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-4xl w-full p-5 sm:p-6 shadow-2xl my-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  {editingInvoiceId ? 'Edit Faktur / Sales Order (SO)' : 'Input Faktur / Sales Order (SO) Muat Armada Baru'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Rincian item barang ini akan menjadi acuan verifikasi foto &amp; deteksi barang sisa/lebih muat pada Aplikasi RFID.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveInvoice} className="space-y-4 mt-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Nomor Faktur *</label>
                  <input
                    type="text"
                    required
                    value={invoiceNumber}
                    onChange={e => setInvoiceNumber(e.target.value)}
                    placeholder="FKT/AKK/2026/11/003"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Nomor Sales Order (SO) *</label>
                  <input
                    type="text"
                    required
                    value={soNumber}
                    onChange={e => setSoNumber(e.target.value)}
                    placeholder="SO-BWI-261103"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Tanggal Muat *</label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Nama Toko / Pelanggan *</label>
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={e => setCustomerName(e.target.value)}
                    placeholder="cth. TK USAHA JAYA GENTENG"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Area Kirim *</label>
                  <select
                    value={areaName}
                    onChange={e => setAreaName(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white"
                  >
                    {OFFICIAL_DESTINATION_AREAS.map(ar => (
                      <option key={ar} value={ar}>{ar}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Armada Box Tujuan *</label>
                  <select
                    value={fleetLabel}
                    onChange={e => setFleetLabel(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white"
                  >
                    {fleetOptions.map(fl => (
                      <option key={fl} value={fl}>{fl}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Admin Penjualan PIC *</label>
                  <select
                    value={adminPic}
                    onChange={e => setAdminPic(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white"
                  >
                    {adminNames.map(adm => (
                      <option key={adm} value={adm}>{adm}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Dynamic Item List */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold uppercase text-slate-700 dark:text-slate-300">
                    Daftar Item Barang pada Faktur / Sales Order ({draftItems.length} Item)
                  </label>
                  <button
                    type="button"
                    onClick={handleAddDraftItem}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-xs font-bold cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah Baris Barang</span>
                  </button>
                </div>

                <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                  {draftItems.map((row, idx) => (
                    <div
                      key={row.id}
                      className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700"
                    >
                      <div className="sm:col-span-2">
                        <input
                          type="text"
                          value={row.skuCode}
                          onChange={e =>
                            setDraftItems(prev =>
                              prev.map(r => (r.id === row.id ? { ...r, skuCode: e.target.value } : r))
                            )
                          }
                          placeholder="Kode RFID/SKU"
                          className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold"
                        />
                      </div>

                      <div className="sm:col-span-6 space-y-1">
                        <input
                          type="text"
                          required
                          value={row.itemName}
                          onChange={e =>
                            setDraftItems(prev =>
                              prev.map(r => (r.id === row.id ? { ...r, itemName: e.target.value } : r))
                            )
                          }
                          placeholder={`Nama Barang Kemasan ke-${idx + 1}...`}
                          className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold"
                        />
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-slate-400">Pilih Cepat SKU:</span>
                          <select
                            value=""
                            onChange={e => handleSelectCatalogPreset(row.id, e.target.value)}
                            className="text-[10px] bg-transparent text-indigo-600 dark:text-indigo-400 font-semibold focus:outline-none cursor-pointer"
                          >
                            <option value="">-- Katalog Kemasan AKK --</option>
                            {MASTER_PACKAGING_CATALOG.map(c => (
                              <option key={c.skuCode} value={c.skuCode}>
                                {c.skuCode} - {c.itemName} ({c.unit})
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="sm:col-span-2">
                        <input
                          type="number"
                          min={1}
                          required
                          value={row.qtyOrdered}
                          onChange={e =>
                            setDraftItems(prev =>
                              prev.map(r =>
                                r.id === row.id ? { ...r, qtyOrdered: Math.max(1, Number(e.target.value)) } : r
                              )
                            )
                          }
                          className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-center"
                        />
                      </div>

                      <div className="sm:col-span-1">
                        <select
                          value={row.unit}
                          onChange={e =>
                            setDraftItems(prev =>
                              prev.map(r =>
                                r.id === row.id
                                  ? { ...r, unit: e.target.value as SalesOrderItem['unit'] }
                                  : r
                              )
                            )
                          }
                          className="w-full px-1.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold"
                        >
                          <option value="Box">Box</option>
                          <option value="Ikat">Ikat</option>
                          <option value="Bal">Bal</option>
                          <option value="Pack">Pack</option>
                          <option value="Roll">Roll</option>
                          <option value="Pcs">Pcs</option>
                        </select>
                      </div>

                      <div className="sm:col-span-1 flex justify-end">
                        {draftItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setDraftItems(prev => prev.filter(r => r.id !== row.id))}
                            className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Catatan Pengeluaran Barang / Instruksi Muat</label>
                <input
                  type="text"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="cth. Susun barang sesuai urutan bongkar toko..."
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-sm cursor-pointer"
                >
                  Simpan Faktur &amp; Sinkronkan ke Aplikasi RFID
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
// SUB-MENU 2: APLIKASI SCAN & FOTO BARANG MUAT (SISTEM RFID VISUAL)
// ============================================================================
interface SalesRfidScannerAppTabProps {
  initialInvoiceId?: string | null;
  onNavigateToInvoiceInput: () => void;
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

  // Camera & Photo Scan Modal / Drawer States
  const [scanningItemId, setScanningItemId] = useState<string | null>(null);
  const [scanQtyInput, setScanQtyInput] = useState<number>(1);
  const [scanNotesInput, setScanNotesInput] = useState<string>('');
  const [scanAdminPic, setScanAdminPic] = useState<string>(defaultAdmin);
  const [capturedPhotoUrl, setCapturedPhotoUrl] = useState<string | null>(null);
  const [capturedExif, setCapturedExif] = useState<ExifTimestampMetadata | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
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

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  const startLiveCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      streamRef.current = stream;
      setIsCameraActive(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      }, 100);
    } catch {
      showToast('Kamera perangkat tidak terdeteksi — menggunakan mode ambil foto cepat / unggah gambar.', 'info');
      if (scanningItem) {
        const nowStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
        setCapturedPhotoUrl(
          createSampleSvgPhoto(scanningItem.itemName, scanningItem.skuCode, scanQtyInput, scanningItem.unit, nowStr)
        );
      }
    }
  };

  const captureSnapshotFromVideo = () => {
    const exifMeta = createExifMetadataFromDate(new Date(), 'CAMERA_CAPTURE_SENSOR');
    if (videoRef.current && videoRef.current.videoWidth > 0) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        drawExifMetadataOnCanvas(ctx, canvas.width, canvas.height, exifMeta);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
        setCapturedPhotoUrl(dataUrl);
        setCapturedExif(exifMeta);
        stopCamera();
        return;
      }
    }
    if (scanningItem) {
      const nowStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
      setCapturedPhotoUrl(
        createSampleSvgPhoto(scanningItem.itemName, scanningItem.skuCode, scanQtyInput, scanningItem.unit, nowStr)
      );
      setCapturedExif(exifMeta);
      stopCamera();
    }
  };

  const handleFileUploadPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    extractExifFromFile(file).then(exifMeta => {
      const reader = new FileReader();
      reader.onload = ev => {
        if (typeof ev.target?.result === 'string') {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const maxDim = 960;
            let w = img.width || 800;
            let h = img.height || 600;
            if (w > maxDim || h > maxDim) {
              if (w > h) {
                h = Math.round((h * maxDim) / w);
                w = maxDim;
              } else {
                w = Math.round((w * maxDim) / h);
                h = maxDim;
              }
            }
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0, w, h);
              drawExifMetadataOnCanvas(ctx, w, h, exifMeta);
              setCapturedPhotoUrl(canvas.toDataURL('image/jpeg', 0.82));
            } else {
              setCapturedPhotoUrl(ev.target!.result as string);
            }
            setCapturedExif(exifMeta);
          };
          img.src = ev.target.result;
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const scanningItem = useMemo(() => {
    if (!activeInvoice || !scanningItemId) return null;
    return activeInvoice.items.find(i => i.id === scanningItemId) || null;
  }, [activeInvoice, scanningItemId]);

  const openPhotoScannerForItem = (item: SalesOrderItem) => {
    const remaining = Math.max(1, item.qtyOrdered - item.qtyLoaded);
    setScanningItemId(item.id);
    setScanQtyInput(remaining);
    setScanNotesInput('');
    setCapturedPhotoUrl(null);
    setCapturedExif(null);
    stopCamera();
  };

  const handleConfirmPhotoScan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeInvoice || !scanningItem) return;

    const nowDate = new Date();
    const nowStr = nowDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
    const finalExif = capturedExif || createExifMetadataFromDate(nowDate, 'CAMERA_CAPTURE_SENSOR');
    const finalPhoto =
      capturedPhotoUrl ||
      createSampleSvgPhoto(scanningItem.itemName, scanningItem.skuCode, scanQtyInput, scanningItem.unit, nowStr);

    const addedQty = Math.max(1, Number(scanQtyInput) || 1);
    const newTotalLoaded = scanningItem.qtyLoaded + addedQty;

    const newScanLog: ItemPhotoScanLog = {
      id: `scan-${Date.now()}`,
      timestamp: nowStr,
      qtyScanned: addedQty,
      photoDataUrl: finalPhoto,
      scannedBy: scanAdminPic,
      notes: scanNotesInput.trim() || `Foto verifikasi barang keluar (${addedQty} ${scanningItem.unit})`,
      exifMetadata: finalExif
    };

    saveInvoices(prev =>
      prev.map(inv => {
        if (inv.id !== activeInvoice.id) return inv;
        return {
          ...inv,
          items: inv.items.map(it =>
            it.id === scanningItem.id
              ? {
                  ...it,
                  qtyLoaded: newTotalLoaded,
                  scans: [newScanLog, ...it.scans]
                }
              : it
          )
        };
      })
    );

    stopCamera();
    setScanningItemId(null);

    // Check if over-loaded (Lebih Muat Barang) -> Trigger explicit warning!
    if (newTotalLoaded > scanningItem.qtyOrdered) {
      setOverloadWarningAlert({
        itemName: scanningItem.itemName,
        skuCode: scanningItem.skuCode,
        qtyOrdered: scanningItem.qtyOrdered,
        qtyLoaded: newTotalLoaded,
        unit: scanningItem.unit
      });
      showToast(
        `⚠️ WARNING LEBIH MUAT BARANG! ${scanningItem.itemName} termuat ${newTotalLoaded} ${scanningItem.unit} (Faktur: ${scanningItem.qtyOrdered} ${scanningItem.unit}). Kelebihan +${newTotalLoaded - scanningItem.qtyOrdered} ${scanningItem.unit}!`,
        'error'
      );
    } else if (newTotalLoaded < scanningItem.qtyOrdered) {
      showToast(
        `Foto tersimpan! ${scanningItem.itemName} termuat ${newTotalLoaded}/${scanningItem.qtyOrdered} ${scanningItem.unit} (Masih sisa ${scanningItem.qtyOrdered - newTotalLoaded} ${scanningItem.unit} belum termuat).`,
        'info'
      );
    } else {
      showToast(
        `✅ Lengkap! ${scanningItem.itemName} telah difoto & termuat sesuai faktur (${newTotalLoaded} ${scanningItem.unit}).`,
        'success'
      );
    }
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
      showToast(
        `⚠️ PERINGATAN: Ditemukan ${ev.overloadItems.length} item LEBIH MUAT pada Faktur ${activeInvoice.invoiceNumber}!`,
        'error'
      );
    } else if (ev.unloadedItems.length > 0 || ev.shortageItems.length > 0) {
      showToast(
        `🔍 Deteksi Selesai: Terdeteksi ${ev.unloadedItems.length + ev.shortageItems.length} item BARANG SISA / BELUM TERMUAT ke armada box!`,
        'error'
      );
    } else {
      showToast(
        `✅ Proses Muat Selesai 100%! Seluruh barang pada Faktur ${activeInvoice.invoiceNumber} telah termuat lengkap tanpa selisih.`,
        'success'
      );
    }
  };

  if (!activeInvoice) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center space-y-3">
        <QrCode className="w-12 h-12 text-indigo-500 mx-auto" />
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Belum Ada Faktur / Sales Order Aktif</h2>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          Silakan input terlebih dahulu Faktur atau Sales Order di sub-menu <strong>Input Faktur / Sales Order (SO)</strong> untuk mulai memfoto barang muatan armada box.
        </p>
        <button
          type="button"
          onClick={onNavigateToInvoiceInput}
          className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold cursor-pointer"
        >
          Ke Sub-Menu Input Faktur / Sales Order
        </button>
      </div>
    );
  }

  const evalActive = evaluateInvoiceStatus(activeInvoice);

  return (
    <div className="space-y-6">
      {/* Top App Header (Handheld RFID / Vision Scanner Style) */}
      <div className="bg-slate-900 text-white border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-lg">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center shrink-0">
              <QrCode className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-[10px] font-black uppercase tracking-wider">
                  Sub-Menu 2 • Aplikasi RFID Visual Admin Penjualan
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                  Terintegrasi Faktur / SO
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight mt-1">
                Aplikasi Scan &amp; Foto Pengeluaran Barang (Smart RFID Muat Box)
              </h1>
              <p className="text-xs text-slate-300 mt-1 max-w-3xl">
                Fotokan setiap item barang yang dikeluarkan menuju armada box sesuai Faktur/SO. Aplikasi otomatis mendeteksi <strong>Barang Sisa (Belum Termuat / Kurang Muat)</strong> saat proses muat selesai, serta memunculkan <strong>Warning Real-Time jika ada Barang Lebih Muat</strong>.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 self-start lg:self-center">
            <button
              type="button"
              onClick={onNavigateToInvoiceInput}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold transition cursor-pointer"
            >
              <FileText className="w-4 h-4 text-indigo-400" />
              <span>Kelola / Tambah Faktur (SO)</span>
            </button>
            <button
              type="button"
              onClick={handleFinishLoadingAndDetectRemaining}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md transition cursor-pointer"
            >
              <ClipboardCheck className="w-4 h-4" />
              <span>Selesai Proses Muat &amp; Cek Barang Sisa</span>
            </button>
          </div>
        </div>

        {/* Selector Faktur / Sales Order Aktif */}
        <div className="mt-5 pt-5 border-t border-slate-800 grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
          <div className="lg:col-span-6">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Pilih Faktur / Sales Order (SO) yang Sedang Dimuat ke Armada Box:
            </label>
            <select
              value={activeInvoice.id}
              onChange={e => {
                setSelectedInvoiceId(e.target.value);
                localStorage.setItem(ACTIVE_INVOICE_KEY, e.target.value);
              }}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs sm:text-sm font-bold text-white focus:outline-none focus:border-indigo-500"
            >
              {invoices.map(inv => {
                const ev = evaluateInvoiceStatus(inv);
                return (
                  <option key={inv.id} value={inv.id}>
                    {inv.invoiceNumber} ({inv.soNumber}) — {inv.customerName} | {inv.fleetLabel} [{ev.statusLabel}]
                  </option>
                );
              })}
            </select>
          </div>

          <div className="lg:col-span-6 grid grid-cols-3 gap-2.5 text-center">
            <div className="p-2.5 rounded-xl bg-slate-950/90 border border-slate-800">
              <div className="text-[10px] font-bold uppercase text-slate-400">Target Faktur</div>
              <div className="text-lg font-black text-white">{evalActive.totalOrdered} Kemasan</div>
              <div className="text-[10px] text-slate-400">{activeInvoice.items.length} Jenis SKU</div>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950/90 border border-slate-800">
              <div className="text-[10px] font-bold uppercase text-slate-400">Sudah Difoto / Muat</div>
              <div className="text-lg font-black text-sky-400">{evalActive.totalLoaded} Kemasan</div>
              <div className="text-[10px] text-slate-400">{activeInvoice.fleetLabel.split('—')[0]}</div>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950/90 border border-slate-800">
              <div className="text-[10px] font-bold uppercase text-slate-400">Barang Sisa / Lebih</div>
              <div
                className={`text-lg font-black ${
                  evalActive.overloadItems.length > 0
                    ? 'text-rose-400'
                    : evalActive.unloadedItems.length + evalActive.shortageItems.length > 0
                    ? 'text-amber-400'
                    : 'text-emerald-400'
                }`}
              >
                {evalActive.overloadItems.length > 0
                  ? `${evalActive.overloadItems.length} Lebih Muat!`
                  : evalActive.unloadedItems.length + evalActive.shortageItems.length > 0
                  ? `${evalActive.unloadedItems.length + evalActive.shortageItems.length} Item Sisa`
                  : '0 Sisa (Klop)'}
              </div>
              <div className="text-[10px] text-slate-400">{activeInvoice.areaName}</div>
            </div>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* REAL-TIME WARNING BANNER: BARANG LEBIH MUAT (OVER-LOAD NOTIFICATION) */}
      {/* ===================================================================== */}
      {evalActive.overloadItems.length > 0 && (
        <div className="bg-rose-600 text-white rounded-2xl p-5 shadow-lg border-2 border-rose-300 animate-pulse">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="text-xs font-black uppercase tracking-wider bg-rose-900/50 px-2.5 py-0.5 rounded-md inline-block">
                  ⚠️ NOTIFIKASI WARNING: TERDETEKSI BARANG LEBIH MUAT (OVER-LOAD)!
                </div>
                <h3 className="text-base sm:text-lg font-black mt-1">
                  Terdapat {evalActive.overloadItems.length} Item Barang yang Dimuat Melebihi Kuota Faktur {activeInvoice.invoiceNumber}!
                </h3>
                <ul className="mt-2 space-y-1 text-xs sm:text-sm font-semibold">
                  {evalActive.overloadItems.map(item => (
                    <li key={item.id} className="flex flex-wrap items-center gap-2">
                      <span>
                        • <strong>[{item.skuCode}] {item.itemName}</strong>: Faktur hanya{' '}
                        <u className="font-black">{item.qtyOrdered} {item.unit}</u>, tetapi termuat{' '}
                        <u className="font-black">{item.qtyLoaded} {item.unit}</u> (Kelebihan{' '}
                        <span className="bg-white text-rose-700 px-2 py-0.5 rounded-md font-black">
                          +{item.qtyLoaded - item.qtyOrdered} {item.unit}
                        </span>
                        )
                      </span>
                      <button
                        type="button"
                        onClick={() => handleAdjustLoadedQty(item, item.qtyOrdered)}
                        className="px-2.5 py-1 rounded-lg bg-slate-950/80 hover:bg-slate-950 text-white text-[11px] font-bold cursor-pointer"
                      >
                        Turunkan Kelebihan (Sesuaikan ke {item.qtyOrdered} {item.unit})
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* PANEL HASIL DETEKSI BARANG SISA / BELUM TERMUAT & REKONSILIASI FAKTUR */}
      {/* ===================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left 7 Cols: Daftar Item Barang Faktur untuk Difoto Satu per Satu */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Camera className="w-4 h-4 text-indigo-600" />
                <span>Daftar Barang Faktur — Fotokan Barang Saat Masuk Armada Box</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Klik tombol <strong>&ldquo;📸 Foto / Scan Barang&rdquo;</strong> pada setiap item sesuai fisik barang yang dikeluarkan.
              </p>
            </div>
            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
              {activeInvoice.invoiceNumber}
            </span>
          </div>

          <div className="space-y-3">
            {activeInvoice.items.map(item => {
              const diff = item.qtyLoaded - item.qtyOrdered;
              const isUnloaded = item.qtyLoaded === 0;
              const isShort = item.qtyLoaded > 0 && item.qtyLoaded < item.qtyOrdered;
              const isOver = item.qtyLoaded > item.qtyOrdered;
              const isExact = item.qtyLoaded === item.qtyOrdered && item.qtyOrdered > 0;
              const latestPhoto = item.scans[0]?.photoDataUrl;

              return (
                <div
                  key={item.id}
                  className={`p-4 rounded-2xl border transition ${
                    isOver
                      ? 'bg-rose-500/5 border-rose-500/40'
                      : isExact
                      ? 'bg-emerald-500/5 border-emerald-500/30'
                      : isShort
                      ? 'bg-amber-500/5 border-amber-500/30'
                      : 'bg-slate-50/70 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      {/* Photo Thumbnail or Placeholder */}
                      <div
                        onClick={() =>
                          item.scans.length > 0 &&
                          setPreviewPhotoModal({ itemName: item.itemName, scans: item.scans })
                        }
                        className={`w-16 h-16 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-900 flex items-center justify-center overflow-hidden shrink-0 ${
                          item.scans.length > 0 ? 'cursor-pointer hover:opacity-90' : ''
                        }`}
                        title={item.scans.length > 0 ? 'Klik untuk lihat bukti foto' : 'Belum ada foto'}
                      >
                        {latestPhoto ? (
                          <img src={latestPhoto} alt={item.itemName} className="w-full h-full object-cover" />
                        ) : (
                          <Camera className="w-6 h-6 text-slate-600" />
                        )}
                      </div>

                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-mono text-[11px] font-bold">
                            {item.skuCode}
                          </span>
                          {isUnloaded && (
                            <span className="px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[10px] font-extrabold uppercase">
                              BELUM TERMUAT (BARANG SISA: {item.qtyOrdered} {item.unit})
                            </span>
                          )}
                          {isShort && (
                            <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-700 dark:text-amber-300 text-[10px] font-extrabold uppercase">
                              KURANG MUAT (SISA {Math.abs(diff)} {item.unit} BELUM MUAT)
                            </span>
                          )}
                          {isOver && (
                            <span className="px-2 py-0.5 rounded-md bg-rose-600 text-white text-[10px] font-extrabold uppercase animate-pulse">
                              ⚠️ WARNING: LEBIH MUAT +{diff} {item.unit}!
                            </span>
                          )}
                          {isExact && (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[10px] font-extrabold uppercase">
                              ✓ TERMUAT LENGKAP &amp; SESUAI
                            </span>
                          )}
                        </div>

                        <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-1">
                          {item.itemName}
                        </h3>

                        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 dark:text-slate-400 mt-1">
                          <span>
                            Target Faktur: <strong className="text-slate-900 dark:text-white">{item.qtyOrdered} {item.unit}</strong>
                          </span>
                          <span>
                            Termuat (Difoto):{' '}
                            <strong
                              className={
                                isOver
                                  ? 'text-rose-600 dark:text-rose-400'
                                  : isExact
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-indigo-600 dark:text-indigo-400'
                              }
                            >
                              {item.qtyLoaded} {item.unit}
                            </strong>
                          </span>
                          {item.scans.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setPreviewPhotoModal({ itemName: item.itemName, scans: item.scans })}
                              className="text-indigo-600 dark:text-indigo-400 hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Lihat {item.scans.length} Foto</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap sm:flex-col items-end gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => openPhotoScannerForItem(item)}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-xs transition cursor-pointer"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        <span>📸 Foto / Scan Barang</span>
                      </button>

                      {item.qtyLoaded > 0 && (
                        <button
                          type="button"
                          onClick={() => handleAdjustLoadedQty(item, 0)}
                          className="text-[11px] text-slate-400 hover:text-rose-500 font-semibold cursor-pointer"
                        >
                          Reset Muatan Item
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right 5 Cols: Panel Deteksi Otomatis Barang Sisa (Belum Termuat) & Lebih Muat */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span>Hasil Deteksi Barang Sisa &amp; Audit Muat</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Otomatis mendeteksi barang apa saja yang belum termuat (barang sisa di gudang) maupun kelebihan muat.
                </p>
              </div>
            </div>

            {/* 1. DETEKSI BARANG SISA / BELUM TERMUAT */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">
                  1. Deteksi Barang Sisa / Belum Termuat ({evalActive.unloadedItems.length + evalActive.shortageItems.length} Item)
                </span>
              </div>

              {evalActive.unloadedItems.length === 0 && evalActive.shortageItems.length === 0 ? (
                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2.5 font-semibold">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Tidak ada barang sisa! Seluruh item pada faktur ini sudah termuat ke dalam armada box.</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {evalActive.unloadedItems.map(item => (
                    <div
                      key={item.id}
                      className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-2 text-xs"
                    >
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white">
                          [{item.skuCode}] {item.itemName}
                        </div>
                        <div className="text-amber-700 dark:text-amber-300 font-semibold mt-0.5">
                          Status: <strong>BELUM TERMUAT SAMA SEKALI</strong> — Sisa di gudang:{' '}
                          <u className="font-black">{item.qtyOrdered} {item.unit}</u>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => openPhotoScannerForItem(item)}
                        className="px-2.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-[11px] shrink-0 cursor-pointer"
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
                        className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-2 text-xs"
                      >
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white">
                            [{item.skuCode}] {item.itemName}
                          </div>
                          <div className="text-amber-700 dark:text-amber-300 font-semibold mt-0.5">
                            Status: <strong>KURANG MUAT</strong> (Baru muat {item.qtyLoaded}/{item.qtyOrdered} {item.unit}) —{' '}
                            <span className="bg-amber-500/20 px-1.5 py-0.5 rounded font-black">
                              Barang Sisa Belum Termuat: {sisa} {item.unit}
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => openPhotoScannerForItem(item)}
                          className="px-2.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-[11px] shrink-0 cursor-pointer"
                        >
                          Foto Sisa ({sisa})
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 2. DETEKSI WARNING BARANG LEBIH MUAT */}
            <div className="space-y-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
              <span className="text-xs font-black uppercase tracking-wider text-rose-600 dark:text-rose-400 block">
                2. Deteksi Peringatan Lebih Muat ({evalActive.overloadItems.length} Item)
              </span>

              {evalActive.overloadItems.length === 0 ? (
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 text-xs text-slate-500 flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Aman — Tidak ada barang yang melebihi jumlah Faktur / Sales Order.</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {evalActive.overloadItems.map(item => {
                    const excess = item.qtyLoaded - item.qtyOrdered;
                    return (
                      <div
                        key={item.id}
                        className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs space-y-1.5"
                      >
                        <div className="flex items-center justify-between font-bold text-rose-600 dark:text-rose-400">
                          <span>⚠️ WARNING LEBIH MUAT: {item.itemName}</span>
                          <span className="px-2 py-0.5 rounded bg-rose-600 text-white text-[10px]">
                            +{excess} {item.unit} Lebih
                          </span>
                        </div>
                        <p className="text-slate-600 dark:text-slate-300">
                          Order Faktur: <strong>{item.qtyOrdered} {item.unit}</strong> • Termuat di Armada:{' '}
                          <strong>{item.qtyLoaded} {item.unit}</strong>. Mohon keluarkan{' '}
                          <strong>{excess} {item.unit}</strong> dari armada box.
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 3. RINGKASAN BARANG SUDAH TERVERIFIKASI SESUAI */}
            <div className="space-y-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <span className="text-xs font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">
                3. Barang Termuat Sesuai Faktur ({evalActive.matchedItems.length} / {activeInvoice.items.length} Item)
              </span>
              {evalActive.matchedItems.length > 0 ? (
                <div className="space-y-1.5">
                  {evalActive.matchedItems.map(item => (
                    <div
                      key={item.id}
                      className="px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between text-xs"
                    >
                      <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                        ✓ {item.itemName}
                      </span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                        {item.qtyLoaded} {item.unit} (Sesuai)
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">Belum ada item yang mencapai jumlah klop 100%.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* MODAL KAMERA & FOTO VERIFIKASI BARANG MUAT (RFID VISUAL CAPTURE)       */}
      {/* ===================================================================== */}
      {scanningItem && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs overflow-y-auto flex items-start justify-center p-3 sm:p-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl my-auto space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                  Kamera Verifikasi RFID Visual • {scanningItem.skuCode}
                </span>
                <h3 className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
                  {scanningItem.itemName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  stopCamera();
                  setScanningItemId(null);
                }}
                className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Info Target vs Sudah Termuat */}
            <div className="grid grid-cols-3 gap-2 text-center bg-slate-50 dark:bg-slate-800/70 p-3 rounded-xl border border-slate-200/80 dark:border-slate-700 text-xs">
              <div>
                <div className="text-[10px] text-slate-400 uppercase font-bold">Qty Faktur</div>
                <div className="text-base font-black text-slate-900 dark:text-white">
                  {scanningItem.qtyOrdered} {scanningItem.unit}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400 uppercase font-bold">Sudah Termuat</div>
                <div className="text-base font-black text-indigo-600 dark:text-indigo-400">
                  {scanningItem.qtyLoaded} {scanningItem.unit}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400 uppercase font-bold">Sisa Belum Muat</div>
                <div className="text-base font-black text-amber-600 dark:text-amber-400">
                  {Math.max(0, scanningItem.qtyOrdered - scanningItem.qtyLoaded)} {scanningItem.unit}
                </div>
              </div>
            </div>

            {/* Camera Viewfinder / Photo Preview Box */}
            <div className="space-y-2.5">
              <div className="relative w-full h-56 rounded-2xl bg-slate-950 border-2 border-dashed border-indigo-500/40 overflow-hidden flex flex-col items-center justify-center">
                {isCameraActive ? (
                  <>
                    <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
                    <div className="absolute inset-4 border-2 border-sky-400/70 rounded-xl pointer-events-none flex items-end justify-center pb-2">
                      <span className="px-2.5 py-0.5 rounded bg-slate-950/80 text-sky-300 text-[10px] font-mono">
                        ARAHKAN KAMERA KE BARANG / LABEL KEMASAN ({scanningItem.skuCode})
                      </span>
                    </div>
                  </>
                ) : capturedPhotoUrl ? (
                  <img src={capturedPhotoUrl} alt="Captured" className="w-full h-full object-cover" />
                ) : (
                  <div className="text-center p-4 space-y-2">
                    <Camera className="w-10 h-10 text-indigo-400 mx-auto" />
                    <div className="text-xs font-bold text-white">Ambil Foto Bukti Barang Masuk Armada Box</div>
                    <p className="text-[11px] text-slate-400">
                      Gunakan kamera langsung atau unggah foto fisik barang yang sedang dimuat.
                    </p>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2">
                {!isCameraActive ? (
                  <button
                    type="button"
                    onClick={startLiveCamera}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold cursor-pointer"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Buka Kamera Langsung</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={captureSnapshotFromVideo}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Jepret Foto Barang Sekarang</span>
                  </button>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileUploadPhoto}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 text-xs font-semibold cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Ambil / Pilih Foto File</span>
                </button>
              </div>

              {capturedPhotoUrl && (
                <ExifMetadataBadge exif={capturedExif} />
              )}
            </div>

            <form onSubmit={handleConfirmPhotoScan} className="space-y-3.5 pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                    Jumlah Barang yang Difoto / Masuk Box ({scanningItem.unit}) *
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={scanQtyInput}
                    onChange={e => setScanQtyInput(Math.max(1, Number(e.target.value)))}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-black text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                    Admin Penjualan Pemeriksa *
                  </label>
                  <select
                    value={scanAdminPic}
                    onChange={e => setScanAdminPic(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white"
                  >
                    {adminNames.map(adm => (
                      <option key={adm} value={adm}>{adm}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Instant Live Preview Warning if input quantity will exceed Faktur */}
              {scanningItem.qtyLoaded + scanQtyInput > scanningItem.qtyOrdered && (
                <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-xs text-rose-600 dark:text-rose-400 font-bold flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    PERINGATAN LEBIH MUAT: Menambahkan {scanQtyInput} {scanningItem.unit} akan membuat total muatan menjadi{' '}
                    <u>{scanningItem.qtyLoaded + scanQtyInput} {scanningItem.unit}</u>, melebihi Faktur ({scanningItem.qtyOrdered} {scanningItem.unit}) sebanyak{' '}
                    <strong>+{scanningItem.qtyLoaded + scanQtyInput - scanningItem.qtyOrdered} {scanningItem.unit}</strong>!
                  </span>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                  Catatan Foto / Kondisi Barang (Opsional)
                </label>
                <input
                  type="text"
                  value={scanNotesInput}
                  onChange={e => setScanNotesInput(e.target.value)}
                  placeholder="cth. Palet ke-1 masuk armada box kondisi baik..."
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    stopCamera();
                    setScanningItemId(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-sm cursor-pointer"
                >
                  Simpan Foto &amp; Catat Barang Termuat
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* POPUP MODAL WARNING KETIKA TERJADI LEBIH MUAT BARANG                   */}
      {/* ===================================================================== */}
      {overloadWarningAlert && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border-2 border-rose-500 rounded-2xl max-w-md w-full p-6 shadow-2xl text-center space-y-4">
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
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full p-5 shadow-2xl my-auto space-y-4">
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
    </div>
  );
};
