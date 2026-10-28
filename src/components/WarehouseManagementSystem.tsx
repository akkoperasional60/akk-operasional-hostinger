import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Package,
  ArrowDownToLine,
  ArrowUpFromLine,
  ClipboardCheck,
  Map,
  Layers,
  Search,
  Plus,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Truck,
  Box,
  Barcode,
  RefreshCw,
  FileText,
  ArrowRight,
  Filter,
  ShieldCheck,
  Thermometer,
  Droplets,
  UserCheck,
  X,
  Check,
  TrendingUp,
  History,
  Camera,
  Upload,
  Zap,
  Sparkles,
  QrCode,
  Image as ImageIcon,
  Building2,
  Warehouse,
  Eye,
  Sliders,
  ArrowUpDown,
  Tag,
  Info,
  HelpCircle
} from 'lucide-react';
import { TeamCalendar } from './TeamCalendar';

export type WmsSubTab =
  | 'overview'
  | 'inventory'
  | 'inbound'
  | 'outbound'
  | 'scanner'
  | 'slotting'
  | 'opname';

interface WmsSkuItem {
  id: string;
  skuCode: string;
  name: string;
  category: 'Karton Box' | 'Plastik & Kemasan' | 'Material Packing' | 'Produk Distribusi';
  binLocation: string;
  zone: 'Zona A (Fast Moving)' | 'Zona B (Bulk Pallet)' | 'Zona C (Staging)' | 'Zona D (Pendukung)';
  stockOnHand: number;
  reservedStock: number;
  reorderPoint: number;
  maxCapacity: number;
  unit: 'Pcs' | 'Ball' | 'Roll' | 'Ikat' | 'Karton';
  rotationMethod: 'FIFO' | 'FEFO';
  batchNo: string;
  lastUpdated: string;
  unitValueRp: number;
}

interface InboundAsnRecord {
  id: string;
  asnNumber: string;
  poReference: string;
  supplierOrSource: string;
  arrivalTime: string;
  vehiclePlate: string;
  skuSummary: string;
  totalQty: number;
  unit: string;
  qcStatus: 'Menunggu QC' | 'QC Lolos (100%)' | 'QC Parsial (Ada Reject)';
  stage: 'unloading' | 'qc_check' | 'putaway' | 'completed';
  targetBin: string;
  receiverPic: string;
  photoVerified?: boolean;
}

interface OutboundPickingOrder {
  id: string;
  waveNumber: string;
  doNumber: string;
  routeArea: string;
  customerOrStore: string;
  fleetPlate: string;
  fleetCode: string;
  driverName: string;
  dockBay: string;
  totalSku: number;
  totalColli: number;
  pickerPic: string;
  checkerPic: string;
  stage: 'picking' | 'packing' | 'staging_dock' | 'loaded_dispatched';
  checklistVerified: {
    qtyMatched: boolean;
    packagingIntact: boolean;
    sealAttached: boolean;
    waybillSigned: boolean;
  };
  departureTarget: string;
  photoVerified?: boolean;
}

export type WmsProductCategory =
  | 'Karton Box'
  | 'Food Grade'
  | 'Plastik & Wrap'
  | 'Cup & Lid'
  | 'Lakban & Aksesoris'
  | 'Staging & Transit';

export interface RackTierLevel {
  levelNumber: number; // 1 to 4
  levelName: string; // e.g. "Level 1 (Floor Pallet)", "Level 2 (Picking Beam)", "Level 3 (Buffer Beam)", "Level 4 (Top Overstock)"
  heightM: number;
  skuCode: string;
  skuName: string;
  category: WmsProductCategory;
  currentQty: string;
  utilizationPct: number;
  maxWeightKg: number;
  status: 'optimal' | 'full' | 'low';
}

export interface RackSlottingBin {
  binCode: string;
  floor: 1 | 2;
  zoneId: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H';
  zoneName: string;
  aisle: string;
  level: string;
  category: WmsProductCategory;
  totalLevels: number;
  utilizationPct: number;
  skuCount: number;
  primaryItem: string;
  currentQty: string;
  maxWeightKg: number;
  status: 'optimal' | 'full' | 'low' | 'maintenance';
  levels: RackTierLevel[];
  slottingRuleNotes: string;
}

interface StockOpnameSheet {
  id: string;
  opnameCode: string;
  date: string;
  zone: string;
  binLocation: string;
  skuCode: string;
  skuName: string;
  systemStock: number;
  physicalStock: number;
  unit: string;
  auditorPic: string;
  status: 'Menunggu Verifikasi' | 'Disetujui (Adjusted)' | 'Sesuai (Match)';
  notes: string;
}

interface StockLedgerEntry {
  id: string;
  timestamp: string;
  txType: 'INBOUND' | 'OUTBOUND' | 'OPNAME_ADJ' | 'TRANSFER_BIN';
  referenceNo: string;
  skuCode: string;
  skuName: string;
  qtyChange: string;
  balanceAfter: number;
  binLocation: string;
  pic: string;
}

interface ScanAuditRecord {
  id: string;
  timestamp: string;
  mode: 'INBOUND' | 'OUTBOUND';
  skuCode: string;
  skuName: string;
  batchNo: string;
  binLocation: string;
  detectedQty: number;
  unit: string;
  photoPreview?: string;
  verificationStatus: 'Lolos QC & Tersinkron' | 'Cocok dengan DO' | 'Peringatan Selisih';
  targetReference: string;
  operatorPic: string;
}

const INITIAL_SKU_ITEMS: WmsSkuItem[] = [
  {
    id: 'sku-1',
    skuCode: 'AKK-KBX-001',
    name: 'Karton Box Corrugated B-Flute 60x40x40 cm (Polos)',
    category: 'Karton Box',
    binLocation: 'A-01-L1',
    zone: 'Zona A (Fast Moving)',
    stockOnHand: 4850,
    reservedStock: 1200,
    reorderPoint: 1500,
    maxCapacity: 6000,
    unit: 'Pcs',
    rotationMethod: 'FIFO',
    batchNo: 'BATCH-2610-A1',
    lastUpdated: 'Hari ini, 08:15 WIB',
    unitValueRp: 8500
  },
  {
    id: 'sku-2',
    skuCode: 'AKK-KBX-002',
    name: 'Karton Box Double Wall CB-Flute Export 80x50x50 cm',
    category: 'Karton Box',
    binLocation: 'B-02-L1',
    zone: 'Zona B (Bulk Pallet)',
    stockOnHand: 1120,
    reservedStock: 800,
    reorderPoint: 1200,
    maxCapacity: 3500,
    unit: 'Pcs',
    rotationMethod: 'FIFO',
    batchNo: 'BATCH-2610-B4',
    lastUpdated: 'Hari ini, 09:05 WIB',
    unitValueRp: 19500
  },
  {
    id: 'sku-3',
    skuCode: 'AKK-KBX-003',
    name: 'Box Kemasan Makanan Food Grade Ivory 22x22x8 cm',
    category: 'Karton Box',
    binLocation: 'A-02-L2',
    zone: 'Zona A (Fast Moving)',
    stockOnHand: 9400,
    reservedStock: 2500,
    reorderPoint: 3000,
    maxCapacity: 12000,
    unit: 'Pcs',
    rotationMethod: 'FIFO',
    batchNo: 'BATCH-2610-C2',
    lastUpdated: 'Hari ini, 07:45 WIB',
    unitValueRp: 2400
  },
  {
    id: 'sku-4',
    skuCode: 'AKK-PLS-014',
    name: 'Stretch Film Pallet Wrap 50cm x 300m (17 Micron)',
    category: 'Plastik & Kemasan',
    binLocation: 'D-01-L1',
    zone: 'Zona D (Pendukung)',
    stockOnHand: 68,
    reservedStock: 24,
    reorderPoint: 80,
    maxCapacity: 250,
    unit: 'Roll',
    rotationMethod: 'FIFO',
    batchNo: 'BATCH-2609-S9',
    lastUpdated: 'Kemarin, 16:30 WIB',
    unitValueRp: 64000
  },
  {
    id: 'sku-5',
    skuCode: 'AKK-PLS-019',
    name: 'Plastik Kemasan HD/PE Grosir Uk. 35x55 cm (Isi 50 Pak)',
    category: 'Plastik & Kemasan',
    binLocation: 'A-03-L1',
    zone: 'Zona A (Fast Moving)',
    stockOnHand: 420,
    reservedStock: 110,
    reorderPoint: 150,
    maxCapacity: 600,
    unit: 'Ball',
    rotationMethod: 'FIFO',
    batchNo: 'BATCH-2610-P3',
    lastUpdated: 'Hari ini, 10:12 WIB',
    unitValueRp: 310000
  },
  {
    id: 'sku-6',
    skuCode: 'AKK-MPK-007',
    name: 'Lakban OPP Coklat Heavy Duty 48mm x 90 Yard (1 Dus = 72 Roll)',
    category: 'Material Packing',
    binLocation: 'D-02-L2',
    zone: 'Zona D (Pendukung)',
    stockOnHand: 32,
    reservedStock: 18,
    reorderPoint: 45,
    maxCapacity: 150,
    unit: 'Karton',
    rotationMethod: 'FIFO',
    batchNo: 'BATCH-2609-L2',
    lastUpdated: 'Hari ini, 08:50 WIB',
    unitValueRp: 468000
  },
  {
    id: 'sku-7',
    skuCode: 'AKK-MPK-011',
    name: 'Strapping Band PP 15mm Kuning (10 Kg / Roll)',
    category: 'Material Packing',
    binLocation: 'B-04-L1',
    zone: 'Zona B (Bulk Pallet)',
    stockOnHand: 145,
    reservedStock: 30,
    reorderPoint: 50,
    maxCapacity: 200,
    unit: 'Roll',
    rotationMethod: 'FIFO',
    batchNo: 'BATCH-2610-ST1',
    lastUpdated: 'Kemarin, 15:10 WIB',
    unitValueRp: 135000
  },
  {
    id: 'sku-8',
    skuCode: 'AKK-PRD-025',
    name: 'Paper Cup Hot 8 Oz Custom Print + Lid (1 Karton = 1.000 Pcs)',
    category: 'Produk Distribusi',
    binLocation: 'A-04-L1',
    zone: 'Zona A (Fast Moving)',
    stockOnHand: 275,
    reservedStock: 95,
    reorderPoint: 100,
    maxCapacity: 400,
    unit: 'Karton',
    rotationMethod: 'FEFO',
    batchNo: 'BATCH-2610-PC8',
    lastUpdated: 'Hari ini, 11:00 WIB',
    unitValueRp: 385000
  }
];

const INITIAL_INBOUND_RECORDS: InboundAsnRecord[] = [
  {
    id: 'inb-1',
    asnNumber: 'ASN-202610-081',
    poReference: 'PO-AKK-2610-114',
    supplierOrSource: 'Lini Produksi Corrugator 1 (Internal Pabrik AKK)',
    arrivalTime: '07:30 WIB',
    vehiclePlate: 'CONVEYOR-L1',
    skuSummary: 'Karton Box B-Flute 60x40x40 cm (Polos)',
    totalQty: 2500,
    unit: 'Pcs',
    qcStatus: 'QC Lolos (100%)',
    stage: 'completed',
    targetBin: 'A-01-L1',
    receiverPic: 'Hendra Wijaya (Admin Inbound)',
    photoVerified: true
  },
  {
    id: 'inb-2',
    asnNumber: 'ASN-202610-082',
    poReference: 'PO-SUP-2610-049',
    supplierOrSource: 'PT. Indo Polimer Kemasan (Surabaya)',
    arrivalTime: '09:15 WIB',
    vehiclePlate: 'L 9482 UQ',
    skuSummary: 'Stretch Film Pallet Wrap 50cm & Plastik HD/PE Ball',
    totalQty: 180,
    unit: 'Ball / Roll',
    qcStatus: 'QC Lolos (100%)',
    stage: 'putaway',
    targetBin: 'A-03-L1 & D-01-L1',
    receiverPic: 'Rudi Hartono (Checker Dock In)',
    photoVerified: false
  },
  {
    id: 'inb-3',
    asnNumber: 'ASN-202610-083',
    poReference: 'PO-SUP-2610-052',
    supplierOrSource: 'PT. Kertas Kraft Nusantara (Mojokerto)',
    arrivalTime: '10:40 WIB',
    vehiclePlate: 'S 8821 UP',
    skuSummary: 'Karton Box Double Wall CB-Flute Export 80x50x50 cm',
    totalQty: 1500,
    unit: 'Pcs',
    qcStatus: 'Menunggu QC',
    stage: 'qc_check',
    targetBin: 'B-02-L1',
    receiverPic: 'Hendra Wijaya (Admin Inbound)',
    photoVerified: false
  },
  {
    id: 'inb-4',
    asnNumber: 'ASN-202610-084',
    poReference: 'PO-AKK-2610-119',
    supplierOrSource: 'Lini Cetak Offset Food Grade (Internal AKK)',
    arrivalTime: '11:20 WIB',
    vehiclePlate: 'FORKLIFT-02',
    skuSummary: 'Box Kemasan Makanan Food Grade Ivory 22x22x8 cm',
    totalQty: 4000,
    unit: 'Pcs',
    qcStatus: 'Menunggu QC',
    stage: 'unloading',
    targetBin: 'A-02-L2',
    receiverPic: 'Rudi Hartono (Checker Dock In)',
    photoVerified: false
  }
];

const INITIAL_OUTBOUND_ORDERS: OutboundPickingOrder[] = [
  {
    id: 'out-1',
    waveNumber: 'WAVE-2610-01',
    doNumber: 'SJ-AKK-2610-401',
    routeArea: 'Denpasar 1',
    customerOrStore: 'Toko Kemasan Bali Jaya & 4 Titik Mitra Denpasar 1',
    fleetPlate: 'P 8848 U',
    fleetCode: 'N4',
    driverName: 'Yulius',
    dockBay: 'Dock Bay 1 (Utama)',
    totalSku: 6,
    totalColli: 145,
    pickerPic: 'Dimas Pratama',
    checkerPic: 'Wahyu Setiawan',
    stage: 'loaded_dispatched',
    checklistVerified: {
      qtyMatched: true,
      packagingIntact: true,
      sealAttached: true,
      waybillSigned: true
    },
    departureTarget: '06:30 WIB',
    photoVerified: true
  },
  {
    id: 'out-2',
    waveNumber: 'WAVE-2610-02',
    doNumber: 'SJ-AKK-2610-402',
    routeArea: 'Denpasar 2',
    customerOrStore: 'Grosir Plastik & Box Kuta - Denpasar 2',
    fleetPlate: 'P 8125 VC',
    fleetCode: 'NS2',
    driverName: 'Nurhadi',
    dockBay: 'Dock Bay 2',
    totalSku: 5,
    totalColli: 120,
    pickerPic: 'Agus Salim',
    checkerPic: 'Wahyu Setiawan',
    stage: 'staging_dock',
    checklistVerified: {
      qtyMatched: true,
      packagingIntact: true,
      sealAttached: false,
      waybillSigned: false
    },
    departureTarget: '11:30 WIB',
    photoVerified: false
  },
  {
    id: 'out-3',
    waveNumber: 'WAVE-2610-03',
    doNumber: 'SJ-AKK-2610-403',
    routeArea: 'Jember & Tanggul',
    customerOrStore: 'Mitra Grosir Kemasan Jember Kota & Rambipuji',
    fleetPlate: 'P 9677 VB',
    fleetCode: 'N2',
    driverName: 'Farid',
    dockBay: 'Dock Bay 3',
    totalSku: 8,
    totalColli: 190,
    pickerPic: 'Dimas Pratama',
    checkerPic: 'Bambang Checker',
    stage: 'packing',
    checklistVerified: {
      qtyMatched: true,
      packagingIntact: false,
      sealAttached: false,
      waybillSigned: false
    },
    departureTarget: '13:00 WIB',
    photoVerified: false
  },
  {
    id: 'out-4',
    waveNumber: 'WAVE-2610-04',
    doNumber: 'SJ-AKK-2610-404',
    routeArea: 'Banyuwangi Selatan (Rogojampi - Muncar)',
    customerOrStore: 'Sentra Pengolahan Ikan Muncar & Ritel Rogojampi',
    fleetPlate: 'P 9194 SA',
    fleetCode: 'N1',
    driverName: 'Yono',
    dockBay: 'Dock Bay 4',
    totalSku: 4,
    totalColli: 85,
    pickerPic: 'Eko Saputra',
    checkerPic: 'Bambang Checker',
    stage: 'picking',
    checklistVerified: {
      qtyMatched: false,
      packagingIntact: false,
      sealAttached: false,
      waybillSigned: false
    },
    departureTarget: '14:15 WIB',
    photoVerified: false
  }
];

const INITIAL_SLOTTING_BINS: RackSlottingBin[] = [
  // =========================================================================
  // LANTAI 1: GROUND FLOOR (1.800 m² - FAST MOVING & HEAVY PALLET - 4 TIER LEVELS)
  // =========================================================================
  {
    binCode: 'A-01',
    floor: 1,
    zoneId: 'A',
    zoneName: 'Zona A - Fast Moving (Dekat Loading Dock)',
    aisle: 'Lorong A1',
    level: 'Multi-Tier (4 Level)',
    category: 'Karton Box',
    totalLevels: 4,
    utilizationPct: 81,
    skuCount: 4,
    primaryItem: 'Karton Box Corrugated B-Flute 60x40x40 cm',
    currentQty: '4.850 / 6.000 Pcs',
    maxWeightKg: 4000,
    status: 'optimal',
    slottingRuleNotes: 'Posisi lantai 1 paling dekat dengan Dock Bay 1. Didedikasikan untuk karton box volume kirim harian tertinggi.',
    levels: [
      { levelNumber: 4, levelName: 'Level 4 (Top Overstock Beam - 4.5m)', heightM: 4.5, skuCode: 'AKK-KBX-001-OV', skuName: 'Buffer Overstock Karton B-Flute Flat Sheet', category: 'Karton Box', currentQty: '1.200 Pcs', utilizationPct: 50, maxWeightKg: 600, status: 'optimal' },
      { levelNumber: 3, levelName: 'Level 3 (Buffer Beam - 3.0m)', heightM: 3.0, skuCode: 'AKK-KBX-001', skuName: 'Karton Box Corrugated B-Flute 60x40x40 cm', category: 'Karton Box', currentQty: '1.500 Pcs', utilizationPct: 75, maxWeightKg: 900, status: 'optimal' },
      { levelNumber: 2, levelName: 'Level 2 (Middle Picking Beam - 1.5m)', heightM: 1.5, skuCode: 'AKK-KBX-001', skuName: 'Karton Box Corrugated B-Flute (Picking)', category: 'Karton Box', currentQty: '1.800 Pcs', utilizationPct: 85, maxWeightKg: 1000, status: 'optimal' },
      { levelNumber: 1, levelName: 'Level 1 (Floor Pallet Heavy - 0.0m)', heightM: 0.0, skuCode: 'AKK-KBX-001', skuName: 'Karton Box Corrugated B-Flute (Full Pallet)', category: 'Karton Box', currentQty: '2.350 Pcs', utilizationPct: 92, maxWeightKg: 1500, status: 'full' }
    ]
  },
  {
    binCode: 'A-02',
    floor: 1,
    zoneId: 'A',
    zoneName: 'Zona A - Fast Moving (Dekat Loading Dock)',
    aisle: 'Lorong A1',
    level: 'Multi-Tier (4 Level)',
    category: 'Karton Box',
    totalLevels: 4,
    utilizationPct: 78,
    skuCount: 4,
    primaryItem: 'Karton Box Polos E-Flute 40x30x25 cm',
    currentQty: '3.600 / 4.500 Pcs',
    maxWeightKg: 3500,
    status: 'optimal',
    slottingRuleNotes: 'Karton box ukuran sedang untuk pengiriman rute Denpasar dan Jember.',
    levels: [
      { levelNumber: 4, levelName: 'Level 4 (Top Overstock Beam - 4.5m)', heightM: 4.5, skuCode: 'AKK-KBX-004-OV', skuName: 'Overstock Box E-Flute Flat', category: 'Karton Box', currentQty: '800 Pcs', utilizationPct: 45, maxWeightKg: 500, status: 'low' },
      { levelNumber: 3, levelName: 'Level 3 (Buffer Beam - 3.0m)', heightM: 3.0, skuCode: 'AKK-KBX-004', skuName: 'Karton Box Polos E-Flute 40x30x25 cm', category: 'Karton Box', currentQty: '1.100 Pcs', utilizationPct: 70, maxWeightKg: 850, status: 'optimal' },
      { levelNumber: 2, levelName: 'Level 2 (Middle Picking Beam - 1.5m)', heightM: 1.5, skuCode: 'AKK-KBX-004', skuName: 'Karton Box Polos E-Flute (Picking)', category: 'Karton Box', currentQty: '1.200 Pcs', utilizationPct: 80, maxWeightKg: 950, status: 'optimal' },
      { levelNumber: 1, levelName: 'Level 1 (Floor Pallet Heavy - 0.0m)', heightM: 0.0, skuCode: 'AKK-KBX-004', skuName: 'Karton Box Polos E-Flute (Full Pallet)', category: 'Karton Box', currentQty: '1.300 Pcs', utilizationPct: 86, maxWeightKg: 1200, status: 'optimal' }
    ]
  },
  {
    binCode: 'A-03',
    floor: 1,
    zoneId: 'A',
    zoneName: 'Zona A - Fast Moving (Dekat Loading Dock)',
    aisle: 'Lorong A2',
    level: 'Multi-Tier (4 Level)',
    category: 'Karton Box',
    totalLevels: 4,
    utilizationPct: 86,
    skuCount: 4,
    primaryItem: 'Karton Box C-Flute Tebal 50x35x35 cm',
    currentQty: '4.100 / 4.800 Pcs',
    maxWeightKg: 3800,
    status: 'optimal',
    slottingRuleNotes: 'Karton box standar industri olahan ikan dan buah Banyuwangi.',
    levels: [
      { levelNumber: 4, levelName: 'Level 4 (Top Overstock Beam - 4.5m)', heightM: 4.5, skuCode: 'AKK-KBX-005-OV', skuName: 'Overstock Sheet C-Flute', category: 'Karton Box', currentQty: '900 Pcs', utilizationPct: 60, maxWeightKg: 600, status: 'optimal' },
      { levelNumber: 3, levelName: 'Level 3 (Buffer Beam - 3.0m)', heightM: 3.0, skuCode: 'AKK-KBX-005', skuName: 'Karton Box C-Flute Buffer', category: 'Karton Box', currentQty: '1.200 Pcs', utilizationPct: 80, maxWeightKg: 900, status: 'optimal' },
      { levelNumber: 2, levelName: 'Level 2 (Middle Picking Beam - 1.5m)', heightM: 1.5, skuCode: 'AKK-KBX-005', skuName: 'Karton Box C-Flute (Picking Line)', category: 'Karton Box', currentQty: '1.350 Pcs', utilizationPct: 90, maxWeightKg: 1000, status: 'full' },
      { levelNumber: 1, levelName: 'Level 1 (Floor Pallet Heavy - 0.0m)', heightM: 0.0, skuCode: 'AKK-KBX-005', skuName: 'Karton Box C-Flute (Pallet Dasar)', category: 'Karton Box', currentQty: '1.550 Pcs', utilizationPct: 94, maxWeightKg: 1300, status: 'full' }
    ]
  },
  {
    binCode: 'A-04',
    floor: 1,
    zoneId: 'A',
    zoneName: 'Zona A - Fast Moving (Dekat Loading Dock)',
    aisle: 'Lorong A2',
    level: 'Multi-Tier (4 Level)',
    category: 'Karton Box',
    totalLevels: 4,
    utilizationPct: 70,
    skuCount: 3,
    primaryItem: 'Karton Box Corrugated Sablon 30x20x20 cm',
    currentQty: '2.800 / 4.000 Pcs',
    maxWeightKg: 3200,
    status: 'optimal',
    slottingRuleNotes: 'Karton box kecil fast moving untuk pengemasan ritel oleh-oleh.',
    levels: [
      { levelNumber: 4, levelName: 'Level 4 (Top Overstock Beam - 4.5m)', heightM: 4.5, skuCode: 'AKK-KBX-006-OV', skuName: 'Overstock Box Sablon Ritel', category: 'Karton Box', currentQty: '600 Pcs', utilizationPct: 40, maxWeightKg: 500, status: 'low' },
      { levelNumber: 3, levelName: 'Level 3 (Buffer Beam - 3.0m)', heightM: 3.0, skuCode: 'AKK-KBX-006', skuName: 'Karton Box Sablon Buffer', category: 'Karton Box', currentQty: '950 Pcs', utilizationPct: 68, maxWeightKg: 800, status: 'optimal' },
      { levelNumber: 2, levelName: 'Level 2 (Middle Picking Beam - 1.5m)', heightM: 1.5, skuCode: 'AKK-KBX-006', skuName: 'Karton Box Sablon (Picking)', category: 'Karton Box', currentQty: '1.250 Pcs', utilizationPct: 82, maxWeightKg: 900, status: 'optimal' },
      { levelNumber: 1, levelName: 'Level 1 (Floor Pallet Heavy - 0.0m)', heightM: 0.0, skuCode: 'AKK-KBX-006', skuName: 'Karton Box Sablon (Pallet Bawah)', category: 'Karton Box', currentQty: '1.200 Pcs', utilizationPct: 75, maxWeightKg: 1000, status: 'optimal' }
    ]
  },
  // Lorong B - Bulk Pallet Heavy Duty (Double Wall Export)
  {
    binCode: 'B-01',
    floor: 1,
    zoneId: 'B',
    zoneName: 'Zona B - Bulk Pallet & Heavy Carton',
    aisle: 'Lorong B1',
    level: 'Multi-Tier (4 Level Heavy)',
    category: 'Karton Box',
    totalLevels: 4,
    utilizationPct: 94,
    skuCount: 3,
    primaryItem: 'Karton Box Double Wall CB-Flute Export 80x50x50 cm',
    currentQty: '3.300 / 3.500 Pcs',
    maxWeightKg: 5000,
    status: 'full',
    slottingRuleNotes: 'Beban berat ekspor (> 40 kg/pallet stack). Wajib di Lantai 1 Ground dengan pondasi beton K-350.',
    levels: [
      { levelNumber: 4, levelName: 'Level 4 (Top Overstock Beam - 4.5m)', heightM: 4.5, skuCode: 'AKK-KBX-002-OV', skuName: 'Overstock Karton Double Wall Export', category: 'Karton Box', currentQty: '500 Pcs', utilizationPct: 80, maxWeightKg: 800, status: 'optimal' },
      { levelNumber: 3, levelName: 'Level 3 (Buffer Beam - 3.0m)', heightM: 3.0, skuCode: 'AKK-KBX-002', skuName: 'Karton Double Wall CB-Flute (Buffer)', category: 'Karton Box', currentQty: '800 Pcs', utilizationPct: 92, maxWeightKg: 1200, status: 'full' },
      { levelNumber: 2, levelName: 'Level 2 (Middle Beam - 1.5m)', heightM: 1.5, skuCode: 'AKK-KBX-002', skuName: 'Karton Double Wall CB-Flute (Pallet)', category: 'Karton Box', currentQty: '950 Pcs', utilizationPct: 95, maxWeightKg: 1400, status: 'full' },
      { levelNumber: 1, levelName: 'Level 1 (Floor Pallet Heavy - 0.0m)', heightM: 0.0, skuCode: 'AKK-KBX-002', skuName: 'Karton Double Wall CB-Flute (Heavy Base)', category: 'Karton Box', currentQty: '1.050 Pcs', utilizationPct: 98, maxWeightKg: 1600, status: 'full' }
    ]
  },
  {
    binCode: 'B-02',
    floor: 1,
    zoneId: 'B',
    zoneName: 'Zona B - Bulk Pallet & Heavy Carton',
    aisle: 'Lorong B1',
    level: 'Multi-Tier (4 Level Heavy)',
    category: 'Karton Box',
    totalLevels: 4,
    utilizationPct: 32,
    skuCount: 2,
    primaryItem: 'Karton Box Double Wall CB-Flute Export 80x50 cm',
    currentQty: '1.120 / 3.500 Pcs (Stok Rendah)',
    maxWeightKg: 5000,
    status: 'low',
    slottingRuleNotes: 'Slot prioritas pemuatan dari inbound produksi internal. Perlu reorder segera.',
    levels: [
      { levelNumber: 4, levelName: 'Level 4 (Top Overstock Beam - 4.5m)', heightM: 4.5, skuCode: 'AKK-KBX-002-OV', skuName: 'Slot Overstock Kosong', category: 'Karton Box', currentQty: '0 Pcs', utilizationPct: 0, maxWeightKg: 800, status: 'low' },
      { levelNumber: 3, levelName: 'Level 3 (Buffer Beam - 3.0m)', heightM: 3.0, skuCode: 'AKK-KBX-002', skuName: 'Karton Double Wall Buffer Menipis', category: 'Karton Box', currentQty: '250 Pcs', utilizationPct: 25, maxWeightKg: 1200, status: 'low' },
      { levelNumber: 2, levelName: 'Level 2 (Middle Beam - 1.5m)', heightM: 1.5, skuCode: 'AKK-KBX-002', skuName: 'Karton Double Wall Picking', category: 'Karton Box', currentQty: '380 Pcs', utilizationPct: 38, maxWeightKg: 1400, status: 'low' },
      { levelNumber: 1, levelName: 'Level 1 (Floor Pallet Heavy - 0.0m)', heightM: 0.0, skuCode: 'AKK-KBX-002', skuName: 'Karton Double Wall Pallet Dasar', category: 'Karton Box', currentQty: '490 Pcs', utilizationPct: 45, maxWeightKg: 1600, status: 'low' }
    ]
  },
  {
    binCode: 'B-03',
    floor: 1,
    zoneId: 'B',
    zoneName: 'Zona B - Bulk Pallet & Heavy Carton',
    aisle: 'Lorong B2',
    level: 'Multi-Tier (4 Level Heavy)',
    category: 'Karton Box',
    totalLevels: 4,
    utilizationPct: 83,
    skuCount: 3,
    primaryItem: 'Karton Box Ekspor Waxed Tahan Lembab Cold Storage',
    currentQty: '2.900 / 3.500 Pcs',
    maxWeightKg: 4500,
    status: 'optimal',
    slottingRuleNotes: 'Karton khusus pengiriman ikan beku dan hasil laut cold chain Pelabuhan Tanjung Wangi.',
    levels: [
      { levelNumber: 4, levelName: 'Level 4 (Top Overstock Beam - 4.5m)', heightM: 4.5, skuCode: 'AKK-KBX-007-OV', skuName: 'Overstock Box Waxed', category: 'Karton Box', currentQty: '550 Pcs', utilizationPct: 65, maxWeightKg: 750, status: 'optimal' },
      { levelNumber: 3, levelName: 'Level 3 (Buffer Beam - 3.0m)', heightM: 3.0, skuCode: 'AKK-KBX-007', skuName: 'Box Waxed Cold Storage Buffer', category: 'Karton Box', currentQty: '750 Pcs', utilizationPct: 82, maxWeightKg: 1100, status: 'optimal' },
      { levelNumber: 2, levelName: 'Level 2 (Middle Beam - 1.5m)', heightM: 1.5, skuCode: 'AKK-KBX-007', skuName: 'Box Waxed Cold Storage Picking', category: 'Karton Box', currentQty: '800 Pcs', utilizationPct: 88, maxWeightKg: 1250, status: 'optimal' },
      { levelNumber: 1, levelName: 'Level 1 (Floor Pallet Heavy - 0.0m)', heightM: 0.0, skuCode: 'AKK-KBX-007', skuName: 'Box Waxed Pallet Dasar', category: 'Karton Box', currentQty: '900 Pcs', utilizationPct: 92, maxWeightKg: 1400, status: 'full' }
    ]
  },
  {
    binCode: 'B-04',
    floor: 1,
    zoneId: 'B',
    zoneName: 'Zona B - Bulk Pallet & Heavy Carton',
    aisle: 'Lorong B2',
    level: 'Multi-Tier (4 Level Heavy)',
    category: 'Karton Box',
    totalLevels: 4,
    utilizationPct: 75,
    skuCount: 3,
    primaryItem: 'Karton Box Master Sparepart Alat Berat & Mesin',
    currentQty: '2.500 / 3.300 Pcs',
    maxWeightKg: 4800,
    status: 'optimal',
    slottingRuleNotes: 'Box triple wall tahan benturan untuk pelanggan perkebunan dan pabrik gula Glenmore.',
    levels: [
      { levelNumber: 4, levelName: 'Level 4 (Top Overstock Beam - 4.5m)', heightM: 4.5, skuCode: 'AKK-KBX-008-OV', skuName: 'Overstock Master Box', category: 'Karton Box', currentQty: '400 Pcs', utilizationPct: 55, maxWeightKg: 800, status: 'optimal' },
      { levelNumber: 3, levelName: 'Level 3 (Buffer Beam - 3.0m)', heightM: 3.0, skuCode: 'AKK-KBX-008', skuName: 'Master Box Industri Buffer', category: 'Karton Box', currentQty: '650 Pcs', utilizationPct: 74, maxWeightKg: 1200, status: 'optimal' },
      { levelNumber: 2, levelName: 'Level 2 (Middle Beam - 1.5m)', heightM: 1.5, skuCode: 'AKK-KBX-008', skuName: 'Master Box Industri Picking', category: 'Karton Box', currentQty: '700 Pcs', utilizationPct: 80, maxWeightKg: 1300, status: 'optimal' },
      { levelNumber: 1, levelName: 'Level 1 (Floor Pallet Heavy - 0.0m)', heightM: 0.0, skuCode: 'AKK-KBX-008', skuName: 'Master Box Industri Heavy Base', category: 'Karton Box', currentQty: '750 Pcs', utilizationPct: 85, maxWeightKg: 1500, status: 'optimal' }
    ]
  },
  // Lorong C - Plastik Kemasan, Stretch Film & Bubble Wrap
  {
    binCode: 'C-01',
    floor: 1,
    zoneId: 'C',
    zoneName: 'Zona C - Plastik & Kemasan Grosir',
    aisle: 'Lorong C1',
    level: 'Multi-Tier (4 Level)',
    category: 'Plastik & Wrap',
    totalLevels: 4,
    utilizationPct: 70,
    skuCount: 4,
    primaryItem: 'Plastik Kemasan HD/PE Grosir Uk. 35x55 cm',
    currentQty: '420 / 600 Ball',
    maxWeightKg: 3000,
    status: 'optimal',
    slottingRuleNotes: 'Plastik HD/PE volume tinggi untuk distributor toko plastik Bali & Jawa Timur.',
    levels: [
      { levelNumber: 4, levelName: 'Level 4 (Top Overstock Beam - 4.5m)', heightM: 4.5, skuCode: 'AKK-PLS-019-OV', skuName: 'Overstock Plastik HD Ball', category: 'Plastik & Wrap', currentQty: '60 Ball', utilizationPct: 40, maxWeightKg: 400, status: 'low' },
      { levelNumber: 3, levelName: 'Level 3 (Buffer Beam - 3.0m)', heightM: 3.0, skuCode: 'AKK-PLS-019', skuName: 'Plastik HD 35x55 Buffer', category: 'Plastik & Wrap', currentQty: '100 Ball', utilizationPct: 68, maxWeightKg: 700, status: 'optimal' },
      { levelNumber: 2, levelName: 'Level 2 (Middle Picking Beam - 1.5m)', heightM: 1.5, skuCode: 'AKK-PLS-019', skuName: 'Plastik HD 35x55 Picking', category: 'Plastik & Wrap', currentQty: '120 Ball', utilizationPct: 80, maxWeightKg: 850, status: 'optimal' },
      { levelNumber: 1, levelName: 'Level 1 (Floor Pallet Heavy - 0.0m)', heightM: 0.0, skuCode: 'AKK-PLS-019', skuName: 'Plastik HD 35x55 Pallet Dasar', category: 'Plastik & Wrap', currentQty: '140 Ball', utilizationPct: 88, maxWeightKg: 1050, status: 'optimal' }
    ]
  },
  {
    binCode: 'C-02',
    floor: 1,
    zoneId: 'C',
    zoneName: 'Zona C - Plastik & Kemasan Grosir',
    aisle: 'Lorong C1',
    level: 'Multi-Tier (4 Level)',
    category: 'Plastik & Wrap',
    totalLevels: 4,
    utilizationPct: 27,
    skuCount: 2,
    primaryItem: 'Stretch Film Pallet Wrap 50cm x 300m (17 Micron)',
    currentQty: '68 / 250 Roll (Stok Menipis)',
    maxWeightKg: 2000,
    status: 'low',
    slottingRuleNotes: 'Material wajib untuk pembungkusan pallet ekspedisi. Stok di bawah ROP.',
    levels: [
      { levelNumber: 4, levelName: 'Level 4 (Top Overstock Beam - 4.5m)', heightM: 4.5, skuCode: 'AKK-PLS-014-OV', skuName: 'Slot Kosong', category: 'Plastik & Wrap', currentQty: '0 Roll', utilizationPct: 0, maxWeightKg: 300, status: 'low' },
      { levelNumber: 3, levelName: 'Level 3 (Buffer Beam - 3.0m)', heightM: 3.0, skuCode: 'AKK-PLS-014', skuName: 'Stretch Film Buffer Menipis', category: 'Plastik & Wrap', currentQty: '15 Roll', utilizationPct: 20, maxWeightKg: 500, status: 'low' },
      { levelNumber: 2, levelName: 'Level 2 (Middle Picking Beam - 1.5m)', heightM: 1.5, skuCode: 'AKK-PLS-014', skuName: 'Stretch Film Hand Picking', category: 'Plastik & Wrap', currentQty: '25 Roll', utilizationPct: 35, maxWeightKg: 600, status: 'low' },
      { levelNumber: 1, levelName: 'Level 1 (Floor Pallet Heavy - 0.0m)', heightM: 0.0, skuCode: 'AKK-PLS-014', skuName: 'Stretch Film Pallet Ready', category: 'Plastik & Wrap', currentQty: '28 Roll', utilizationPct: 40, maxWeightKg: 600, status: 'low' }
    ]
  },
  {
    binCode: 'C-03',
    floor: 1,
    zoneId: 'C',
    zoneName: 'Zona C - Plastik & Kemasan Grosir',
    aisle: 'Lorong C2',
    level: 'Multi-Tier (4 Level)',
    category: 'Plastik & Wrap',
    totalLevels: 4,
    utilizationPct: 82,
    skuCount: 3,
    primaryItem: 'Bubble Wrap Heavy Roll 125cm x 50m (Bening & Hitam)',
    currentQty: '95 / 115 Roll',
    maxWeightKg: 1800,
    status: 'optimal',
    slottingRuleNotes: 'Rol besar bervolume tinggi namun bobot ringan. Cocok di rak middle & floor.',
    levels: [
      { levelNumber: 4, levelName: 'Level 4 (Top Overstock Beam - 4.5m)', heightM: 4.5, skuCode: 'AKK-PLS-022-OV', skuName: 'Overstock Bubble Roll', category: 'Plastik & Wrap', currentQty: '18 Roll', utilizationPct: 70, maxWeightKg: 300, status: 'optimal' },
      { levelNumber: 3, levelName: 'Level 3 (Buffer Beam - 3.0m)', heightM: 3.0, skuCode: 'AKK-PLS-022', skuName: 'Bubble Wrap Black Anti-Static', category: 'Plastik & Wrap', currentQty: '22 Roll', utilizationPct: 80, maxWeightKg: 450, status: 'optimal' },
      { levelNumber: 2, levelName: 'Level 2 (Middle Picking Beam - 1.5m)', heightM: 1.5, skuCode: 'AKK-PLS-022', skuName: 'Bubble Wrap Bening (Picking Line)', category: 'Plastik & Wrap', currentQty: '25 Roll', utilizationPct: 85, maxWeightKg: 500, status: 'optimal' },
      { levelNumber: 1, levelName: 'Level 1 (Floor Pallet Heavy - 0.0m)', heightM: 0.0, skuCode: 'AKK-PLS-022', skuName: 'Bubble Wrap Bening (Floor Roll Staging)', category: 'Plastik & Wrap', currentQty: '30 Roll', utilizationPct: 90, maxWeightKg: 550, status: 'full' }
    ]
  },
  {
    binCode: 'C-04',
    floor: 1,
    zoneId: 'C',
    zoneName: 'Zona C - Plastik & Kemasan Grosir',
    aisle: 'Lorong C2',
    level: 'Multi-Tier (4 Level)',
    category: 'Plastik & Wrap',
    totalLevels: 4,
    utilizationPct: 76,
    skuCount: 4,
    primaryItem: 'Kantong Klip Zipper & Plastik Vacuum Embossed',
    currentQty: '310 / 400 Ball',
    maxWeightKg: 2400,
    status: 'optimal',
    slottingRuleNotes: 'Plastik vakum untuk UMKM olahan beku dan kopi Robusta Ijen.',
    levels: [
      { levelNumber: 4, levelName: 'Level 4 (Top Overstock Beam - 4.5m)', heightM: 4.5, skuCode: 'AKK-PLS-030-OV', skuName: 'Overstock Plastik Vakum', category: 'Plastik & Wrap', currentQty: '50 Ball', utilizationPct: 55, maxWeightKg: 400, status: 'optimal' },
      { levelNumber: 3, levelName: 'Level 3 (Buffer Beam - 3.0m)', heightM: 3.0, skuCode: 'AKK-PLS-030', skuName: 'Plastik Klip Berbagai Ukuran (Buffer)', category: 'Plastik & Wrap', currentQty: '75 Ball', utilizationPct: 75, maxWeightKg: 600, status: 'optimal' },
      { levelNumber: 2, levelName: 'Level 2 (Middle Picking Beam - 1.5m)', heightM: 1.5, skuCode: 'AKK-PLS-030', skuName: 'Plastik Vakum Embossed (Picking)', category: 'Plastik & Wrap', currentQty: '85 Ball', utilizationPct: 82, maxWeightKg: 700, status: 'optimal' },
      { levelNumber: 1, levelName: 'Level 1 (Floor Pallet Heavy - 0.0m)', heightM: 0.0, skuCode: 'AKK-PLS-030', skuName: 'Plastik Vakum Embossed (Pallet Base)', category: 'Plastik & Wrap', currentQty: '100 Ball', utilizationPct: 90, maxWeightKg: 700, status: 'full' }
    ]
  },
  // Zona Staging Lantai 1 (Area Loading Dock & Transit)
  {
    binCode: 'STG-01',
    floor: 1,
    zoneId: 'D',
    zoneName: 'Zona D - Area Dock Bay 1 (Utama Denpasar 1)',
    aisle: 'Dock Outbound Bay 1',
    level: 'Floor Staging Line (P 8848 U)',
    category: 'Staging & Transit',
    totalLevels: 1,
    utilizationPct: 92,
    skuCount: 6,
    primaryItem: 'Konsolidasi Muatan Rute Denpasar 1 (145 Koli Selesai Muat)',
    currentQty: '145 / 160 Koli',
    maxWeightKg: 6000,
    status: 'full',
    slottingRuleNotes: 'Area staging dock depan pintu loading bay 1. Truk Engkel STD P 8848 U (Yulius).',
    levels: [
      { levelNumber: 1, levelName: 'Floor Staging Dock Bay 1', heightM: 0.0, skuCode: 'STG-DPS1', skuName: 'Muatan Siap Berangkat Denpasar 1', category: 'Staging & Transit', currentQty: '145 Koli', utilizationPct: 92, maxWeightKg: 6000, status: 'full' }
    ]
  },
  {
    binCode: 'STG-02',
    floor: 1,
    zoneId: 'D',
    zoneName: 'Zona D - Area Dock Bay 2 (Denpasar 2 Kuta)',
    aisle: 'Dock Outbound Bay 2',
    level: 'Floor Staging Line (P 8125 VC)',
    category: 'Staging & Transit',
    totalLevels: 1,
    utilizationPct: 80,
    skuCount: 5,
    primaryItem: 'Konsolidasi Muatan Rute Denpasar 2 (120 Koli Dalam Pemuatan)',
    currentQty: '120 / 150 Koli',
    maxWeightKg: 5000,
    status: 'optimal',
    slottingRuleNotes: 'Area staging dock depan pintu loading bay 2. Pick Up Box P 8125 VC (Nurhadi).',
    levels: [
      { levelNumber: 1, levelName: 'Floor Staging Dock Bay 2', heightM: 0.0, skuCode: 'STG-DPS2', skuName: 'Muatan Dalam Proses Muat Denpasar 2', category: 'Staging & Transit', currentQty: '120 Koli', utilizationPct: 80, maxWeightKg: 5000, status: 'optimal' }
    ]
  },
  {
    binCode: 'STG-03',
    floor: 1,
    zoneId: 'D',
    zoneName: 'Zona D - Area Dock Inbound & Lift Hoist',
    aisle: 'Dock Inbound & Lift Hoist',
    level: 'Floor Staging Receiving & Hoist 3T',
    category: 'Staging & Transit',
    totalLevels: 1,
    utilizationPct: 65,
    skuCount: 4,
    primaryItem: 'Area Penerimaan QC Inbound & Transfer Lift Barang ke Lantai 2',
    currentQty: '85 Koli Transit',
    maxWeightKg: 8000,
    status: 'optimal',
    slottingRuleNotes: 'Jalur transfer vertikal barang ringan menuju Mezzanine Lantai 2 via Freight Hoist 3 Ton.',
    levels: [
      { levelNumber: 1, levelName: 'Floor Inbound QC Staging', heightM: 0.0, skuCode: 'STG-INB', skuName: 'Pallet Penerimaan ASN Hari Ini', category: 'Staging & Transit', currentQty: '85 Koli', utilizationPct: 65, maxWeightKg: 8000, status: 'optimal' }
    ]
  },

  // =========================================================================
  // LANTAI 2: MEZZANINE FLOOR (900 m² - FOOD GRADE, CUP & PACKING ACCESSORIES - 3 TIER LEVELS)
  // =========================================================================
  {
    binCode: 'E-01',
    floor: 2,
    zoneId: 'E',
    zoneName: 'Zona E - Mezzanine Clean Food Grade',
    aisle: 'Lorong E1',
    level: 'Multi-Tier Mezzanine (3 Level)',
    category: 'Food Grade',
    totalLevels: 3,
    utilizationPct: 78,
    skuCount: 3,
    primaryItem: 'Box Kemasan Makanan Food Grade Ivory 22x22x8 cm',
    currentQty: '9.400 / 12.000 Pcs',
    maxWeightKg: 1800,
    status: 'optimal',
    slottingRuleNotes: 'Area Lantai 2 Mezzanine bebas debu lantai dock. Standar sanitasi ketat untuk kemasan food grade.',
    levels: [
      { levelNumber: 3, levelName: 'Level 3 (Top Shelf Carton - 2.8m)', heightM: 2.8, skuCode: 'AKK-KBX-003-OV', skuName: 'Buffer Box Ivory 22x22 Flat Pack', category: 'Food Grade', currentQty: '2.500 Pcs', utilizationPct: 65, maxWeightKg: 500, status: 'optimal' },
      { levelNumber: 2, levelName: 'Level 2 (Hand Pick Upper Tier - 1.8m)', heightM: 1.8, skuCode: 'AKK-KBX-003', skuName: 'Box Food Grade Ivory (Hand Picking)', category: 'Food Grade', currentQty: '3.400 Pcs', utilizationPct: 82, maxWeightKg: 650, status: 'optimal' },
      { levelNumber: 1, levelName: 'Level 1 (Hand Pick Lower Tier - 0.8m)', heightM: 0.8, skuCode: 'AKK-KBX-003', skuName: 'Box Food Grade Ivory (Floor Trolley)', category: 'Food Grade', currentQty: '3.500 Pcs', utilizationPct: 85, maxWeightKg: 650, status: 'optimal' }
    ]
  },
  {
    binCode: 'E-02',
    floor: 2,
    zoneId: 'E',
    zoneName: 'Zona E - Mezzanine Clean Food Grade',
    aisle: 'Lorong E1',
    level: 'Multi-Tier Mezzanine (3 Level)',
    category: 'Food Grade',
    totalLevels: 3,
    utilizationPct: 72,
    skuCount: 3,
    primaryItem: 'Box Lunch Brown Kraft Laminasi 18x18x7 cm',
    currentQty: '6.200 / 8.500 Pcs',
    maxWeightKg: 1600,
    status: 'optimal',
    slottingRuleNotes: 'Kemasan makanan ramah lingkungan eco-kraft untuk resto kuliner & katering Bali.',
    levels: [
      { levelNumber: 3, levelName: 'Level 3 (Top Shelf Carton - 2.8m)', heightM: 2.8, skuCode: 'AKK-FGD-011-OV', skuName: 'Buffer Lunchbox Kraft', category: 'Food Grade', currentQty: '1.500 Pcs', utilizationPct: 55, maxWeightKg: 450, status: 'optimal' },
      { levelNumber: 2, levelName: 'Level 2 (Hand Pick Upper Tier - 1.8m)', heightM: 1.8, skuCode: 'AKK-FGD-011', skuName: 'Lunchbox Kraft Laminasi (Picking)', category: 'Food Grade', currentQty: '2.200 Pcs', utilizationPct: 78, maxWeightKg: 550, status: 'optimal' },
      { levelNumber: 1, levelName: 'Level 1 (Hand Pick Lower Tier - 0.8m)', heightM: 0.8, skuCode: 'AKK-FGD-011', skuName: 'Lunchbox Kraft Laminasi (Dasar Rak)', category: 'Food Grade', currentQty: '2.500 Pcs', utilizationPct: 80, maxWeightKg: 600, status: 'optimal' }
    ]
  },
  {
    binCode: 'E-03',
    floor: 2,
    zoneId: 'E',
    zoneName: 'Zona E - Mezzanine Clean Food Grade',
    aisle: 'Lorong E2',
    level: 'Multi-Tier Mezzanine (3 Level)',
    category: 'Food Grade',
    totalLevels: 3,
    utilizationPct: 80,
    skuCount: 3,
    primaryItem: 'Paper Bowl Soup Food Grade 650ml & 800ml + Tutup',
    currentQty: '7.300 / 9.000 Pcs',
    maxWeightKg: 1500,
    status: 'optimal',
    slottingRuleNotes: 'Mangkuk sup anti bocor & tahan panas untuk hotel dan restoran.',
    levels: [
      { levelNumber: 3, levelName: 'Level 3 (Top Shelf Carton - 2.8m)', heightM: 2.8, skuCode: 'AKK-FGD-020-OV', skuName: 'Paper Bowl 800ml (Buffer)', category: 'Food Grade', currentQty: '1.800 Pcs', utilizationPct: 70, maxWeightKg: 400, status: 'optimal' },
      { levelNumber: 2, levelName: 'Level 2 (Hand Pick Upper Tier - 1.8m)', heightM: 1.8, skuCode: 'AKK-FGD-020', skuName: 'Paper Bowl 650ml (Picking)', category: 'Food Grade', currentQty: '2.500 Pcs', utilizationPct: 82, maxWeightKg: 550, status: 'optimal' },
      { levelNumber: 1, levelName: 'Level 1 (Hand Pick Lower Tier - 0.8m)', heightM: 0.8, skuCode: 'AKK-FGD-020', skuName: 'Paper Bowl + Lid Cembung Transparan', category: 'Food Grade', currentQty: '3.000 Pcs', utilizationPct: 86, maxWeightKg: 550, status: 'optimal' }
    ]
  },
  {
    binCode: 'E-04',
    floor: 2,
    zoneId: 'E',
    zoneName: 'Zona E - Mezzanine Clean Food Grade',
    aisle: 'Lorong E2',
    level: 'Multi-Tier Mezzanine (3 Level)',
    category: 'Food Grade',
    totalLevels: 3,
    utilizationPct: 82,
    skuCount: 3,
    primaryItem: 'Box Nasi Sekat 4 Food Grade & Snack Box Ivory 15x15',
    currentQty: '6.500 / 8.000 Pcs',
    maxWeightKg: 1600,
    status: 'optimal',
    slottingRuleNotes: 'Kemasan snack katering acara dinas dan gathering wisata Banyuwangi.',
    levels: [
      { levelNumber: 3, levelName: 'Level 3 (Top Shelf Carton - 2.8m)', heightM: 2.8, skuCode: 'AKK-FGD-025-OV', skuName: 'Snack Box Ivory Flat Pack', category: 'Food Grade', currentQty: '1.600 Pcs', utilizationPct: 68, maxWeightKg: 450, status: 'optimal' },
      { levelNumber: 2, levelName: 'Level 2 (Hand Pick Upper Tier - 1.8m)', heightM: 1.8, skuCode: 'AKK-FGD-025', skuName: 'Box Nasi Sekat 4 (Picking)', category: 'Food Grade', currentQty: '2.300 Pcs', utilizationPct: 85, maxWeightKg: 550, status: 'optimal' },
      { levelNumber: 1, levelName: 'Level 1 (Hand Pick Lower Tier - 0.8m)', heightM: 0.8, skuCode: 'AKK-FGD-025', skuName: 'Box Nasi Sekat 4 (Trolley)', category: 'Food Grade', currentQty: '2.600 Pcs', utilizationPct: 90, maxWeightKg: 600, status: 'full' }
    ]
  },
  // Lorong F - Cup Minuman & Tutup Lid
  {
    binCode: 'F-01',
    floor: 2,
    zoneId: 'F',
    zoneName: 'Zona F - Mezzanine Cup & Beverage Packaging',
    aisle: 'Lorong F1',
    level: 'Multi-Tier Mezzanine (3 Level)',
    category: 'Cup & Lid',
    totalLevels: 3,
    utilizationPct: 69,
    skuCount: 3,
    primaryItem: 'Paper Cup Hot 8 Oz + Tutup Lid Push-Cap Hitam/Putih',
    currentQty: '275 / 400 Karton',
    maxWeightKg: 1500,
    status: 'optimal',
    slottingRuleNotes: 'Gelas kopi hot cup untuk coffee shop jaringan hotel Ketapang & Kuta.',
    levels: [
      { levelNumber: 3, levelName: 'Level 3 (Top Shelf Carton - 2.8m)', heightM: 2.8, skuCode: 'AKK-CUP-008-OV', skuName: 'Paper Cup Hot 12 Oz Buffer', category: 'Cup & Lid', currentQty: '65 Karton', utilizationPct: 52, maxWeightKg: 400, status: 'optimal' },
      { levelNumber: 2, levelName: 'Level 2 (Hand Pick Upper Tier - 1.8m)', heightM: 1.8, skuCode: 'AKK-CUP-008', skuName: 'Paper Cup Hot 8 Oz (Picking)', category: 'Cup & Lid', currentQty: '95 Karton', utilizationPct: 75, maxWeightKg: 550, status: 'optimal' },
      { levelNumber: 1, levelName: 'Level 1 (Hand Pick Lower Tier - 0.8m)', heightM: 0.8, skuCode: 'AKK-CUP-008', skuName: 'Paper Cup Hot 8 Oz + Lid Combo', category: 'Cup & Lid', currentQty: '115 Karton', utilizationPct: 78, maxWeightKg: 550, status: 'optimal' }
    ]
  },
  {
    binCode: 'F-02',
    floor: 2,
    zoneId: 'F',
    zoneName: 'Zona F - Mezzanine Cup & Beverage Packaging',
    aisle: 'Lorong F1',
    level: 'Multi-Tier Mezzanine (3 Level)',
    category: 'Cup & Lid',
    totalLevels: 3,
    utilizationPct: 84,
    skuCount: 3,
    primaryItem: 'Cup Minuman Plastik PP 14 & 16 Oz Oval Boba Tebal',
    currentQty: '320 / 380 Karton',
    maxWeightKg: 1600,
    status: 'optimal',
    slottingRuleNotes: 'Gelas oval boba injection tebal untuk franchise minuman hits.',
    levels: [
      { levelNumber: 3, levelName: 'Level 3 (Top Shelf Carton - 2.8m)', heightM: 2.8, skuCode: 'AKK-CUP-016-OV', skuName: 'Cup PP 22 Oz Jumbo Buffer', category: 'Cup & Lid', currentQty: '70 Karton', utilizationPct: 72, maxWeightKg: 450, status: 'optimal' },
      { levelNumber: 2, levelName: 'Level 2 (Hand Pick Upper Tier - 1.8m)', heightM: 1.8, skuCode: 'AKK-CUP-016', skuName: 'Cup PP 16 Oz Oval (Picking)', category: 'Cup & Lid', currentQty: '115 Karton', utilizationPct: 86, maxWeightKg: 550, status: 'optimal' },
      { levelNumber: 1, levelName: 'Level 1 (Hand Pick Lower Tier - 0.8m)', heightM: 0.8, skuCode: 'AKK-CUP-016', skuName: 'Cup PP 14 Oz Standar (Dasar Rak)', category: 'Cup & Lid', currentQty: '135 Karton', utilizationPct: 92, maxWeightKg: 600, status: 'full' }
    ]
  },
  {
    binCode: 'F-03',
    floor: 2,
    zoneId: 'F',
    zoneName: 'Zona F - Mezzanine Cup & Beverage Packaging',
    aisle: 'Lorong F2',
    level: 'Multi-Tier Mezzanine (3 Level)',
    category: 'Cup & Lid',
    totalLevels: 3,
    utilizationPct: 88,
    skuCount: 3,
    primaryItem: 'Tutup Cup Cembung Dome Lid & Strawless Lid 95mm',
    currentQty: '450 / 510 Karton',
    maxWeightKg: 1400,
    status: 'full',
    slottingRuleNotes: 'Tutup cup PET bening higienis isi 1.000 pcs/karton.',
    levels: [
      { levelNumber: 3, levelName: 'Level 3 (Top Shelf Carton - 2.8m)', heightM: 2.8, skuCode: 'AKK-LID-095-OV', skuName: 'Strawless Lid Transparan Buffer', category: 'Cup & Lid', currentQty: '110 Karton', utilizationPct: 82, maxWeightKg: 400, status: 'optimal' },
      { levelNumber: 2, levelName: 'Level 2 (Hand Pick Upper Tier - 1.8m)', heightM: 1.8, skuCode: 'AKK-LID-095', skuName: 'Flat Lid Datar 95mm (Picking)', category: 'Cup & Lid', currentQty: '160 Karton', utilizationPct: 90, maxWeightKg: 500, status: 'full' },
      { levelNumber: 1, levelName: 'Level 1 (Hand Pick Lower Tier - 0.8m)', heightM: 0.8, skuCode: 'AKK-LID-095', skuName: 'Dome Lid Cembung (Dasar Rak)', category: 'Cup & Lid', currentQty: '180 Karton', utilizationPct: 94, maxWeightKg: 500, status: 'full' }
    ]
  },
  {
    binCode: 'F-04',
    floor: 2,
    zoneId: 'F',
    zoneName: 'Zona F - Mezzanine Cup & Beverage Packaging',
    aisle: 'Lorong F2',
    level: 'Multi-Tier Mezzanine (3 Level)',
    category: 'Cup & Lid',
    totalLevels: 3,
    utilizationPct: 76,
    skuCount: 3,
    primaryItem: 'Sedotan Kertas Steril & Kantong T-Bag Takeaway',
    currentQty: '380 / 500 Karton',
    maxWeightKg: 1400,
    status: 'optimal',
    slottingRuleNotes: 'Aksesoris minum takeaway ramah lingkungan standar hotel berbintang.',
    levels: [
      { levelNumber: 3, levelName: 'Level 3 (Top Shelf Carton - 2.8m)', heightM: 2.8, skuCode: 'AKK-ACC-033-OV', skuName: 'Cup Carrier Kraft 2 Cup (Buffer)', category: 'Cup & Lid', currentQty: '80 Karton', utilizationPct: 62, maxWeightKg: 400, status: 'optimal' },
      { levelNumber: 2, levelName: 'Level 2 (Hand Pick Upper Tier - 1.8m)', heightM: 1.8, skuCode: 'AKK-ACC-033', skuName: 'Sedotan Kertas Steril 12mm Boba', category: 'Cup & Lid', currentQty: '140 Karton', utilizationPct: 78, maxWeightKg: 500, status: 'optimal' },
      { levelNumber: 1, levelName: 'Level 1 (Hand Pick Lower Tier - 0.8m)', heightM: 0.8, skuCode: 'AKK-ACC-033', skuName: 'Plastik T-Bag Cup 1 & 2 Gelas', category: 'Cup & Lid', currentQty: '160 Karton', utilizationPct: 85, maxWeightKg: 500, status: 'optimal' }
    ]
  },
  // Lorong G - Lakban, Strapping Band & Material Finishing Packing
  {
    binCode: 'G-01',
    floor: 2,
    zoneId: 'G',
    zoneName: 'Zona G - Material Packing & Finishing',
    aisle: 'Lorong G1',
    level: 'Multi-Tier Mezzanine (3 Level)',
    category: 'Lakban & Aksesoris',
    totalLevels: 3,
    utilizationPct: 21,
    skuCount: 2,
    primaryItem: 'Lakban OPP Coklat Heavy Duty 48mm x 90 Yard',
    currentQty: '32 / 150 Karton (Stok Kritis)',
    maxWeightKg: 1200,
    status: 'low',
    slottingRuleNotes: 'Material habis pakai lini pengepakan karton. Stok di bawah safety stock.',
    levels: [
      { levelNumber: 3, levelName: 'Level 3 (Top Shelf Carton - 2.8m)', heightM: 2.8, skuCode: 'AKK-MPK-007-OV', skuName: 'Slot Kosong', category: 'Lakban & Aksesoris', currentQty: '0 Karton', utilizationPct: 0, maxWeightKg: 350, status: 'low' },
      { levelNumber: 2, levelName: 'Level 2 (Hand Pick Upper Tier - 1.8m)', heightM: 1.8, skuCode: 'AKK-MPK-007', skuName: 'Lakban Bening Clear 48mm', category: 'Lakban & Aksesoris', currentQty: '12 Karton', utilizationPct: 24, maxWeightKg: 400, status: 'low' },
      { levelNumber: 1, levelName: 'Level 1 (Hand Pick Lower Tier - 0.8m)', heightM: 0.8, skuCode: 'AKK-MPK-007', skuName: 'Lakban OPP Coklat 48mm', category: 'Lakban & Aksesoris', currentQty: '20 Karton', utilizationPct: 35, maxWeightKg: 450, status: 'low' }
    ]
  },
  {
    binCode: 'G-02',
    floor: 2,
    zoneId: 'G',
    zoneName: 'Zona G - Material Packing & Finishing',
    aisle: 'Lorong G1',
    level: 'Multi-Tier Mezzanine (3 Level)',
    category: 'Lakban & Aksesoris',
    totalLevels: 3,
    utilizationPct: 73,
    skuCount: 3,
    primaryItem: 'Strapping Band PP 15mm Kuning Mesin & Klem Seng',
    currentQty: '145 / 200 Roll',
    maxWeightKg: 1600,
    status: 'optimal',
    slottingRuleNotes: 'Tali pengikat karton berat dan klem segel untuk ekspedisi luar pulau.',
    levels: [
      { levelNumber: 3, levelName: 'Level 3 (Top Shelf Carton - 2.8m)', heightM: 2.8, skuCode: 'AKK-STP-015-OV', skuName: 'Klem Seng Strapping (40 Dus)', category: 'Lakban & Aksesoris', currentQty: '40 Dus', utilizationPct: 65, maxWeightKg: 400, status: 'optimal' },
      { levelNumber: 2, levelName: 'Level 2 (Hand Pick Upper Tier - 1.8m)', heightM: 1.8, skuCode: 'AKK-STP-015', skuName: 'Strapping Band Hitam 12mm', category: 'Lakban & Aksesoris', currentQty: '45 Roll', utilizationPct: 72, maxWeightKg: 550, status: 'optimal' },
      { levelNumber: 1, levelName: 'Level 1 (Hand Pick Lower Tier - 0.8m)', heightM: 0.8, skuCode: 'AKK-STP-015', skuName: 'Strapping Band Kuning Mesin 15mm', category: 'Lakban & Aksesoris', currentQty: '60 Roll', utilizationPct: 80, maxWeightKg: 650, status: 'optimal' }
    ]
  },
  {
    binCode: 'G-03',
    floor: 2,
    zoneId: 'G',
    zoneName: 'Zona G - Material Packing & Finishing',
    aisle: 'Lorong G2',
    level: 'Multi-Tier Mezzanine (3 Level)',
    category: 'Lakban & Aksesoris',
    totalLevels: 3,
    utilizationPct: 60,
    skuCount: 3,
    primaryItem: 'Lem Hot Melt Glue Stick Packaging & Dispenser Besi',
    currentQty: '65 / 110 Karton',
    maxWeightKg: 1300,
    status: 'optimal',
    slottingRuleNotes: 'Lem perekat industri kardus dan perlengkapan packing tim checker.',
    levels: [
      { levelNumber: 3, levelName: 'Level 3 (Top Shelf Carton - 2.8m)', heightM: 2.8, skuCode: 'AKK-GLU-004-OV', skuName: 'Cutter Logistik & Pisau Refill', category: 'Lakban & Aksesoris', currentQty: '15 Box', utilizationPct: 40, maxWeightKg: 300, status: 'low' },
      { levelNumber: 2, levelName: 'Level 2 (Hand Pick Upper Tier - 1.8m)', heightM: 1.8, skuCode: 'AKK-GLU-004', skuName: 'Tape Dispenser Besi Heavy Duty', category: 'Lakban & Aksesoris', currentQty: '22 Unit', utilizationPct: 60, maxWeightKg: 450, status: 'optimal' },
      { levelNumber: 1, levelName: 'Level 1 (Hand Pick Lower Tier - 0.8m)', heightM: 0.8, skuCode: 'AKK-GLU-004', skuName: 'Hot Melt Glue Stick 11mm', category: 'Lakban & Aksesoris', currentQty: '28 Karton', utilizationPct: 75, maxWeightKg: 550, status: 'optimal' }
    ]
  },
  {
    binCode: 'G-04',
    floor: 2,
    zoneId: 'G',
    zoneName: 'Zona G - Material Packing & Finishing',
    aisle: 'Lorong G2',
    level: 'Multi-Tier Mezzanine (3 Level)',
    category: 'Lakban & Aksesoris',
    totalLevels: 3,
    utilizationPct: 72,
    skuCount: 3,
    primaryItem: 'Kertas Kraft Samson & Stiker Label Barcode Thermal',
    currentQty: '85 / 120 Karton',
    maxWeightKg: 1500,
    status: 'optimal',
    slottingRuleNotes: 'Label stiker barcode 100x150 mm untuk resi pengiriman armada ekspedisi.',
    levels: [
      { levelNumber: 3, levelName: 'Level 3 (Top Shelf Carton - 2.8m)', heightM: 2.8, skuCode: 'AKK-LBL-100-OV', skuName: 'Silica Gel Penyerap Lembab', category: 'Lakban & Aksesoris', currentQty: '20 Karton', utilizationPct: 55, maxWeightKg: 400, status: 'optimal' },
      { levelNumber: 2, levelName: 'Level 2 (Hand Pick Upper Tier - 1.8m)', heightM: 1.8, skuCode: 'AKK-LBL-100', skuName: 'Kertas Kraft Samson Coklat', category: 'Lakban & Aksesoris', currentQty: '30 Karton', utilizationPct: 75, maxWeightKg: 500, status: 'optimal' },
      { levelNumber: 1, levelName: 'Level 1 (Hand Pick Lower Tier - 0.8m)', heightM: 0.8, skuCode: 'AKK-LBL-100', skuName: 'Stiker Thermal Barcode 100x150', category: 'Lakban & Aksesoris', currentQty: '35 Karton', utilizationPct: 82, maxWeightKg: 600, status: 'optimal' }
    ]
  },
  // Lorong H - Die-Cut Custom Box & Karantina Retur
  {
    binCode: 'H-01',
    floor: 2,
    zoneId: 'H',
    zoneName: 'Zona H - Die-Cut Custom Box & Karantina',
    aisle: 'Lorong H1',
    level: 'Multi-Tier Mezzanine (3 Level)',
    category: 'Karton Box',
    totalLevels: 3,
    utilizationPct: 75,
    skuCount: 3,
    primaryItem: 'Box Pizza Corrugated E-Flute 25x25x5 cm Custom Print',
    currentQty: '2.800 / 3.800 Pcs',
    maxWeightKg: 1400,
    status: 'optimal',
    slottingRuleNotes: 'Box pizza pesanan khusus gerai pizza & bakery Bali & Jember.',
    levels: [
      { levelNumber: 3, levelName: 'Level 3 (Top Shelf Carton - 2.8m)', heightM: 2.8, skuCode: 'AKK-CST-025-OV', skuName: 'Buffer Box Pizza Flat Sheet', category: 'Karton Box', currentQty: '600 Pcs', utilizationPct: 50, maxWeightKg: 400, status: 'optimal' },
      { levelNumber: 2, levelName: 'Level 2 (Hand Pick Upper Tier - 1.8m)', heightM: 1.8, skuCode: 'AKK-CST-025', skuName: 'Box Pizza 25x25 (Picking Line)', category: 'Karton Box', currentQty: '1.050 Pcs', utilizationPct: 80, maxWeightKg: 500, status: 'optimal' },
      { levelNumber: 1, levelName: 'Level 1 (Hand Pick Lower Tier - 0.8m)', heightM: 0.8, skuCode: 'AKK-CST-025', skuName: 'Box Pizza 25x25 (Dasar Rak)', category: 'Karton Box', currentQty: '1.150 Pcs', utilizationPct: 88, maxWeightKg: 500, status: 'optimal' }
    ]
  },
  {
    binCode: 'H-02',
    floor: 2,
    zoneId: 'H',
    zoneName: 'Zona H - Die-Cut Custom Box & Karantina',
    aisle: 'Lorong H1',
    level: 'Multi-Tier Mezzanine (3 Level)',
    category: 'Karton Box',
    totalLevels: 3,
    utilizationPct: 70,
    skuCount: 3,
    primaryItem: 'Box Hamper Corrugated Premium & Gift Box Jinjing',
    currentQty: '2.100 / 3.000 Pcs',
    maxWeightKg: 1400,
    status: 'optimal',
    slottingRuleNotes: 'Box parcel musiman Idul Fitri & Natal dengan handle tali rami.',
    levels: [
      { levelNumber: 3, levelName: 'Level 3 (Top Shelf Carton - 2.8m)', heightM: 2.8, skuCode: 'AKK-CST-040-OV', skuName: 'Sample Box Master Baru', category: 'Karton Box', currentQty: '400 Pcs', utilizationPct: 45, maxWeightKg: 400, status: 'low' },
      { levelNumber: 2, levelName: 'Level 2 (Hand Pick Upper Tier - 1.8m)', heightM: 1.8, skuCode: 'AKK-CST-040', skuName: 'Box Toples Kue Kering (Picking)', category: 'Karton Box', currentQty: '800 Pcs', utilizationPct: 75, maxWeightKg: 500, status: 'optimal' },
      { levelNumber: 1, levelName: 'Level 1 (Hand Pick Lower Tier - 0.8m)', heightM: 0.8, skuCode: 'AKK-CST-040', skuName: 'Box Hamper Premium (Dasar Rak)', category: 'Karton Box', currentQty: '900 Pcs', utilizationPct: 82, maxWeightKg: 500, status: 'optimal' }
    ]
  },
  {
    binCode: 'H-03',
    floor: 2,
    zoneId: 'H',
    zoneName: 'Zona H - Die-Cut Custom Box & Karantina',
    aisle: 'Lorong H2',
    level: 'Multi-Tier Mezzanine (3 Level)',
    category: 'Staging & Transit',
    totalLevels: 3,
    utilizationPct: 35,
    skuCount: 2,
    primaryItem: 'Karantina Retur Pelanggan & Barang Sortir QC Review',
    currentQty: '18 / 60 Koli',
    maxWeightKg: 1200,
    status: 'low',
    slottingRuleNotes: 'Zona terisolasi untuk barang klaim retur pelanggan sebelum keputusan approval repair / scrap.',
    levels: [
      { levelNumber: 3, levelName: 'Level 3 (Top Shelf Carton - 2.8m)', heightM: 2.8, skuCode: 'QC-REJ-001', skuName: 'Barang Reject Lini Cetak (BS)', category: 'Staging & Transit', currentQty: '4 Koli', utilizationPct: 20, maxWeightKg: 300, status: 'low' },
      { levelNumber: 2, levelName: 'Level 2 (Hand Pick Upper Tier - 1.8m)', heightM: 1.8, skuCode: 'QC-RTN-002', skuName: 'Retur Pelanggan Denpasar (Review QC)', category: 'Staging & Transit', currentQty: '6 Koli', utilizationPct: 35, maxWeightKg: 450, status: 'low' },
      { levelNumber: 1, levelName: 'Level 1 (Hand Pick Lower Tier - 0.8m)', heightM: 0.8, skuCode: 'QC-RTN-001', skuName: 'Retur Pelanggan Jember (Menunggu Bon)', category: 'Staging & Transit', currentQty: '8 Koli', utilizationPct: 45, maxWeightKg: 450, status: 'low' }
    ]
  },
  {
    binCode: 'H-04',
    floor: 2,
    zoneId: 'H',
    zoneName: 'Zona H - Die-Cut Custom Box & Karantina',
    aisle: 'Lorong H2',
    level: 'Multi-Tier Mezzanine (3 Level Buffer Kosong)',
    category: 'Staging & Transit',
    totalLevels: 3,
    utilizationPct: 0,
    skuCount: 0,
    primaryItem: 'Slot Cadangan Mezzanine (Ready to Allocate)',
    currentQty: '0 / 60 Koli (Siap Pakai)',
    maxWeightKg: 1500,
    status: 'low',
    slottingRuleNotes: 'Rak buffer kosong untuk lonjakan stok musiman (Peak Season Q4).',
    levels: [
      { levelNumber: 3, levelName: 'Level 3 (Top Shelf Carton - 2.8m)', heightM: 2.8, skuCode: 'EMPTY', skuName: 'Slot Kosong Siap Alokasi', category: 'Staging & Transit', currentQty: '0 Koli', utilizationPct: 0, maxWeightKg: 400, status: 'low' },
      { levelNumber: 2, levelName: 'Level 2 (Hand Pick Upper Tier - 1.8m)', heightM: 1.8, skuCode: 'EMPTY', skuName: 'Slot Kosong Siap Alokasi', category: 'Staging & Transit', currentQty: '0 Koli', utilizationPct: 0, maxWeightKg: 500, status: 'low' },
      { levelNumber: 1, levelName: 'Level 1 (Hand Pick Lower Tier - 0.8m)', heightM: 0.8, skuCode: 'EMPTY', skuName: 'Slot Kosong Siap Alokasi', category: 'Staging & Transit', currentQty: '0 Koli', utilizationPct: 0, maxWeightKg: 600, status: 'low' }
    ]
  }
];

const INITIAL_OPNAME_SHEETS: StockOpnameSheet[] = [
  {
    id: 'opn-1',
    opnameCode: 'OPN-2610-01',
    date: '25 Okt 2026',
    zone: 'Zona A (Fast Moving)',
    binLocation: 'A-01-L1',
    skuCode: 'AKK-KBX-001',
    skuName: 'Karton Box Corrugated B-Flute 60x40x40 cm (Polos)',
    systemStock: 4850,
    physicalStock: 4850,
    unit: 'Pcs',
    auditorPic: 'Surya Dharma (Tim Audit Internal)',
    status: 'Sesuai (Match)',
    notes: 'Perhitungan fisik klop 100% sesuai kartu stok.'
  },
  {
    id: 'opn-2',
    opnameCode: 'OPN-2610-02',
    date: '25 Okt 2026',
    zone: 'Zona D (Pendukung)',
    binLocation: 'D-02-L2',
    skuCode: 'AKK-MPK-007',
    skuName: 'Lakban OPP Coklat Heavy Duty 48mm x 90 Yard',
    systemStock: 34,
    physicalStock: 32,
    unit: 'Karton',
    auditorPic: 'Surya Dharma (Tim Audit Internal)',
    status: 'Menunggu Verifikasi',
    notes: 'Selisih -2 Karton dipakai darurat oleh Lini Packing 2 (belum input bon pemakaian).'
  },
  {
    id: 'opn-3',
    opnameCode: 'OPN-2610-03',
    date: '24 Okt 2026',
    zone: 'Zona B (Bulk Pallet)',
    binLocation: 'B-02-L1',
    skuCode: 'AKK-KBX-002',
    skuName: 'Karton Box Double Wall CB-Flute Export 80x50x50 cm',
    systemStock: 1125,
    physicalStock: 1120,
    unit: 'Pcs',
    auditorPic: 'Hendra Wijaya',
    status: 'Disetujui (Adjusted)',
    notes: '5 Pcs lembab dipindahkan ke area karantina/scrap.'
  },
  {
    id: 'opn-4',
    opnameCode: 'OPN-2610-04',
    date: '24 Okt 2026',
    zone: 'Zona A (Fast Moving)',
    binLocation: 'A-03-L1',
    skuCode: 'AKK-PLS-019',
    skuName: 'Plastik Kemasan HD/PE Grosir Uk. 35x55 cm',
    systemStock: 420,
    physicalStock: 420,
    unit: 'Ball',
    auditorPic: 'Wahyu Setiawan',
    status: 'Sesuai (Match)',
    notes: 'Kondisi pallet rapi, label FIFO terpasang lengkap.'
  }
];

const INITIAL_LEDGER: StockLedgerEntry[] = [
  { id: 'ldg-1', timestamp: '25 Okt 2026, 10:15', txType: 'INBOUND', referenceNo: 'ASN-202610-081', skuCode: 'AKK-KBX-001', skuName: 'Karton Box B-Flute 60x40x40 cm', qtyChange: '+2.500 Pcs', balanceAfter: 4850, binLocation: 'A-01-L1', pic: 'Hendra Wijaya' },
  { id: 'ldg-2', timestamp: '25 Okt 2026, 08:40', txType: 'OUTBOUND', referenceNo: 'SJ-AKK-2610-401', skuCode: 'AKK-KBX-001', skuName: 'Karton Box B-Flute 60x40x40 cm', qtyChange: '-650 Pcs', balanceAfter: 2350, binLocation: 'A-01-L1', pic: 'Wahyu Setiawan' },
  { id: 'ldg-3', timestamp: '25 Okt 2026, 08:10', txType: 'OUTBOUND', referenceNo: 'SJ-AKK-2610-401', skuCode: 'AKK-PLS-019', skuName: 'Plastik Kemasan HD/PE Grosir 35x55', qtyChange: '-45 Ball', balanceAfter: 420, binLocation: 'A-03-L1', pic: 'Dimas Pratama' },
  { id: 'ldg-4', timestamp: '24 Okt 2026, 16:20', txType: 'OPNAME_ADJ', referenceNo: 'OPN-2610-03', skuCode: 'AKK-KBX-002', skuName: 'Karton Box Double Wall CB-Flute 80x50', qtyChange: '-5 Pcs', balanceAfter: 1120, binLocation: 'B-02-L1', pic: 'Surya Dharma' }
];

const INITIAL_SCAN_RECORDS: ScanAuditRecord[] = [
  {
    id: 'scn-1',
    timestamp: '25 Okt 2026, 11:05 WIB',
    mode: 'INBOUND',
    skuCode: 'AKK-KBX-001',
    skuName: 'Karton Box Corrugated B-Flute 60x40x40 cm (Polos)',
    batchNo: 'BATCH-2610-A1',
    binLocation: 'A-01-L1',
    detectedQty: 2500,
    unit: 'Pcs',
    verificationStatus: 'Lolos QC & Tersinkron',
    targetReference: 'ASN-202610-081',
    operatorPic: 'Hendra Wijaya (Checker Inbound)'
  },
  {
    id: 'scn-2',
    timestamp: '25 Okt 2026, 09:40 WIB',
    mode: 'OUTBOUND',
    skuCode: 'AKK-PLS-019',
    skuName: 'Plastik Kemasan HD/PE Grosir Uk. 35x55 cm',
    batchNo: 'BATCH-2610-P3',
    binLocation: 'A-03-L1',
    detectedQty: 45,
    unit: 'Ball',
    verificationStatus: 'Cocok dengan DO',
    targetReference: 'SJ-AKK-2610-401 (Denpasar 1)',
    operatorPic: 'Wahyu Setiawan (Checker Outbound)'
  }
];

export const WarehouseManagementSystem: React.FC<{
  initialTab?: WmsSubTab;
  onNavigateTab?: (tab: WmsSubTab) => void;
}> = ({ initialTab = 'overview', onNavigateTab }) => {
  const [activeTab, setActiveTab] = useState<WmsSubTab>(initialTab);
  const [skuItems, setSkuItems] = useState<WmsSkuItem[]>(INITIAL_SKU_ITEMS);
  const [inboundRecords, setInboundRecords] = useState<InboundAsnRecord[]>(INITIAL_INBOUND_RECORDS);
  const [outboundOrders, setOutboundOrders] = useState<OutboundPickingOrder[]>(INITIAL_OUTBOUND_ORDERS);
  const [opnameSheets, setOpnameSheets] = useState<StockOpnameSheet[]>(INITIAL_OPNAME_SHEETS);
  const [ledgerEntries, setLedgerEntries] = useState<StockLedgerEntry[]>(INITIAL_LEDGER);
  const [scanAuditLogs, setScanAuditLogs] = useState<ScanAuditRecord[]>(INITIAL_SCAN_RECORDS);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  const handleTabChange = (tab: WmsSubTab) => {
    setActiveTab(tab);
    if (onNavigateTab) {
      onNavigateTab(tab);
    }
  };

  // Filters for Inventory
  const [skuSearch, setSkuSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [stockStatusFilter, setStockStatusFilter] = useState<'ALL' | 'SAFE' | 'LOW'>('ALL');

  // Selected Bin in Slotting View & 2-Story Warehouse States
  const [selectedBin, setSelectedBin] = useState<RackSlottingBin>(INITIAL_SLOTTING_BINS[0]);
  const [selectedFloor, setSelectedFloor] = useState<1 | 2>(1);
  const [slottingViewMode, setSlottingViewMode] = useState<'category' | 'utilization' | 'weight'>('category');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('ALL');
  const [isAiSlottingLoading, setIsAiSlottingLoading] = useState(false);
  const [aiSlottingTips, setAiSlottingTips] = useState<{ title: string; category: string; action: string; impact: string }[] | null>(null);

  // Scanner States
  const [scannerMode, setScannerMode] = useState<'INBOUND' | 'OUTBOUND'>('INBOUND');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [isScanningSimulated, setIsScanningSimulated] = useState(false);
  const [scanSuccessMessage, setScanSuccessMessage] = useState<string | null>(null);
  const [isAiVisionLoading, setIsAiVisionLoading] = useState(false);
  const [aiVisionInfo, setAiVisionInfo] = useState<any | null>(null);

  // Scanner Detected Item State
  const [scannedForm, setScannedForm] = useState({
    skuCode: 'AKK-KBX-001',
    batchNo: 'BATCH-2610-A1',
    qty: 500,
    unit: 'Pcs',
    binLocation: 'A-01-L1',
    asnOrDoRef: 'ASN-202610-083',
    selectedRoute: 'Denpasar 1 (P 8848 U)',
    qcPassDry: true,
    qcPassBarcode: true,
    qcPassIntact: true,
    operatorPic: 'Hendra Wijaya (Checker WMS)'
  });

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Camera stream cleanup
  useEffect(() => {
    let stream: MediaStream | null = null;
    if (isCameraActive) {
      navigator.mediaDevices?.getUserMedia({ video: { facingMode: 'environment' } })
        .then(s => {
          stream = s;
          if (videoRef.current) {
            videoRef.current.srcObject = s;
            videoRef.current.play().catch(() => {});
          }
        })
        .catch(() => {
          // Fallback if camera not permitted in browser iframe
          console.warn('Camera stream not accessible, using simulated capture');
        });
    }

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [isCameraActive]);

  // Modal: Add New SKU
  const [isAddSkuModalOpen, setIsAddSkuModalOpen] = useState(false);
  const [newSkuForm, setNewSkuForm] = useState({
    skuCode: '',
    name: '',
    category: 'Karton Box' as WmsSkuItem['category'],
    binLocation: 'A-01-L2',
    zone: 'Zona A (Fast Moving)' as WmsSkuItem['zone'],
    stockOnHand: '',
    reorderPoint: '',
    unit: 'Pcs' as WmsSkuItem['unit'],
    unitValueRp: ''
  });

  // Modal: Add Inbound Receiving
  const [isAddInboundOpen, setIsAddInboundOpen] = useState(false);
  const [newInboundForm, setNewInboundForm] = useState({
    poReference: '',
    supplierOrSource: '',
    vehiclePlate: '',
    skuSummary: '',
    totalQty: '',
    unit: 'Pcs',
    targetBin: 'A-01-L1',
    receiverPic: 'Hendra Wijaya'
  });

  // Computed KPI Metrics
  const kpiStats = useMemo(() => {
    const totalSku = skuItems.length;
    const lowStockItems = skuItems.filter(item => (item.stockOnHand - item.reservedStock) <= item.reorderPoint);
    const totalValuationRp = skuItems.reduce((acc, item) => acc + item.stockOnHand * item.unitValueRp, 0);
    const pendingInbound = inboundRecords.filter(r => r.stage !== 'completed').length;
    const activeOutbound = outboundOrders.filter(o => o.stage !== 'loaded_dispatched').length;
    const avgRackUtilization = Math.round(
      INITIAL_SLOTTING_BINS.reduce((acc, b) => acc + b.utilizationPct, 0) / INITIAL_SLOTTING_BINS.length
    );

    return {
      totalSku,
      lowStockCount: lowStockItems.length,
      totalValuationRp,
      pendingInbound,
      activeOutbound,
      avgRackUtilization
    };
  }, [skuItems, inboundRecords, outboundOrders]);

  // Filtered SKU list
  const filteredSkus = useMemo(() => {
    return skuItems.filter(item => {
      const q = skuSearch.trim().toLowerCase();
      const matchesSearch =
        !q ||
        item.skuCode.toLowerCase().includes(q) ||
        item.name.toLowerCase().includes(q) ||
        item.binLocation.toLowerCase().includes(q) ||
        item.batchNo.toLowerCase().includes(q);

      const matchesCategory = categoryFilter === 'ALL' || item.category === categoryFilter;
      const available = item.stockOnHand - item.reservedStock;
      const isLow = available <= item.reorderPoint;
      const matchesStatus =
        stockStatusFilter === 'ALL' ||
        (stockStatusFilter === 'LOW' && isLow) ||
        (stockStatusFilter === 'SAFE' && !isLow);

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [skuItems, skuSearch, categoryFilter, stockStatusFilter]);

  // Handlers
  const handleAddSku = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSkuForm.name.trim() || !newSkuForm.skuCode.trim()) return;

    const stockNum = Number(newSkuForm.stockOnHand) || 0;
    const ropNum = Number(newSkuForm.reorderPoint) || 100;
    const valNum = Number(newSkuForm.unitValueRp) || 5000;

    const created: WmsSkuItem = {
      id: `sku-${Date.now()}`,
      skuCode: newSkuForm.skuCode.trim().toUpperCase(),
      name: newSkuForm.name.trim(),
      category: newSkuForm.category,
      binLocation: newSkuForm.binLocation.trim().toUpperCase(),
      zone: newSkuForm.zone,
      stockOnHand: stockNum,
      reservedStock: 0,
      reorderPoint: ropNum,
      maxCapacity: Math.max(stockNum * 2, ropNum * 3),
      unit: newSkuForm.unit,
      rotationMethod: 'FIFO',
      batchNo: `BATCH-2610-${Math.floor(10 + Math.random() * 89)}`,
      lastUpdated: 'Baru saja',
      unitValueRp: valNum
    };

    setSkuItems(prev => [created, ...prev]);
    setIsAddSkuModalOpen(false);
    setNewSkuForm({
      skuCode: '',
      name: '',
      category: 'Karton Box',
      binLocation: 'A-01-L2',
      zone: 'Zona A (Fast Moving)',
      stockOnHand: '',
      reorderPoint: '',
      unit: 'Pcs',
      unitValueRp: ''
    });
  };

  const handleAdvanceInboundStage = (id: string) => {
    setInboundRecords(prev =>
      prev.map(rec => {
        if (rec.id !== id) return rec;
        const nextStageMap: Record<InboundAsnRecord['stage'], InboundAsnRecord['stage']> = {
          unloading: 'qc_check',
          qc_check: 'putaway',
          putaway: 'completed',
          completed: 'completed'
        };
        const nextStage = nextStageMap[rec.stage];
        const nextQc =
          nextStage === 'putaway' || nextStage === 'completed' ? 'QC Lolos (100%)' : rec.qcStatus;

        if (nextStage === 'completed' && rec.stage !== 'completed') {
          setLedgerEntries(ldg => [
            {
              id: `ldg-${Date.now()}`,
              timestamp: 'Hari ini, Baru saja',
              txType: 'INBOUND',
              referenceNo: rec.asnNumber,
              skuCode: 'MULTI-SKU',
              skuName: rec.skuSummary,
              qtyChange: `+${rec.totalQty} ${rec.unit}`,
              balanceAfter: rec.totalQty,
              binLocation: rec.targetBin,
              pic: rec.receiverPic
            },
            ...ldg
          ]);
        }

        return {
          ...rec,
          stage: nextStage,
          qcStatus: nextQc
        };
      })
    );
  };

  const handleAddInbound = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInboundForm.skuSummary.trim() || !newInboundForm.supplierOrSource.trim()) return;

    const created: InboundAsnRecord = {
      id: `inb-${Date.now()}`,
      asnNumber: `ASN-202610-${Math.floor(100 + Math.random() * 899)}`,
      poReference: newInboundForm.poReference.trim() || `PO-AKK-2610-${Math.floor(100 + Math.random() * 899)}`,
      supplierOrSource: newInboundForm.supplierOrSource.trim(),
      arrivalTime: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB',
      vehiclePlate: newInboundForm.vehiclePlate.trim().toUpperCase() || 'TRUK-SUPPLIER',
      skuSummary: newInboundForm.skuSummary.trim(),
      totalQty: Number(newInboundForm.totalQty) || 100,
      unit: newInboundForm.unit,
      qcStatus: 'Menunggu QC',
      stage: 'unloading',
      targetBin: newInboundForm.targetBin,
      receiverPic: newInboundForm.receiverPic
    };

    setInboundRecords(prev => [created, ...prev]);
    setIsAddInboundOpen(false);
    setNewInboundForm({
      poReference: '',
      supplierOrSource: '',
      vehiclePlate: '',
      skuSummary: '',
      totalQty: '',
      unit: 'Pcs',
      targetBin: 'A-01-L1',
      receiverPic: 'Hendra Wijaya'
    });
  };

  const handleToggleOutboundCheck = (
    orderId: string,
    key: keyof OutboundPickingOrder['checklistVerified']
  ) => {
    setOutboundOrders(prev =>
      prev.map(o => {
        if (o.id !== orderId) return o;
        const updatedChecks = {
          ...o.checklistVerified,
          [key]: !o.checklistVerified[key]
        };
        const allChecked =
          updatedChecks.qtyMatched &&
          updatedChecks.packagingIntact &&
          updatedChecks.sealAttached &&
          updatedChecks.waybillSigned;

        return {
          ...o,
          checklistVerified: updatedChecks,
          stage: allChecked ? 'loaded_dispatched' : o.stage
        };
      })
    );
  };

  const handleAdvanceOutboundStage = (orderId: string) => {
    setOutboundOrders(prev =>
      prev.map(o => {
        if (o.id !== orderId) return o;
        const nextMap: Record<OutboundPickingOrder['stage'], OutboundPickingOrder['stage']> = {
          picking: 'packing',
          packing: 'staging_dock',
          staging_dock: 'loaded_dispatched',
          loaded_dispatched: 'loaded_dispatched'
        };
        const nextStage = nextMap[o.stage];
        const nextChecklist =
          nextStage === 'loaded_dispatched'
            ? {
                qtyMatched: true,
                packagingIntact: true,
                sealAttached: true,
                waybillSigned: true
              }
            : o.checklistVerified;
        return {
          ...o,
          stage: nextStage,
          checklistVerified: nextChecklist
        };
      })
    );
  };

  const handleApproveOpnameAdjustment = (opnameId: string) => {
    setOpnameSheets(prev =>
      prev.map(sheet => {
        if (sheet.id !== opnameId) return sheet;
        const diff = sheet.physicalStock - sheet.systemStock;
        // Also update SKU stock if matched
        setSkuItems(skus =>
          skus.map(s =>
            s.skuCode === sheet.skuCode
              ? { ...s, stockOnHand: sheet.physicalStock, lastUpdated: 'Disesuaikan via Opname' }
              : s
          )
        );
        setLedgerEntries(ldg => [
          {
            id: `ldg-${Date.now()}`,
            timestamp: 'Hari ini, Baru saja',
            txType: 'OPNAME_ADJ',
            referenceNo: sheet.opnameCode,
            skuCode: sheet.skuCode,
            skuName: sheet.skuName,
            qtyChange: `${diff >= 0 ? '+' : ''}${diff} ${sheet.unit}`,
            balanceAfter: sheet.physicalStock,
            binLocation: sheet.binLocation,
            pic: sheet.auditorPic
          },
          ...ldg
        ]);
        return {
          ...sheet,
          status: 'Disetujui (Adjusted)'
        };
      })
    );
  };

  // Scanner: Capture Snapshot
  const handleCaptureSnapshot = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setCapturedPhoto(dataUrl);
      }
    } else {
      // Fallback simulated snapshot
      setCapturedPhoto('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><rect width="400" height="300" fill="%231e293b"/><text x="50%" y="45%" fill="%2338bdf8" font-family="sans-serif" font-size="20" font-weight="bold" text-anchor="middle">📦 Foto Fisik Barang Terpindai</text><text x="50%" y="58%" fill="%2394a3b8" font-family="monospace" font-size="14" text-anchor="middle">BARCODE: AKK-KBX-001</text><text x="50%" y="70%" fill="%2334d399" font-family="sans-serif" font-size="12" text-anchor="middle">QC STATUS: PASSED (100% OK)</text></svg>');
    }
    setIsCameraActive(false);
  };

  // Scanner: Select Quick Preset Sample
  const handleSelectPreset = (skuCode: string, name: string, unit: string, bin: string, defaultQty: number) => {
    setIsScanningSimulated(true);
    setTimeout(() => {
      setScannedForm(prev => ({
        ...prev,
        skuCode,
        batchNo: `BATCH-2610-${Math.floor(10 + Math.random() * 89)}`,
        qty: defaultQty,
        unit,
        binLocation: bin
      }));
      setCapturedPhoto('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><rect width="400" height="300" fill="%230f172a"/><rect x="40" y="40" width="320" height="220" rx="12" fill="%231e293b" stroke="%2338bdf8" stroke-width="2"/><text x="50%" y="40%" fill="%23ffffff" font-family="sans-serif" font-size="16" font-weight="bold" text-anchor="middle">' + skuCode + '</text><text x="50%" y="52%" fill="%2394a3b8" font-family="sans-serif" font-size="11" text-anchor="middle">' + name.substring(0, 32) + '...</text><text x="50%" y="65%" fill="%2334d399" font-family="monospace" font-size="14" font-weight="bold" text-anchor="middle">TERVERIFIKASI: ' + defaultQty + ' ' + unit + '</text><text x="50%" y="78%" fill="%23a855f7" font-family="monospace" font-size="12" text-anchor="middle">LOKASI RAK: ' + bin + '</text></svg>');
      setIsScanningSimulated(false);
    }, 400);
  };

  // Scanner: Execute Inbound Stock Sync
  const handleSyncInboundScan = () => {
    const matchedSku = skuItems.find(s => s.skuCode === scannedForm.skuCode);
    const skuName = matchedSku ? matchedSku.name : 'Barang Kemasan Masuk';
    const qtyNum = Number(scannedForm.qty) || 100;

    // 1. Update SKU stock on hand
    setSkuItems(prev =>
      prev.map(item =>
        item.skuCode === scannedForm.skuCode
          ? {
              ...item,
              stockOnHand: item.stockOnHand + qtyNum,
              batchNo: scannedForm.batchNo,
              lastUpdated: 'Tersinkron Pindai Foto (Inbound)'
            }
          : item
      )
    );

    // 2. Add or update ASN record
    const newAsn: InboundAsnRecord = {
      id: `inb-${Date.now()}`,
      asnNumber: `ASN-SCAN-${Math.floor(100 + Math.random() * 899)}`,
      poReference: scannedForm.asnOrDoRef || `PO-AKK-2610-${Math.floor(100 + Math.random() * 899)}`,
      supplierOrSource: 'Penerimaan Cepat via Pindai Foto (DC Banyuwangi)',
      arrivalTime: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB',
      vehiclePlate: 'INBOUND-DC',
      skuSummary: `${scannedForm.skuCode} - ${skuName}`,
      totalQty: qtyNum,
      unit: scannedForm.unit,
      qcStatus: 'QC Lolos (100%)',
      stage: 'completed',
      targetBin: scannedForm.binLocation,
      receiverPic: scannedForm.operatorPic,
      photoVerified: true
    };
    setInboundRecords(prev => [newAsn, ...prev]);

    // 3. Add to Stock Ledger
    const newLedger: StockLedgerEntry = {
      id: `ldg-${Date.now()}`,
      timestamp: 'Hari ini, Baru saja',
      txType: 'INBOUND',
      referenceNo: newAsn.asnNumber,
      skuCode: scannedForm.skuCode,
      skuName: skuName,
      qtyChange: `+${qtyNum} ${scannedForm.unit}`,
      balanceAfter: (matchedSku ? matchedSku.stockOnHand : 0) + qtyNum,
      binLocation: scannedForm.binLocation,
      pic: scannedForm.operatorPic
    };
    setLedgerEntries(prev => [newLedger, ...prev]);

    // 4. Record to Scan Audit Log
    const newScanLog: ScanAuditRecord = {
      id: `scn-${Date.now()}`,
      timestamp: new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) + ', ' + new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB',
      mode: 'INBOUND',
      skuCode: scannedForm.skuCode,
      skuName: skuName,
      batchNo: scannedForm.batchNo,
      binLocation: scannedForm.binLocation,
      detectedQty: qtyNum,
      unit: scannedForm.unit,
      photoPreview: capturedPhoto || undefined,
      verificationStatus: 'Lolos QC & Tersinkron',
      targetReference: newAsn.asnNumber,
      operatorPic: scannedForm.operatorPic
    };
    setScanAuditLogs(prev => [newScanLog, ...prev]);

    setScanSuccessMessage(`Berhasil menyinkronkan ${qtyNum} ${scannedForm.unit} (${scannedForm.skuCode}) ke stok fisik & rak ${scannedForm.binLocation}!`);
    setTimeout(() => setScanSuccessMessage(null), 6000);
  };

  // Scanner: Execute Outbound Picking Verification
  const handleSyncOutboundScan = () => {
    const matchedSku = skuItems.find(s => s.skuCode === scannedForm.skuCode);
    const skuName = matchedSku ? matchedSku.name : 'Barang Kemasan Keluar';
    const qtyNum = Number(scannedForm.qty) || 50;

    // 1. Reduce reserved stock and stock on hand
    setSkuItems(prev =>
      prev.map(item =>
        item.skuCode === scannedForm.skuCode
          ? {
              ...item,
              stockOnHand: Math.max(0, item.stockOnHand - qtyNum),
              reservedStock: Math.max(0, item.reservedStock - qtyNum),
              lastUpdated: 'Tersinkron Verifikasi Outbound (DO)'
            }
          : item
      )
    );

    // 2. Mark Outbound order verified
    setOutboundOrders(prev =>
      prev.map(ord => {
        if (ord.routeArea.includes('Denpasar') || ord.waveNumber === 'WAVE-2610-02') {
          return {
            ...ord,
            photoVerified: true,
            checklistVerified: {
              ...ord.checklistVerified,
              qtyMatched: true,
              packagingIntact: true
            }
          };
        }
        return ord;
      })
    );

    // 3. Add to Stock Ledger
    const newLedger: StockLedgerEntry = {
      id: `ldg-${Date.now()}`,
      timestamp: 'Hari ini, Baru saja',
      txType: 'OUTBOUND',
      referenceNo: scannedForm.asnOrDoRef || 'SJ-AKK-2610-402',
      skuCode: scannedForm.skuCode,
      skuName: skuName,
      qtyChange: `-${qtyNum} ${scannedForm.unit}`,
      balanceAfter: Math.max(0, (matchedSku ? matchedSku.stockOnHand : 0) - qtyNum),
      binLocation: scannedForm.binLocation,
      pic: scannedForm.operatorPic
    };
    setLedgerEntries(prev => [newLedger, ...prev]);

    // 4. Record to Scan Audit Log
    const newScanLog: ScanAuditRecord = {
      id: `scn-${Date.now()}`,
      timestamp: new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) + ', ' + new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB',
      mode: 'OUTBOUND',
      skuCode: scannedForm.skuCode,
      skuName: skuName,
      batchNo: scannedForm.batchNo,
      binLocation: scannedForm.binLocation,
      detectedQty: qtyNum,
      unit: scannedForm.unit,
      photoPreview: capturedPhoto || undefined,
      verificationStatus: 'Cocok dengan DO',
      targetReference: scannedForm.asnOrDoRef || `SJ-OUT-${scannedForm.selectedRoute}`,
      operatorPic: scannedForm.operatorPic
    };
    setScanAuditLogs(prev => [newScanLog, ...prev]);

    setScanSuccessMessage(`Verifikasi foto sukses! SKU ${scannedForm.skuCode} (${qtyNum} ${scannedForm.unit}) cocok 100% dengan Surat Jalan ${scannedForm.selectedRoute}. Stok teralokasi berhasil disinkronkan.`);
    setTimeout(() => setScanSuccessMessage(null), 6000);
  };

  // Consult Gemini AI Slotting Advisor for 2-Story Warehouse
  const handleConsultAiSlotting = async () => {
    setIsAiSlottingLoading(true);
    try {
      const res = await fetch('/api/warehouse/ai-slotting-advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentFloor: selectedFloor })
      });
      const data = await res.json();
      if (data?.data?.recommendations) {
        setAiSlottingTips(data.data.recommendations);
      }
    } catch (err) {
      console.warn("AI Slotting Advisor request failed:", err);
    } finally {
      setIsAiSlottingLoading(false);
    }
  };

  // Consult Gemini AI Vision for Photo Scanner
  const handleAiVisionScanPhoto = async () => {
    if (!capturedPhoto) return;
    setIsAiVisionLoading(true);
    try {
      const res = await fetch('/api/warehouse/ai-vision-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          photoDataUrl: capturedPhoto,
          mode: scannerMode
        })
      });
      const data = await res.json();
      if (data?.analysis) {
        setAiVisionInfo(data.analysis);
        setScannedForm(prev => ({
          ...prev,
          skuCode: data.analysis.skuCode || prev.skuCode,
          qty: data.analysis.detectedQty || prev.qty,
          unit: data.analysis.unit || prev.unit,
          binLocation: data.analysis.suggestedBin || prev.binLocation,
        }));
      }
    } catch (err) {
      console.warn("AI Vision scan request failed:", err);
    } finally {
      setIsAiVisionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner WMS */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-500/15 border border-blue-200 dark:border-blue-500/30 text-blue-700 dark:text-blue-300 text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5" />
              <span>Dashboard</span>
            </span>
          </div>
          <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
            Warehouse Management System (WMS) &mdash; PT Anugrah Kemasan Kreatif
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Pengendalian terpadu stok kemasan karton box, pemindaian foto barang masuk/keluar, penerimaan (Inbound QC), penyiapan muatan armada (Outbound Picking), tata letak rak (Slotting), serta Stok Opname.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            onClick={() => handleTabChange('scanner')}
            className="px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Pindai Foto Barang (Scanner)</span>
          </button>
          <button
            onClick={() => {
              handleTabChange('inbound');
              setIsAddInboundOpen(true);
            }}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
          >
            <ArrowDownToLine className="w-3.5 h-3.5" />
            <span>Terima Barang (Inbound)</span>
          </button>
          <button
            onClick={() => {
              handleTabChange('inventory');
              setIsAddSkuModalOpen(true);
            }}
            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah Master SKU</span>
          </button>
        </div>
      </div>



      {/* Global Toast / Success Alert if any action completed */}
      {scanSuccessMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-300 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center justify-between gap-3 shadow-sm animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{scanSuccessMessage}</span>
          </div>
          <button
            onClick={() => setScanSuccessMessage(null)}
            className="p-1 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-800/50 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 1: OVERVIEW & WMS CONTROL TOWER                                   */}
      {/* ===================================================================== */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* 6 Executive WMS KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400">Total Master SKU</span>
                <Package className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">1,204</div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                {skuItems.length} SKU Utama Prioritas Aktif
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400">Inbound Hari Ini</span>
                <ArrowDownToLine className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">
                {inboundRecords.length} ASN
              </div>
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1">
                {kpiStats.pendingInbound} Proses QC / Putaway
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400">Outbound &amp; Muat</span>
                <ArrowUpFromLine className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">
                {outboundOrders.length} Wave
              </div>
              <p className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold mt-1">
                {kpiStats.activeOutbound} Antrian Picking / Dock
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400">Akurasi Stok (IRA)</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">99.4%</div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Audit Cycle Count Mingguan
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400">Utilisasi Rak DC</span>
                <Map className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">
                {kpiStats.avgRackUtilization}%
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Zona A, B, C &amp; D (10 Bin Utama)
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-500/30 p-4 rounded-2xl shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase text-rose-600 dark:text-rose-400">Low Stock / ROP</span>
                <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
              </div>
              <div className="text-2xl font-black text-rose-600 dark:text-rose-400 font-mono">
                {kpiStats.lowStockCount} SKU
              </div>
              <p className="text-[11px] text-rose-600 dark:text-rose-300 mt-1">
                Perlu Repeat Order / Produksi
              </p>
            </div>
          </div>

          {/* Quick Scanner Banner Card */}
          <div className="bg-gradient-to-r from-cyan-900/40 via-blue-900/30 to-indigo-900/40 border border-cyan-500/30 rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shrink-0">
                <Camera className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-black text-slate-900 dark:text-white">
                    Fitur Baru: Pemindaian Foto Barang Masuk &amp; Verifikasi Pengambilan Keluar
                  </h4>
                  <span className="px-2 py-0.5 rounded bg-cyan-500 text-slate-950 font-black text-[10px] uppercase">
                    Live Sync
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                  Gunakan kamera perangkat atau unggah foto untuk mendeteksi barcode kemasan karton box, mengecek kepatuhan QC, dan memverifikasi kesesuaian fisik dengan Surat Jalan DO armada secara instan.
                </p>
              </div>
            </div>
            <button
              onClick={() => handleTabChange('scanner')}
              className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shrink-0 shadow-xs"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Buka Pemindai Foto</span>
            </button>
          </div>

          {/* Live Loading Dock & Low Stock Alert Side-by-Side */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Live Loading Dock Status (2 Columns) */}
            <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <Truck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span>Status Real-Time Loading Dock &amp; Antrian Muat Armada</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Sinkronisasi langsung antara Checker Gudang dan Jadwal Keberangkatan Armada Logistik
                  </p>
                </div>
                <button
                  onClick={() => handleTabChange('outbound')}
                  className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                >
                  Buka Ceklis Muat &rarr;
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {outboundOrders.map((ord) => {
                  const stageBadge =
                    ord.stage === 'loaded_dispatched'
                      ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30'
                      : ord.stage === 'staging_dock'
                      ? 'bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-500/30'
                      : ord.stage === 'packing'
                      ? 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/30'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700';

                  const stageLabel =
                    ord.stage === 'loaded_dispatched'
                      ? 'Selesai Muat / Berangkat'
                      : ord.stage === 'staging_dock'
                      ? 'Siap di Loading Dock'
                      : ord.stage === 'packing'
                      ? 'Proses Packing & Label'
                      : 'Sedang Picking Rak';

                  return (
                    <div
                      key={ord.id}
                      className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/50 space-y-2.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-black text-slate-900 dark:text-white">
                          {ord.dockBay} &bull; <span className="text-blue-600 dark:text-blue-400">{ord.fleetPlate} ({ord.fleetCode})</span>
                        </span>
                        <span className={`px-2 py-0.5 rounded border text-[10px] font-bold ${stageBadge}`}>
                          {stageLabel}
                        </span>
                      </div>

                      <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        Rute: <span className="font-bold text-indigo-600 dark:text-indigo-400">{ord.routeArea}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {ord.customerOrStore}
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-200/80 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400">
                        <span>Muatan: <strong>{ord.totalColli} Koli</strong> ({ord.totalSku} SKU)</span>
                        <span>Driver: <strong>{ord.driverName}</strong></span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Peringatan Stok Menipis (Low Stock & Reorder Point Alert) */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                    <span>Peringatan Stok Minimum (ROP)</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    SKU yang berada di bawah batas aman (Safety Stock)
                  </p>
                </div>
                <button
                  onClick={() => {
                    setStockStatusFilter('LOW');
                    handleTabChange('inventory');
                  }}
                  className="text-xs font-bold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
                >
                  Lihat Semua &rarr;
                </button>
              </div>

              <div className="space-y-2.5">
                {skuItems
                  .filter(s => (s.stockOnHand - s.reservedStock) <= s.reorderPoint)
                  .map(item => {
                    const available = item.stockOnHand - item.reservedStock;
                    return (
                      <div
                        key={item.id}
                        className="p-3 rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50/50 dark:bg-rose-500/10 space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[11px] font-bold text-rose-700 dark:text-rose-300">
                            {item.skuCode} &bull; Bin {item.binLocation}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-rose-600 text-white text-[10px] font-bold">
                            Stok Kritis
                          </span>
                        </div>
                        <div className="text-xs font-bold text-slate-900 dark:text-white">
                          {item.name}
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-300">
                          <span>
                            Tersedia: <strong className="text-rose-600 dark:text-rose-400">{available.toLocaleString('id-ID')} {item.unit}</strong>
                          </span>
                          <span>
                            Min. ROP: <strong>{item.reorderPoint.toLocaleString('id-ID')} {item.unit}</strong>
                          </span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>

          {/* Kalender Kerja & Agenda Tim Gudang */}
          <TeamCalendar role="warehouse_admin" />
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: MASTER INVENTARIS, STOK BARANG & LOKASI BIN                    */}
      {/* ===================================================================== */}
      {activeTab === 'inventory' && (
        <div className="space-y-4">
          {/* Filter & Search Bar */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={skuSearch}
                onChange={(e) => setSkuSearch(e.target.value)}
                placeholder="Cari Kode SKU, Nama Karton/Plastik, Nomor Lokasi Rak (Bin), atau Nomor Batch..."
                className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer"
              >
                <option value="ALL">Semua Kategori Barang</option>
                <option value="Karton Box">Karton Box</option>
                <option value="Plastik & Kemasan">Plastik &amp; Kemasan</option>
                <option value="Material Packing">Material Packing</option>
                <option value="Produk Distribusi">Produk Distribusi</option>
              </select>

              <div className="flex items-center rounded-xl bg-slate-100 dark:bg-slate-950 p-1 border border-slate-200 dark:border-slate-800 text-xs">
                <button
                  onClick={() => setStockStatusFilter('ALL')}
                  className={`px-2.5 py-1 rounded-lg font-bold cursor-pointer transition ${
                    stockStatusFilter === 'ALL'
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Semua ({skuItems.length})
                </button>
                <button
                  onClick={() => setStockStatusFilter('SAFE')}
                  className={`px-2.5 py-1 rounded-lg font-bold cursor-pointer transition ${
                    stockStatusFilter === 'SAFE'
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Aman
                </button>
                <button
                  onClick={() => setStockStatusFilter('LOW')}
                  className={`px-2.5 py-1 rounded-lg font-bold cursor-pointer transition ${
                    stockStatusFilter === 'LOW'
                      ? 'bg-rose-600 text-white'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Perlu Restock ({kpiStats.lowStockCount})
                </button>
              </div>

              <button
                onClick={() => setIsAddSkuModalOpen(true)}
                className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>SKU Baru</span>
              </button>
            </div>
          </div>

          {/* Master SKU Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  Daftar Master SKU, Alokasi Stok &amp; Lokasi Rak (Bin Location)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Stok Tersedia (Available to Promise) = Stok Fisik On-Hand dikurangi Stok Terpesan (Reserved untuk Surat Jalan).
                </p>
              </div>
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                Estimasi Nilai Inventaris: <span className="text-emerald-600 dark:text-emerald-400 font-mono">Rp {(kpiStats.totalValuationRp / 1000000).toFixed(1)} Juta</span>
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 uppercase font-bold text-[10px] border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Kode SKU &amp; Batch</th>
                    <th className="py-3 px-4">Nama Barang / Spesifikasi</th>
                    <th className="py-3 px-4">Lokasi Bin / Zona</th>
                    <th className="py-3 px-4 text-right">Stok Fisik</th>
                    <th className="py-3 px-4 text-right">Teralokasi (DO)</th>
                    <th className="py-3 px-4 text-right">Stok Tersedia</th>
                    <th className="py-3 px-4 text-right">Min. ROP</th>
                    <th className="py-3 px-4 text-center">Status Stok</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
                  {filteredSkus.map((item) => {
                    const available = item.stockOnHand - item.reservedStock;
                    const isLow = available <= item.reorderPoint;

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                        <td className="py-3 px-4">
                          <div className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{item.skuCode}</div>
                          <div className="text-[10px] text-slate-500 font-mono">{item.batchNo} &bull; {item.rotationMethod}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900 dark:text-white">{item.name}</div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">{item.category} &bull; Update: {item.lastUpdated}</div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-mono font-bold text-slate-900 dark:text-white text-[11px]">
                            {item.binLocation}
                          </span>
                          <div className="text-[10px] text-slate-500 mt-0.5">{item.zone}</div>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold">
                          {item.stockOnHand.toLocaleString('id-ID')} {item.unit}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-amber-600 dark:text-amber-400 font-semibold">
                          {item.reservedStock.toLocaleString('id-ID')} {item.unit}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-black text-slate-900 dark:text-white">
                          {available.toLocaleString('id-ID')} {item.unit}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-slate-500">
                          {item.reorderPoint.toLocaleString('id-ID')} {item.unit}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {isLow ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-50 dark:bg-rose-500/15 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 font-bold text-[10px]">
                              <AlertTriangle className="w-3 h-3" /> Perlu Reorder
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-bold text-[10px]">
                              <CheckCircle2 className="w-3 h-3" /> Stok Aman
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
      )}

      {/* ===================================================================== */}
      {/* TAB 3: INBOUND LOGISTICS (RECEIVING, QC & PUTAWAY)                    */}
      {/* ===================================================================== */}
      {activeTab === 'inbound' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                Inbound Logistics &mdash; Penerimaan Barang (ASN), Pemeriksaan QC &amp; Putaway Rak
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Mencatat barang masuk dari lini produksi pabrik karton maupun truk supplier eksternal sebelum ditempatkan ke rak penyimpanan.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => {
                  setScannerMode('INBOUND');
                  handleTabChange('scanner');
                }}
                className="px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Pindai Foto Inbound</span>
              </button>
              <button
                onClick={() => setIsAddInboundOpen(true)}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shrink-0 shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Catat Penerimaan Inbound Baru</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {inboundRecords.map((rec) => {
              const steps = [
                { key: 'unloading', label: '1. Bongkar Muat (Unloading)' },
                { key: 'qc_check', label: '2. Inspeksi Kualitas (QC)' },
                { key: 'putaway', label: '3. Penempatan Rak (Putaway)' },
                { key: 'completed', label: '4. Masuk Buku Stok' }
              ];
              const currentIdx = steps.findIndex(s => s.key === rec.stage);

              return (
                <div
                  key={rec.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-black text-indigo-600 dark:text-indigo-400">
                          {rec.asnNumber}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono text-[11px] font-semibold">
                          Ref: {rec.poReference}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 text-[11px] font-bold">
                          Armada: {rec.vehiclePlate} &bull; Jam Tiba: {rec.arrivalTime}
                        </span>
                        {rec.photoVerified && (
                          <span className="px-2 py-0.5 rounded bg-cyan-50 dark:bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 text-[10px] font-bold flex items-center gap-1">
                            <Camera className="w-3 h-3" /> Foto Terverifikasi
                          </span>
                        )}
                      </div>
                      <h4 className="text-sm font-black text-slate-900 dark:text-white">
                        {rec.skuSummary} &mdash; <span className="text-emerald-600 dark:text-emerald-400">{rec.totalQty.toLocaleString('id-ID')} {rec.unit}</span>
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Sumber / Supplier: <strong>{rec.supplierOrSource}</strong> &bull; Target Rak Putaway: <strong className="font-mono text-slate-800 dark:text-slate-200">{rec.targetBin}</strong> &bull; Petugas: {rec.receiverPic}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => {
                          setScannerMode('INBOUND');
                          setScannedForm(prev => ({
                            ...prev,
                            asnOrDoRef: rec.asnNumber,
                            binLocation: rec.targetBin,
                            qty: rec.totalQty,
                            unit: rec.unit
                          }));
                          handleTabChange('scanner');
                        }}
                        className="px-3 py-1.5 rounded-xl border border-cyan-300 dark:border-cyan-500/40 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-50 dark:hover:bg-cyan-500/10 text-xs font-bold cursor-pointer transition flex items-center gap-1.5"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        <span>Pindai Foto</span>
                      </button>

                      <span
                        className={`px-3 py-1 rounded-lg border text-xs font-bold ${
                          rec.qcStatus.includes('Lolos')
                            ? 'bg-emerald-50 dark:bg-emerald-500/15 border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                            : 'bg-amber-50 dark:bg-amber-500/15 border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-amber-300'
                        }`}
                      >
                        {rec.qcStatus}
                      </span>

                      {rec.stage !== 'completed' && (
                        <button
                          onClick={() => handleAdvanceInboundStage(rec.id)}
                          className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold cursor-pointer transition flex items-center gap-1.5 shadow-xs"
                        >
                          <span>Lanjutkan Tahap</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Stepper Progress */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    {steps.map((st, idx) => {
                      const isDone = idx <= currentIdx;
                      return (
                        <div
                          key={st.key}
                          className={`p-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 ${
                            isDone
                              ? 'bg-emerald-50/70 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                              : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-400'
                          }`}
                        >
                          <CheckCircle2 className={`w-4 h-4 shrink-0 ${isDone ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`} />
                          <span className="truncate">{st.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 4: OUTBOUND LOGISTICS (PICKING, PACKING & LOADING DOCK CHECKLIST) */}
      {/* ===================================================================== */}
      {activeTab === 'outbound' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                Outbound Logistics &mdash; Wave Picking, Packing &amp; Verifikasi Ceklis Muat Loading Dock
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Setiap pesanan pengiriman rute (Denpasar 1, Denpasar 2, Jember, Banyuwangi) wajib diverifikasi Checker Gudang sebelum armada diizinkan keluar dari Loading Dock.
              </p>
            </div>
            <button
              onClick={() => {
                setScannerMode('OUTBOUND');
                handleTabChange('scanner');
              }}
              className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shrink-0 shadow-xs"
            >
              <Camera className="w-4 h-4" />
              <span>Pindai Foto Verifikasi Muat</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {outboundOrders.map((ord) => {
              const checks = ord.checklistVerified;
              const completedCount = Object.values(checks).filter(Boolean).length;

              return (
                <div
                  key={ord.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4 flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-500/15 border border-indigo-200 dark:border-indigo-500/30 font-mono text-xs font-black text-indigo-700 dark:text-indigo-300">
                          {ord.waveNumber}
                        </span>
                        <span className="font-mono text-xs font-bold text-slate-500">
                          {ord.doNumber}
                        </span>
                        {ord.photoVerified && (
                          <span className="px-2 py-0.5 rounded bg-cyan-50 dark:bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 text-[10px] font-bold flex items-center gap-1">
                            <Camera className="w-3 h-3" /> Foto Terverifikasi
                          </span>
                        )}
                      </div>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                          ord.stage === 'loaded_dispatched'
                            ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30'
                            : 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/30'
                        }`}
                      >
                        {ord.stage === 'loaded_dispatched'
                          ? 'Termuat & Siap Berangkat'
                          : ord.stage === 'staging_dock'
                          ? 'Menunggu Muat di Dock'
                          : ord.stage === 'packing'
                          ? 'Proses Packing'
                          : 'Proses Picking Rak'}
                      </span>
                    </div>

                    <div>
                      <h4 className="text-base font-black text-slate-900 dark:text-white">
                        Rute: {ord.routeArea} &bull; <span className="text-blue-600 dark:text-blue-400">{ord.fleetPlate} ({ord.fleetCode})</span>
                      </h4>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                        Tujuan: <strong>{ord.customerOrStore}</strong>
                      </p>
                    </div>

                    <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs">
                      <div>
                        <div className="text-[10px] text-slate-500 uppercase font-bold">Lokasi Muat</div>
                        <div className="font-black text-slate-900 dark:text-white">{ord.dockBay}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500 uppercase font-bold">Total Beban</div>
                        <div className="font-black text-slate-900 dark:text-white">{ord.totalColli} Koli ({ord.totalSku} SKU)</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500 uppercase font-bold">Target Berangkat</div>
                        <div className="font-black text-amber-600 dark:text-amber-400">{ord.departureTarget}</div>
                      </div>
                    </div>

                    {/* 4-Point Loading Dock Verification Checklist */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                        <span>Ceklis Verifikasi Muat Gudang (Checker: {ord.checkerPic})</span>
                        <span className="font-mono">{completedCount}/4 Terverifikasi</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {[
                          { key: 'qtyMatched' as const, label: 'Jumlah Koli & SKU Sesuai DO' },
                          { key: 'packagingIntact' as const, label: 'Kondisi Karton Tidak Penyok/Basah' },
                          { key: 'sealAttached' as const, label: 'Susunan Tier Aman & Segel Terpasang' },
                          { key: 'waybillSigned' as const, label: 'Surat Jalan Ditandatangani Driver' }
                        ].map((chk) => {
                          const isChecked = ord.checklistVerified[chk.key];
                          return (
                            <button
                              key={chk.key}
                              type="button"
                              onClick={() => handleToggleOutboundCheck(ord.id, chk.key)}
                              className={`p-2.5 rounded-xl border text-left text-xs font-semibold flex items-center gap-2 transition cursor-pointer ${
                                isChecked
                                  ? 'bg-emerald-50 dark:bg-emerald-500/15 border-emerald-300 dark:border-emerald-500/40 text-emerald-800 dark:text-emerald-200'
                                  : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-blue-400'
                              }`}
                            >
                              <div
                                className={`w-4 h-4 rounded flex items-center justify-center shrink-0 ${
                                  isChecked
                                    ? 'bg-emerald-600 text-white'
                                    : 'border border-slate-400 dark:border-slate-600'
                                }`}
                              >
                                {isChecked && <Check className="w-3 h-3" />}
                              </div>
                              <span className="leading-tight">{chk.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Picker: <strong>{ord.pickerPic}</strong> &bull; Supir: <strong>{ord.driverName}</strong>
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setScannerMode('OUTBOUND');
                          setScannedForm(prev => ({
                            ...prev,
                            asnOrDoRef: ord.doNumber,
                            selectedRoute: `${ord.routeArea} (${ord.fleetPlate})`,
                            qty: ord.totalColli,
                            unit: 'Koli'
                          }));
                          handleTabChange('scanner');
                        }}
                        className="px-3 py-1.5 rounded-xl border border-cyan-300 dark:border-cyan-500/40 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-50 dark:hover:bg-cyan-500/10 text-xs font-bold cursor-pointer transition flex items-center gap-1.5"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        <span>Pindai Muatan</span>
                      </button>

                      {ord.stage !== 'loaded_dispatched' ? (
                        <button
                          onClick={() => handleAdvanceOutboundStage(ord.id)}
                          className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold cursor-pointer transition"
                        >
                          Konfirmasi Tahap Berikutnya &rarr;
                        </button>
                      ) : (
                        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                          <ShieldCheck className="w-4 h-4" /> Diserahkan ke Driver
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 5: PEMINDAIAN FOTO BARANG & SINKRONISASI INVENTARIS (NEW SCANNER)  */}
      {/* ===================================================================== */}
      {activeTab === 'scanner' && (
        <div className="space-y-6 animate-fade-in">
          {/* Scanner Header & Mode Toggle */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-md bg-cyan-50 dark:bg-cyan-500/15 border border-cyan-200 dark:border-cyan-500/30 text-cyan-700 dark:text-cyan-300 text-[10px] font-extrabold uppercase tracking-wider">
                  Smart Visual &amp; Barcode Scanner
                </span>
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5" /> Sinkronisasi Otomatis ke Kartu Stok &amp; DO
                </span>
              </div>
              <h3 className="text-base font-black text-slate-900 dark:text-white mt-1">
                Pemindaian Foto Barang &amp; Verifikasi Fisik Kemasan Karton
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Pindai foto fisik barang, label koli barcode, atau dokumen pengiriman untuk mempercepat input penerimaan barang masuk dan verifikasi pengambilan barang keluar agar sinkron dengan sistem inventaris.
              </p>
            </div>

            {/* Mode Selector */}
            <div className="flex items-center rounded-xl bg-slate-100 dark:bg-slate-950 p-1 border border-slate-200 dark:border-slate-800 text-xs font-bold shrink-0">
              <button
                onClick={() => setScannerMode('INBOUND')}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition cursor-pointer ${
                  scannerMode === 'INBOUND'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <ArrowDownToLine className="w-3.5 h-3.5" />
                <span>Mode Masuk (Inbound Receiving)</span>
              </button>
              <button
                onClick={() => setScannerMode('OUTBOUND')}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition cursor-pointer ${
                  scannerMode === 'OUTBOUND'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <ArrowUpFromLine className="w-3.5 h-3.5" />
                <span>Mode Keluar (Outbound Picking)</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Rail: Live Camera / Capture Area & Quick Presets (7 cols) */}
            <div className="lg:col-span-7 space-y-4">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Camera className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                    <h4 className="text-sm font-black text-slate-900 dark:text-white">
                      Kamera Pemindai &amp; Viewfinder Barang
                    </h4>
                  </div>
                  <div className="flex items-center gap-2">
                    {capturedPhoto && (
                      <button
                        onClick={handleAiVisionScanPhoto}
                        disabled={isAiVisionLoading}
                        className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50 transition"
                      >
                        {isAiVisionLoading ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                        )}
                        <span>{isAiVisionLoading ? 'AI Menganalisis...' : 'Analisis AI Vision'}</span>
                      </button>
                    )}
                    {!isCameraActive ? (
                      <button
                        onClick={() => setIsCameraActive(true)}
                        className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        <span>Buka Kamera</span>
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleCaptureSnapshot}
                          className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                        >
                          <Zap className="w-3.5 h-3.5" />
                          <span>Jepret Foto</span>
                        </button>
                        <button
                          onClick={() => setIsCameraActive(false)}
                          className="px-2.5 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs cursor-pointer"
                        >
                          Tutup
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Video & Scanner Viewport */}
                <div className="relative rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 aspect-video flex items-center justify-center text-center">
                  {isCameraActive ? (
                    <>
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover"
                      />
                      {/* Scanning Reticle & Overlay */}
                      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                        <div className="w-3/4 h-3/4 border-2 border-cyan-400/80 rounded-xl relative shadow-[0_0_20px_rgba(6,182,212,0.4)]">
                          <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-cyan-400 -mt-1 -ml-1"></div>
                          <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-cyan-400 -mt-1 -mr-1"></div>
                          <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-cyan-400 -mb-1 -ml-1"></div>
                          <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-cyan-400 -mb-1 -mr-1"></div>
                          {/* Animated Scan Line */}
                          <div className="w-full h-0.5 bg-cyan-400/90 shadow-[0_0_12px_#22d3ee] animate-pulse my-auto"></div>
                        </div>
                        <span className="absolute bottom-4 px-3 py-1 rounded-full bg-slate-950/80 text-cyan-300 text-[10px] font-bold border border-cyan-500/30">
                          Arahkan kamera ke kemasan karton box atau barcode label
                        </span>
                      </div>
                    </>
                  ) : capturedPhoto ? (
                    <div className="relative w-full h-full flex items-center justify-center bg-slate-900 p-2">
                      <img
                        src={capturedPhoto}
                        alt="Captured Item"
                        className="max-h-full max-w-full rounded-lg object-contain shadow-md"
                      />
                      <div className="absolute top-3 right-3 flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded-full bg-emerald-500 text-slate-950 font-black text-[10px] shadow-sm flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Foto Terambil
                        </span>
                        <button
                          onClick={() => setCapturedPhoto(null)}
                          className="p-1 rounded-full bg-slate-950/80 text-white hover:bg-slate-800 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-6 space-y-3">
                      <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-cyan-400 mx-auto">
                        <Camera className="w-7 h-7" />
                      </div>
                      <div className="space-y-1">
                        <h5 className="text-sm font-bold text-white">Kamera Belum Aktif</h5>
                        <p className="text-xs text-slate-400 max-w-sm mx-auto">
                          Klik tombol <strong>Buka Kamera</strong> di atas untuk memindai langsung menggunakan kamera hp/webcam, atau pilih salah satu sampel kemasan di bawah untuk simulasi instan.
                        </p>
                      </div>
                    </div>
                  )}
                  <canvas ref={canvasRef} className="hidden" />
                </div>

                {/* Quick Scan Presets */}
                <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-700 dark:text-slate-300">
                      Sampel Cepat Pemindaian Foto (Preset Simulasi Kemasan)
                    </span>
                    <span className="text-[11px] text-slate-400">1-Klik untuk uji coba</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { code: 'AKK-KBX-001', name: 'Karton B-Flute 60x40', unit: 'Pcs', bin: 'A-01-L1', qty: 500, label: 'Karton Box 60x40' },
                      { code: 'AKK-KBX-003', name: 'Box Food Grade 22x22', unit: 'Pcs', bin: 'A-02-L2', qty: 1000, label: 'Box Food Grade' },
                      { code: 'AKK-PLS-014', name: 'Stretch Film 50cm', unit: 'Roll', bin: 'D-01-L1', qty: 25, label: 'Stretch Film Wrap' },
                      { code: 'AKK-MPK-007', name: 'Lakban Coklat OPP', unit: 'Karton', bin: 'D-02-L2', qty: 10, label: 'Lakban Heavy Duty' }
                    ].map((pre) => (
                      <button
                        key={pre.code}
                        onClick={() => handleSelectPreset(pre.code, pre.name, pre.unit, pre.bin, pre.qty)}
                        className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 hover:border-cyan-500 text-left transition cursor-pointer group"
                      >
                        <div className="font-mono text-[10px] font-bold text-cyan-600 dark:text-cyan-400 group-hover:underline">
                          {pre.code}
                        </div>
                        <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {pre.label}
                        </div>
                        <div className="text-[10px] text-slate-500 mt-1">
                          Bin: {pre.bin} &bull; {pre.qty} {pre.unit}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Right Rail: Detection Result, QC Checks & Sync Execution Form (5 cols) */}
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-cyan-600 dark:text-cyan-400">
                      Parameter Sinkronisasi
                    </span>
                    <h4 className="text-sm font-black text-slate-900 dark:text-white">
                      Hasil Pindai &amp; Verifikasi Inventaris
                    </h4>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${
                      scannerMode === 'INBOUND'
                        ? 'bg-emerald-50 dark:bg-emerald-500/15 border-emerald-300 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                        : 'bg-blue-50 dark:bg-blue-500/15 border-blue-300 dark:border-blue-500/30 text-blue-700 dark:text-blue-300'
                    }`}
                  >
                    {scannerMode === 'INBOUND' ? 'Inbound (Masuk)' : 'Outbound (Keluar)'}
                  </span>
                </div>

                {aiVisionInfo && (
                  <div className="p-3.5 rounded-xl bg-gradient-to-r from-indigo-50 to-cyan-50 dark:from-indigo-950/40 dark:to-cyan-950/40 border border-indigo-200 dark:border-indigo-800 text-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-amber-500" />
                        Terdeteksi oleh Gemini AI Vision
                      </span>
                      <span className="px-2 py-0.5 rounded bg-indigo-600 text-white text-[10px] font-bold">
                        Lantai {aiVisionInfo.suggestedFloor} &bull; Rak {aiVisionInfo.suggestedBin}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed">
                      <strong>Kategori:</strong> {aiVisionInfo.category} &bull; <strong>Status QC:</strong> {aiVisionInfo.qcStatus}. {aiVisionInfo.reasoning}
                    </p>
                  </div>
                )}

                <div className="space-y-3 text-xs">
                  {/* SKU & Batch Selection */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-slate-500">Barang / Master SKU</label>
                    <select
                      value={scannedForm.skuCode}
                      onChange={(e) => {
                        const code = e.target.value;
                        const matched = skuItems.find(s => s.skuCode === code);
                        setScannedForm(prev => ({
                          ...prev,
                          skuCode: code,
                          unit: matched?.unit || 'Pcs',
                          binLocation: matched?.binLocation || 'A-01-L1'
                        }));
                      }}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-bold cursor-pointer"
                    >
                      {skuItems.map(sku => (
                        <option key={sku.id} value={sku.skuCode}>
                          {sku.skuCode} &mdash; {sku.name} ({sku.unit})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-slate-500">Nomor Batch / Lot</label>
                      <input
                        type="text"
                        value={scannedForm.batchNo}
                        onChange={(e) => setScannedForm({ ...scannedForm, batchNo: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono text-slate-900 dark:text-white font-bold"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-slate-500">Lokasi Rak (Bin)</label>
                      <input
                        type="text"
                        value={scannedForm.binLocation}
                        onChange={(e) => setScannedForm({ ...scannedForm, binLocation: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono text-slate-900 dark:text-white font-bold"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-slate-500">Kuantitas Hasil Hitung</label>
                      <input
                        type="number"
                        value={scannedForm.qty}
                        onChange={(e) => setScannedForm({ ...scannedForm, qty: Number(e.target.value) })}
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono text-slate-900 dark:text-white font-black text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-slate-500">Satuan Hitung</label>
                      <input
                        type="text"
                        value={scannedForm.unit}
                        onChange={(e) => setScannedForm({ ...scannedForm, unit: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>

                  {/* Mode Specific Reference Selection */}
                  {scannerMode === 'INBOUND' ? (
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-slate-500">Referensi ASN / PO Supplier</label>
                      <input
                        type="text"
                        placeholder="Contoh: ASN-202610-083 / PO Internal Lini 1"
                        value={scannedForm.asnOrDoRef}
                        onChange={(e) => setScannedForm({ ...scannedForm, asnOrDoRef: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono"
                      />
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-slate-500">Rute Pengiriman Armada (DO Target)</label>
                      <select
                        value={scannedForm.selectedRoute}
                        onChange={(e) => setScannedForm({ ...scannedForm, selectedRoute: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-bold cursor-pointer"
                      >
                        <option value="Denpasar 1 (P 8848 U)">Denpasar 1 &mdash; Armada P 8848 U (N4)</option>
                        <option value="Denpasar 2 (P 8125 VC)">Denpasar 2 &mdash; Armada P 8125 VC (NS2)</option>
                        <option value="Jember & Tanggul (P 9677 VB)">Jember &mdash; Armada P 9677 VB (N2)</option>
                        <option value="Banyuwangi Selatan (P 9194 SA)">Banyuwangi Selatan &mdash; P 9194 SA (N1)</option>
                      </select>
                    </div>
                  )}

                  {/* 3 Physical QC Checklist points */}
                  <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
                      Verifikasi Fisik &amp; Kualitas Barang (QC)
                    </span>
                    <div className="space-y-1.5">
                      <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={scannedForm.qcPassDry}
                          onChange={(e) => setScannedForm({ ...scannedForm, qcPassDry: e.target.checked })}
                          className="w-3.5 h-3.5 rounded text-emerald-600 focus:ring-0 cursor-pointer"
                        />
                        <span className="text-slate-800 dark:text-slate-200 font-medium text-[11px]">
                          Karton kering, bebas lembab, fluting padat (B/CB-Flute OK)
                        </span>
                      </label>
                      <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={scannedForm.qcPassBarcode}
                          onChange={(e) => setScannedForm({ ...scannedForm, qcPassBarcode: e.target.checked })}
                          className="w-3.5 h-3.5 rounded text-emerald-600 focus:ring-0 cursor-pointer"
                        />
                        <span className="text-slate-800 dark:text-slate-200 font-medium text-[11px]">
                          Label Barcode / Cetak Kemasan terbaca jelas &amp; sesuai spesifikasi
                        </span>
                      </label>
                      <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={scannedForm.qcPassIntact}
                          onChange={(e) => setScannedForm({ ...scannedForm, qcPassIntact: e.target.checked })}
                          className="w-3.5 h-3.5 rounded text-emerald-600 focus:ring-0 cursor-pointer"
                        />
                        <span className="text-slate-800 dark:text-slate-200 font-medium text-[11px]">
                          Kondisi fisik kemasan tidak penyok, strapping aman
                        </span>
                      </label>
                    </div>
                  </div>

                  {/* Execution Sync Button */}
                  <div className="pt-2">
                    {scannerMode === 'INBOUND' ? (
                      <button
                        onClick={handleSyncInboundScan}
                        className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center justify-center gap-2 shadow-sm transition cursor-pointer"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Sinkronkan ke Inbound &amp; Tambah Stok Gudang</span>
                      </button>
                    ) : (
                      <button
                        onClick={handleSyncOutboundScan}
                        className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs flex items-center justify-center gap-2 shadow-sm transition cursor-pointer"
                      >
                        <ShieldCheck className="w-4 h-4" />
                        <span>Verifikasi Outbound &amp; Sinkronkan Pengurangan Stok</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Scan Audit Log History */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                <h4 className="text-sm font-black text-slate-900 dark:text-white">
                  Riwayat &amp; Audit Trail Hasil Pemindaian Foto Barang Hari Ini
                </h4>
              </div>
              <span className="text-xs font-bold text-slate-500">
                Total {scanAuditLogs.length} Pemindaian Tercatat
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 uppercase font-bold text-[10px] border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Waktu Pindai</th>
                    <th className="py-3 px-4">Mode Transaksi</th>
                    <th className="py-3 px-4">SKU &amp; Spesifikasi Barang</th>
                    <th className="py-3 px-4">Lokasi Bin &amp; Batch</th>
                    <th className="py-3 px-4 text-right">Kuantitas</th>
                    <th className="py-3 px-4">Status Verifikasi</th>
                    <th className="py-3 px-4">Referensi Dokumen</th>
                    <th className="py-3 px-4">Petugas Checker</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
                  {scanAuditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-4 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                        {log.timestamp}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            log.mode === 'INBOUND'
                              ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                              : 'bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300'
                          }`}
                        >
                          {log.mode}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 dark:text-white">{log.skuName}</div>
                        <div className="font-mono text-[10px] text-cyan-600 dark:text-cyan-400">{log.skuCode}</div>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px]">
                        <div>Bin: <strong>{log.binLocation}</strong></div>
                        <div className="text-[10px] text-slate-500">{log.batchNo}</div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-black text-slate-900 dark:text-white">
                        {log.detectedQty.toLocaleString('id-ID')} {log.unit}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-bold text-[10px] inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          {log.verificationStatus}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-400">
                        {log.targetReference}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                        {log.operatorPic}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 6: SIMULASI DENAH KATEGORI BARANG GUDANG 2 TINGKAT & MULTI-RAK   */}
      {/* ===================================================================== */}
      {activeTab === 'slotting' && (
        <div className="space-y-6">
          {/* Top Control Bar: Title, Floor Switcher, View Modes & AI Advisor */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2.5 py-0.5 rounded-md bg-blue-50 dark:bg-blue-500/15 border border-blue-200 dark:border-blue-500/30 text-blue-700 dark:text-blue-300 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                    <Warehouse className="w-3 h-3" />
                    Simulasi Tata Letak Gudang 2 Tingkat
                  </span>
                  <span className="px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-bold">
                    DC Banyuwangi (Jl. Argopuro No.60)
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                  Simulasi Denah Kategori Barang Gudang &amp; Profil Multi-Tingkat Rak
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Visualisasi tata letak komprehensif pada satu kompleks gudang dengan pembagian <strong>Lantai 1 (Ground Floor - Fast Moving &amp; Beban Berat)</strong> dan <strong>Lantai 2 (Mezzanine Floor - Food Grade &amp; Aksesoris Kemasan)</strong>, serta simulasi elevasi multi-tingkat rak.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  onClick={handleConsultAiSlotting}
                  disabled={isAiSlottingLoading}
                  className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs flex items-center gap-2 cursor-pointer shadow-xs disabled:opacity-50 transition"
                >
                  {isAiSlottingLoading ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  )}
                  <span>{isAiSlottingLoading ? 'Menganalisis Tata Letak...' : 'AI Slotting Advisor (Gemini)'}</span>
                </button>
              </div>
            </div>

            {/* Floor Switcher Selector Cards (Lantai 1 vs Lantai 2) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => {
                  setSelectedFloor(1);
                  const firstFloorBin = INITIAL_SLOTTING_BINS.find(b => b.floor === 1);
                  if (firstFloorBin) setSelectedBin(firstFloorBin);
                }}
                className={`p-4 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                  selectedFloor === 1
                    ? 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-600 dark:border-blue-500 shadow-sm'
                    : 'bg-slate-50/60 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center font-black text-xs">
                      L1
                    </span>
                    <div>
                      <h4 className="text-xs font-black text-slate-900 dark:text-white">
                        Lantai 1: Ground Floor (Beban Berat &amp; Fast-Moving)
                      </h4>
                      <p className="text-[10px] text-slate-500">
                        Pondasi Beton K-350 &bull; Beban Max 4.000 Kg/Pallet &bull; Tinggi Ceiling 8.5m
                      </p>
                    </div>
                  </div>
                  {selectedFloor === 1 && (
                    <span className="px-2 py-0.5 rounded-full bg-blue-600 text-white text-[10px] font-bold">
                      Aktif Dipilih
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400 pt-2 border-t border-blue-200/60 dark:border-blue-900/60">
                  <span>Komoditas: <strong>Karton Box, Plastik &amp; Staging Dock</strong></span>
                  <span>Rak: <strong>4 Tingkat (Level 1 - 4)</strong></span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">Utilisasi: 78%</span>
                </div>
              </button>

              <button
                onClick={() => {
                  setSelectedFloor(2);
                  const firstFloorBin = INITIAL_SLOTTING_BINS.find(b => b.floor === 2);
                  if (firstFloorBin) setSelectedBin(firstFloorBin);
                }}
                className={`p-4 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                  selectedFloor === 2
                    ? 'bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-600 dark:border-indigo-500 shadow-sm'
                    : 'bg-slate-50/60 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-black text-xs">
                      L2
                    </span>
                    <div>
                      <h4 className="text-xs font-black text-slate-900 dark:text-white">
                        Lantai 2: Mezzanine Floor (Clean Food Grade &amp; Aksesoris Kemasan)
                      </h4>
                      <p className="text-[10px] text-slate-500">
                        Baja Struktural &bull; Akses Freight Hoist 3 Ton &bull; Higienis Bebas Debu Dock
                      </p>
                    </div>
                  </div>
                  {selectedFloor === 2 && (
                    <span className="px-2 py-0.5 rounded-full bg-indigo-600 text-white text-[10px] font-bold">
                      Aktif Dipilih
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400 pt-2 border-t border-indigo-200/60 dark:border-indigo-900/60">
                  <span>Komoditas: <strong>Food Grade, Cup &amp; Lakban</strong></span>
                  <span>Rak: <strong>3 Tingkat (Level 1 - 3)</strong></span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">Utilisasi: 68%</span>
                </div>
              </button>
            </div>

            {/* View Mode & Category Legend Bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
                <span className="font-bold text-slate-500 shrink-0 mr-1 flex items-center gap-1">
                  <Sliders className="w-3.5 h-3.5" /> Mode:
                </span>
                <button
                  onClick={() => setSlottingViewMode('category')}
                  className={`px-3 py-1.5 rounded-lg font-bold cursor-pointer transition ${
                    slottingViewMode === 'category'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  Kategori Barang
                </button>
                <button
                  onClick={() => setSlottingViewMode('utilization')}
                  className={`px-3 py-1.5 rounded-lg font-bold cursor-pointer transition ${
                    slottingViewMode === 'utilization'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  Keterisian Rak (%)
                </button>
                <button
                  onClick={() => setSlottingViewMode('weight')}
                  className={`px-3 py-1.5 rounded-lg font-bold cursor-pointer transition ${
                    slottingViewMode === 'weight'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  Beban Tonase (Kg)
                </button>
              </div>

              {/* Filter Kategori Barang */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0">
                <span className="font-bold text-slate-500 shrink-0 mr-1 flex items-center gap-1">
                  <Filter className="w-3.5 h-3.5" /> Kategori:
                </span>
                {[
                  { id: 'ALL', label: 'Semua' },
                  { id: 'Karton Box', label: 'Karton Box' },
                  { id: 'Food Grade', label: 'Food Grade' },
                  { id: 'Plastik & Wrap', label: 'Plastik' },
                  { id: 'Cup & Lid', label: 'Cup & Lid' },
                  { id: 'Lakban & Aksesoris', label: 'Lakban' }
                ].map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategoryFilter(cat.id)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold cursor-pointer transition whitespace-nowrap ${
                      selectedCategoryFilter === cat.id
                        ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* AI Slotting Recommendations Alert (Gemini Output) */}
          {aiSlottingTips && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 border border-blue-200 dark:border-blue-800 text-xs space-y-3 animate-fade-in shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-500 shrink-0" />
                  <h4 className="font-black text-slate-900 dark:text-white">
                    Rekomendasi Cerdas Tata Letak AI Gemini &mdash; Lantai {selectedFloor}
                  </h4>
                </div>
                <button
                  onClick={() => setAiSlottingTips(null)}
                  className="p-1 rounded-md text-slate-500 hover:bg-white dark:hover:bg-slate-800 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {aiSlottingTips.map((tip, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-blue-200/60 dark:border-blue-900/60 space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 dark:text-white text-[11px]">{tip.title}</span>
                      <span className="px-1.5 py-0.2 rounded bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 font-extrabold text-[9px]">
                        {tip.category}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                      {tip.action}
                    </p>
                    <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                      &bull; {tip.impact}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Interactive 2D Architectural Floor Plan Visualization */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Denah Arsitektur Tata Letak Gudang Terpadu &bull; Lantai {selectedFloor}
                </h4>
                <p className="text-xs font-bold text-slate-900 dark:text-white">
                  {selectedFloor === 1
                    ? 'Layout Lantai Dasar (Area Bongkar Muat Armada, Jalur Forklift 3.5m & Rak Heavy Pallet)'
                    : 'Layout Mezzanine Lantai 2 (Area Higienis Food Grade, Cup Minuman, Lakban & Freight Hoist 3T)'}
                </p>
              </div>
              <div className="flex items-center gap-3 text-[11px]">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-amber-500"></span> Karton Box
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-emerald-500"></span> Food Grade
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-sky-500"></span> Plastik
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-yellow-500"></span> Cup &amp; Lid
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-purple-500"></span> Lakban/Aksesoris
                </span>
              </div>
            </div>

            {/* Architectural Layout Map Container */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 relative overflow-hidden">
              {/* Background Warehouse Grid Lines */}
              <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:24px_24px] opacity-40 pointer-events-none"></div>

              {selectedFloor === 1 ? (
                /* FLOOR 1 LAYOUT: DOCK BAYS, FORKLIFT LANE & RACKS A, B, C, D */
                <div className="space-y-4 relative z-10">
                  {/* Top: Loading Dock Bays 1-4 */}
                  <div className="grid grid-cols-4 gap-2">
                    {['Dock Bay 1 (Utama Denpasar 1)', 'Dock Bay 2 (Denpasar 2 Kuta)', 'Dock Bay 3 (Jember/Tanggul)', 'Dock Bay 4 (Inbound QC)'].map((dock, idx) => (
                      <div
                        key={idx}
                        className="py-2 px-3 rounded-lg bg-slate-900 border border-dashed border-cyan-500/40 text-center space-y-0.5"
                      >
                        <div className="flex items-center justify-center gap-1 text-[10px] font-mono font-bold text-cyan-400">
                          <Truck className="w-3 h-3" /> PINTU {idx + 1}
                        </div>
                        <div className="text-[10px] text-slate-300 font-semibold truncate">{dock}</div>
                      </div>
                    ))}
                  </div>

                  {/* Forklift Main Driveway Indicator */}
                  <div className="py-1 px-4 rounded-md bg-yellow-500/10 border-y border-dashed border-yellow-500/40 text-center flex items-center justify-between text-[10px] font-mono text-yellow-400 font-bold uppercase tracking-wider">
                    <span>&larr; Jalur Forklift Utama (3.5 Meter) &bull; Kecepatan Maks 10 km/jam &rarr;</span>
                    <span className="flex items-center gap-1">
                      <ArrowUpDown className="w-3 h-3" /> Akses Lift Barang (Freight Hoist 3 Ton) ke Lantai 2
                    </span>
                  </div>

                  {/* 4 Main Aisles on Floor 1 */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {INITIAL_SLOTTING_BINS.filter(b => b.floor === 1).map((bin) => {
                      const isSelected = selectedBin.binCode === bin.binCode;
                      const catColor =
                        bin.category === 'Karton Box'
                          ? 'border-amber-500/80 bg-amber-500/10 text-amber-300'
                          : bin.category === 'Plastik & Wrap'
                          ? 'border-sky-500/80 bg-sky-500/10 text-sky-300'
                          : 'border-cyan-500/80 bg-cyan-500/10 text-cyan-300';

                      return (
                        <button
                          key={bin.binCode}
                          onClick={() => setSelectedBin(bin)}
                          className={`p-3 rounded-xl border text-left transition cursor-pointer relative group ${catColor} ${
                            isSelected ? 'ring-2 ring-white shadow-lg scale-[1.02]' : 'hover:border-white/60'
                          }`}
                        >
                          <div className="flex items-center justify-between text-xs font-mono font-black">
                            <span>{bin.binCode}</span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-black/40 font-bold">
                              {slottingViewMode === 'category'
                                ? bin.category
                                : slottingViewMode === 'weight'
                                ? `${bin.maxWeightKg} Kg`
                                : `${bin.utilizationPct}%`}
                            </span>
                          </div>
                          <div className="text-[11px] font-bold text-white truncate mt-1">
                            {bin.primaryItem}
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-slate-300 mt-2 pt-1 border-t border-white/10">
                            <span>{bin.aisle}</span>
                            <span>{bin.totalLevels} Level Rak</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                /* FLOOR 2 LAYOUT: MEZZANINE CLEAN ROOM, AISLES E, F, G, H */
                <div className="space-y-4 relative z-10">
                  {/* Top: Freight Hoist Lift & Packing Tables */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="py-2 px-3 rounded-lg bg-indigo-950/60 border border-dashed border-indigo-400 text-center space-y-0.5">
                      <div className="text-[10px] font-mono font-bold text-indigo-400 flex items-center justify-center gap-1">
                        <ArrowUpDown className="w-3 h-3" /> PINTU FREIGHT HOIST (3 TON)
                      </div>
                      <div className="text-[10px] text-slate-300 font-semibold">Area Masuk Pallet dari Lantai 1</div>
                    </div>
                    <div className="py-2 px-3 rounded-lg bg-slate-900 border border-slate-800 text-center space-y-0.5">
                      <div className="text-[10px] font-mono font-bold text-emerald-400 flex items-center justify-center gap-1">
                        <ShieldCheck className="w-3 h-3" /> MEJA INSPEKSI FOOD GRADE
                      </div>
                      <div className="text-[10px] text-slate-300 font-semibold">QC Sanitasi &amp; Pengepakan Bersih</div>
                    </div>
                    <div className="py-2 px-3 rounded-lg bg-slate-900 border border-slate-800 text-center space-y-0.5">
                      <div className="text-[10px] font-mono font-bold text-purple-400 flex items-center justify-center gap-1">
                        <Tag className="w-3 h-3" /> PACKING TABLE &amp; RESI
                      </div>
                      <div className="text-[10px] text-slate-300 font-semibold">Lini Pasang Lakban &amp; Label Barcode</div>
                    </div>
                  </div>

                  {/* Mezzanine Hand Trolley Lane */}
                  <div className="py-1 px-4 rounded-md bg-indigo-500/10 border-y border-dashed border-indigo-500/40 text-center flex items-center justify-between text-[10px] font-mono text-indigo-300 font-bold uppercase tracking-wider">
                    <span>&larr; Jalur Hand Pallet Mezzanine &bull; Lorong E, F, G, H (Lantai 2) &rarr;</span>
                    <span>Zona Bersih Berstandar Higienis Food Packaging</span>
                  </div>

                  {/* 4 Main Aisles on Floor 2 */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {INITIAL_SLOTTING_BINS.filter(b => b.floor === 2).map((bin) => {
                      const isSelected = selectedBin.binCode === bin.binCode;
                      const catColor =
                        bin.category === 'Food Grade'
                          ? 'border-emerald-500/80 bg-emerald-500/10 text-emerald-300'
                          : bin.category === 'Cup & Lid'
                          ? 'border-yellow-500/80 bg-yellow-500/10 text-yellow-300'
                          : bin.category === 'Lakban & Aksesoris'
                          ? 'border-purple-500/80 bg-purple-500/10 text-purple-300'
                          : 'border-cyan-500/80 bg-cyan-500/10 text-cyan-300';

                      return (
                        <button
                          key={bin.binCode}
                          onClick={() => setSelectedBin(bin)}
                          className={`p-3 rounded-xl border text-left transition cursor-pointer relative group ${catColor} ${
                            isSelected ? 'ring-2 ring-white shadow-lg scale-[1.02]' : 'hover:border-white/60'
                          }`}
                        >
                          <div className="flex items-center justify-between text-xs font-mono font-black">
                            <span>{bin.binCode}</span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-black/40 font-bold">
                              {slottingViewMode === 'category'
                                ? bin.category
                                : slottingViewMode === 'weight'
                                ? `${bin.maxWeightKg} Kg`
                                : `${bin.utilizationPct}%`}
                            </span>
                          </div>
                          <div className="text-[11px] font-bold text-white truncate mt-1">
                            {bin.primaryItem}
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-slate-300 mt-2 pt-1 border-t border-white/10">
                            <span>{bin.aisle}</span>
                            <span>{bin.totalLevels} Level Rak</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Split Detail Grid: Left Rail (Rack Column Cards) + Right Rail (Multi-Tier Cross-Section Elevation Inspector) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Rail: List of Racks on this Floor (7 cols) */}
            <div className="lg:col-span-7 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span>Daftar Kolom Rak &bull; Lantai {selectedFloor}</span>
                </h4>
                <span className="text-xs text-slate-500">
                  {INITIAL_SLOTTING_BINS.filter(b => b.floor === selectedFloor).length} Rak Terdata
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {INITIAL_SLOTTING_BINS
                  .filter(b => b.floor === selectedFloor)
                  .filter(b => selectedCategoryFilter === 'ALL' || b.category === selectedCategoryFilter)
                  .map((bin) => {
                    const isSelected = selectedBin.binCode === bin.binCode;
                    const barColor =
                      bin.utilizationPct >= 90
                        ? 'bg-rose-500'
                        : bin.utilizationPct >= 65
                        ? 'bg-emerald-500'
                        : 'bg-amber-500';

                    return (
                      <button
                        key={bin.binCode}
                        onClick={() => setSelectedBin(bin)}
                        className={`p-4 rounded-2xl border text-left transition cursor-pointer space-y-2.5 ${
                          isSelected
                            ? 'bg-blue-50/70 dark:bg-blue-950/30 border-blue-600 dark:border-blue-500 shadow-sm'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-blue-400'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-sm font-black text-slate-900 dark:text-white">
                            RAK {bin.binCode}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              bin.status === 'full'
                                ? 'bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300'
                                : bin.status === 'low'
                                ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300'
                                : 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                            }`}
                          >
                            Terisi {bin.utilizationPct}%
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-bold text-indigo-600 dark:text-indigo-400">
                            {bin.category}
                          </span>
                          <span className="text-slate-500 font-mono text-[10px]">
                            {bin.totalLevels} Tingkat
                          </span>
                        </div>

                        <div className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                          {bin.primaryItem}
                        </div>

                        {/* Utilization Progress Bar */}
                        <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${barColor}`}
                            style={{ width: `${bin.utilizationPct}%` }}
                          />
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                          <span>{bin.currentQty}</span>
                          <span>Beban: {bin.maxWeightKg} Kg</span>
                        </div>
                      </button>
                    );
                  })}
              </div>
            </div>

            {/* Right Rail: MULTI-TIER RACK CROSS-SECTION ELEVATION INSPECTOR (5 cols) */}
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4 h-fit">
                <div className="border-b border-slate-200 dark:border-slate-800 pb-3 flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center gap-1">
                      <Layers className="w-3.5 h-3.5" />
                      Profil Elevasi Multi-Tingkat Rak
                    </span>
                    <h4 className="text-lg font-black text-slate-900 dark:text-white font-mono mt-0.5">
                      Struktur Rak: {selectedBin.binCode} (Lantai {selectedBin.floor})
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {selectedBin.zoneName} &bull; {selectedBin.aisle}
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 font-black text-xs font-mono">
                    {selectedBin.levels?.length || selectedBin.totalLevels} Level
                  </span>
                </div>

                {/* Structural Multi-Tier Cross-Section Visualizer (Stacked Levels from Top to Bottom) */}
                <div className="space-y-2">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                    <span>Tingkatan Balok Rak (Cross-Beams)</span>
                    <span>Tinggi Vertikal</span>
                  </div>

                  <div className="space-y-2 border-l-4 border-r-4 border-blue-600 dark:border-blue-500 px-3 py-2 bg-slate-50 dark:bg-slate-950 rounded-xl relative">
                    {selectedBin.levels && selectedBin.levels.length > 0 ? (
                      selectedBin.levels.map((lvl) => {
                        const levelBarColor =
                          lvl.utilizationPct >= 90
                            ? 'bg-rose-500'
                            : lvl.utilizationPct >= 65
                            ? 'bg-emerald-500'
                            : 'bg-amber-500';

                        return (
                          <div
                            key={lvl.levelNumber}
                            className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1.5 shadow-xs relative"
                          >
                            <div className="flex items-center justify-between">
                              <span className="px-2 py-0.5 rounded bg-blue-600 text-white font-mono text-[10px] font-black">
                                Level {lvl.levelNumber}
                              </span>
                              <span className="font-mono text-[10px] text-slate-500 font-bold">
                                Elevasi: {lvl.heightM.toFixed(1)}m
                              </span>
                            </div>

                            <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                              {lvl.skuName}
                            </div>

                            <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
                              <span className="font-mono text-cyan-600 dark:text-cyan-400 font-bold">
                                {lvl.skuCode}
                              </span>
                              <span>{lvl.currentQty}</span>
                            </div>

                            {/* Level Utilization Bar */}
                            <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${levelBarColor}`}
                                style={{ width: `${lvl.utilizationPct}%` }}
                              />
                            </div>

                            <div className="flex items-center justify-between text-[10px] pt-1 border-t border-slate-100 dark:border-slate-800 text-slate-500">
                              <span>Kapasitas Beban: {lvl.maxWeightKg} Kg</span>
                              <span className="font-bold text-slate-700 dark:text-slate-300">
                                {lvl.utilizationPct}% Terisi
                              </span>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="p-4 text-center text-xs text-slate-500">
                        Memuat data level rak...
                      </div>
                    )}
                  </div>
                </div>

                {/* Specific Slotting Rules & Actions */}
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400 space-y-1.5">
                  <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-blue-600" />
                    SOP Penempatan Rak (Slotting Rule):
                  </div>
                  <p className="leading-relaxed">
                    {selectedBin.slottingRuleNotes}
                  </p>
                </div>

                {/* Quick Action Buttons for Selected Bin */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    onClick={() => {
                      setScannedForm(prev => ({
                        ...prev,
                        binLocation: selectedBin.binCode,
                        skuCode: selectedBin.levels?.[0]?.skuCode || prev.skuCode
                      }));
                      handleTabChange('scanner');
                    }}
                    className="px-3 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Pindai Rak Ini</span>
                  </button>

                  <button
                    onClick={() => {
                      handleTabChange('opname');
                    }}
                    className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition"
                  >
                    <ClipboardCheck className="w-3.5 h-3.5" />
                    <span>Audit Opname</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 7: STOK OPNAME (CYCLE COUNT) & RIWAYAT KARTU STOK                 */}
      {/* ===================================================================== */}
      {activeTab === 'opname' && (
        <div className="space-y-6">
          {/* Tabel Lembar Kerja Stok Opname */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  Lembar Kerja Stok Opname (Cycle Counting) &amp; Rekonsiliasi Selisih Fisik
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Membandingkan stok sistem dengan hasil hitung fisik di rak. Jika terdapat selisih (Variance), Kepala Gudang dapat menyetujui penyesuaian stok.
                </p>
              </div>
              <span className="px-3 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-bold">
                Akurasi Fisik: 99.4%
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 uppercase font-bold text-[10px] border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">No. Opname &amp; Tanggal</th>
                    <th className="py-3 px-4">Lokasi Bin</th>
                    <th className="py-3 px-4">SKU &amp; Nama Barang</th>
                    <th className="py-3 px-4 text-right">Stok Sistem</th>
                    <th className="py-3 px-4 text-right">Stok Fisik</th>
                    <th className="py-3 px-4 text-right">Selisih</th>
                    <th className="py-3 px-4">Catatan Audit</th>
                    <th className="py-3 px-4 text-right">Status / Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
                  {opnameSheets.map((opn) => {
                    const variance = opn.physicalStock - opn.systemStock;
                    return (
                      <tr key={opn.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                        <td className="py-3 px-4">
                          <div className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{opn.opnameCode}</div>
                          <div className="text-[10px] text-slate-500">{opn.date} &bull; {opn.auditorPic}</div>
                        </td>
                        <td className="py-3 px-4 font-mono font-bold">{opn.binLocation}</td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900 dark:text-white">{opn.skuName}</div>
                          <div className="font-mono text-[10px] text-slate-500">{opn.skuCode}</div>
                        </td>
                        <td className="py-3 px-4 text-right font-mono">{opn.systemStock.toLocaleString('id-ID')} {opn.unit}</td>
                        <td className="py-3 px-4 text-right font-mono font-bold">{opn.physicalStock.toLocaleString('id-ID')} {opn.unit}</td>
                        <td className={`py-3 px-4 text-right font-mono font-black ${variance === 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                          {variance === 0 ? '0 (Klop)' : `${variance > 0 ? '+' : ''}${variance} ${opn.unit}`}
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-400 max-w-xs">{opn.notes}</td>
                        <td className="py-3 px-4 text-right">
                          {opn.status === 'Menunggu Verifikasi' ? (
                            <button
                              onClick={() => handleApproveOpnameAdjustment(opn.id)}
                              className="px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px] cursor-pointer transition"
                            >
                              Setujui Penyesuaian
                            </button>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-bold text-[10px]">
                              {opn.status}
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

          {/* Kartu Stok / Log Mutasi Barang (Stock Ledger) */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <h4 className="text-sm font-black text-slate-900 dark:text-white">
                  Kartu Stok Digital (Riwayat Mutasi Masuk, Keluar &amp; Penyesuaian Opname)
                </h4>
              </div>
              <span className="text-xs text-slate-500">Real-Time Audit Trail</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 uppercase font-bold text-[10px] border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Waktu Transaksi</th>
                    <th className="py-3 px-4">Jenis Mutasi</th>
                    <th className="py-3 px-4">No. Referensi</th>
                    <th className="py-3 px-4">SKU &amp; Nama Barang</th>
                    <th className="py-3 px-4">Lokasi Bin</th>
                    <th className="py-3 px-4 text-right">Mutasi Qty</th>
                    <th className="py-3 px-4 text-right">Saldo Akhir</th>
                    <th className="py-3 px-4">Petugas (PIC)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
                  {ledgerEntries.map((entry) => (
                    <tr key={entry.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">{entry.timestamp}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                            entry.txType === 'INBOUND'
                              ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                              : entry.txType === 'OUTBOUND'
                              ? 'bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300'
                              : 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300'
                          }`}
                        >
                          {entry.txType}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold">{entry.referenceNo}</td>
                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-900 dark:text-white">{entry.skuName}</span>
                      </td>
                      <td className="py-3 px-4 font-mono">{entry.binLocation}</td>
                      <td className={`py-3 px-4 text-right font-mono font-black ${entry.qtyChange.startsWith('+') ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                        {entry.qtyChange}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold">
                        {entry.balanceAfter.toLocaleString('id-ID')}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{entry.pic}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL: TAMBAH MASTER SKU BARU                                         */}
      {/* ===================================================================== */}
      {isAddSkuModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-black text-slate-900 dark:text-white">Tambah Master SKU Gudang Baru</h4>
              <button
                onClick={() => setIsAddSkuModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddSku} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-600 dark:text-slate-400 uppercase text-[10px]">Kode SKU</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: AKK-KBX-009"
                    value={newSkuForm.skuCode}
                    onChange={(e) => setNewSkuForm({ ...newSkuForm, skuCode: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-600 dark:text-slate-400 uppercase text-[10px]">Kategori</label>
                  <select
                    value={newSkuForm.category}
                    onChange={(e) => setNewSkuForm({ ...newSkuForm, category: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="Karton Box">Karton Box</option>
                    <option value="Plastik & Kemasan">Plastik &amp; Kemasan</option>
                    <option value="Material Packing">Material Packing</option>
                    <option value="Produk Distribusi">Produk Distribusi</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-600 dark:text-slate-400 uppercase text-[10px]">Nama &amp; Spesifikasi Barang</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Karton Box Die-Cut Pizza 25x25x5 cm"
                  value={newSkuForm.name}
                  onChange={(e) => setNewSkuForm({ ...newSkuForm, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-600 dark:text-slate-400 uppercase text-[10px]">Lokasi Bin Rak</label>
                  <input
                    type="text"
                    required
                    placeholder="A-02-L1"
                    value={newSkuForm.binLocation}
                    onChange={(e) => setNewSkuForm({ ...newSkuForm, binLocation: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-600 dark:text-slate-400 uppercase text-[10px]">Satuan Hitung</label>
                  <select
                    value={newSkuForm.unit}
                    onChange={(e) => setNewSkuForm({ ...newSkuForm, unit: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="Pcs">Pcs</option>
                    <option value="Ball">Ball</option>
                    <option value="Roll">Roll</option>
                    <option value="Karton">Karton</option>
                    <option value="Ikat">Ikat</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-600 dark:text-slate-400 uppercase text-[10px]">Stok Awal Fisik</label>
                  <input
                    type="number"
                    required
                    placeholder="Contoh: 2000"
                    value={newSkuForm.stockOnHand}
                    onChange={(e) => setNewSkuForm({ ...newSkuForm, stockOnHand: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-600 dark:text-slate-400 uppercase text-[10px]">Batas Minimum (ROP)</label>
                  <input
                    type="number"
                    required
                    placeholder="Contoh: 500"
                    value={newSkuForm.reorderPoint}
                    onChange={(e) => setNewSkuForm({ ...newSkuForm, reorderPoint: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddSkuModalOpen(false)}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold cursor-pointer"
                >
                  Simpan SKU
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL: CATAT PENERIMAAN BARANG INBOUND BARU                           */}
      {/* ===================================================================== */}
      {isAddInboundOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-black text-slate-900 dark:text-white">Catat Penerimaan Barang Masuk (Inbound ASN)</h4>
              <button
                onClick={() => setIsAddInboundOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddInbound} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-600 dark:text-slate-400 uppercase text-[10px]">Sumber Pabrik / Nama Supplier</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: PT. Kertas Kraft Nusantara / Lini Corrugator 2"
                  value={newInboundForm.supplierOrSource}
                  onChange={(e) => setNewInboundForm({ ...newInboundForm, supplierOrSource: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-600 dark:text-slate-400 uppercase text-[10px]">Nomor Referensi PO</label>
                  <input
                    type="text"
                    placeholder="PO-SUP-2610-088"
                    value={newInboundForm.poReference}
                    onChange={(e) => setNewInboundForm({ ...newInboundForm, poReference: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-600 dark:text-slate-400 uppercase text-[10px]">Plat Kendaraan / Lini</label>
                  <input
                    type="text"
                    placeholder="L 8821 UQ"
                    value={newInboundForm.vehiclePlate}
                    onChange={(e) => setNewInboundForm({ ...newInboundForm, vehiclePlate: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-600 dark:text-slate-400 uppercase text-[10px]">Rincian Barang / SKU Masuk</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Karton Box B-Flute 60x40x40 cm"
                  value={newInboundForm.skuSummary}
                  onChange={(e) => setNewInboundForm({ ...newInboundForm, skuSummary: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <label className="font-bold text-slate-600 dark:text-slate-400 uppercase text-[10px]">Jumlah Qty</label>
                  <input
                    type="number"
                    required
                    placeholder="1500"
                    value={newInboundForm.totalQty}
                    onChange={(e) => setNewInboundForm({ ...newInboundForm, totalQty: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-600 dark:text-slate-400 uppercase text-[10px]">Satuan</label>
                  <input
                    type="text"
                    placeholder="Pcs / Ball"
                    value={newInboundForm.unit}
                    onChange={(e) => setNewInboundForm({ ...newInboundForm, unit: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-600 dark:text-slate-400 uppercase text-[10px]">Target Rak Bin</label>
                  <input
                    type="text"
                    placeholder="A-01-L1"
                    value={newInboundForm.targetBin}
                    onChange={(e) => setNewInboundForm({ ...newInboundForm, targetBin: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddInboundOpen(false)}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer"
                >
                  Simpan ASN Inbound
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
