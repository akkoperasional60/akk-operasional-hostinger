import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  Box,
  Layers,
  Truck,
  ArrowDownToLine,
  ArrowUpFromLine,
  RotateCcw,
  Play,
  Package,
  CheckCircle2,
  Eye,
  Plus,
  Minus,
  Sliders,
  Camera,
  MapPin,
  Building2,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import type { MasterSkuRecord } from './WarehouseManagementSystem';

export interface AisleSlot3D {
  id: string;
  floor: 1 | 2;
  aisleNumber: number; // 1..8 (Lorong 1 s/d Lorong 8)
  aisleName: string;
  photoLabel: string;
  photoUrl: string;
  spatialDesc: string;
  hasMezzanineAbove: boolean;
  rackStyle: 'HIGH_RACK' | 'MIXED_RACK_SACK' | 'BULK_SACK_SHEET' | 'UNDER_MEZZANINE' | 'MEZZANINE_TOP';
  kategoriBarang: string;
  occupiedPallets: number;
  maxPallets: number;
  stockQty: number;
  satuan: string;
  colorHex: string;
}

interface SimulationLog {
  id: string;
  timestamp: string;
  operation: 'PENAMBAHAN' | 'PENGURANGAN';
  ramNumber: 1 | 2 | 3;
  floor: 1 | 2;
  aisleNumber: number;
  kategoriBarang: string;
  qty: number;
  palletsDelta: number;
  status: string;
}

interface ActiveForkliftTask {
  operation: 'PENAMBAHAN' | 'PENGURANGAN';
  ramNumber: 1 | 2 | 3;
  floor: 1 | 2;
  targetAisle: number; // 1..8
  colorHex: string;
  progress: number; // 0..100
}

// Koordinat X untuk 8 Lorong Lantai 1 (Dari Sisi Kiri ke Kanan)
const AISLE_X_POSITIONS: Record<number, number> = {
  1: -24.5, // Lorong 1: Paling kiri
  2: -17.5, // Lorong 2: Akses Pintu Ram 3
  3: -10.5, // Lorong 3: Akses Ruang PO
  4: -3.5,  // Lorong 4: Staging Pallet Terbuka (Sheet & Bal)
  5: 3.5,   // Lorong 5: Staging Pallet Terbuka Tengah
  6: 10.5,  // Lorong 6: Staging Pallet Terbuka Batas Mezzanine
  7: 17.5,  // Lorong 7: Di bawah dek mezzanine Lantai 2
  8: 24.5,  // Lorong 8: Paling kanan di bawah mezzanine & Tangga akses
};

// Urutan Area Depan Gudang (Dari Kiri ke Kanan):
// 1. Gudang/Rak Bahan Makan (X = -24.5)
// 2. Pintu Ram 3 (Paling Kiri): X = -15.0
// 3. Ruang PO: X = -5.5
// 4. Pintu Ram 2 (Tengah): X = 4.0
// 5. Gudang/Rak Bahan Kue: X = 13.5
// 6. Pintu Ram 1 (Paling Kanan - Bongkar Supplier): X = 23.5
const FRONT_ZONE_X = {
  BAHAN_MAKAN: -24.5,
  RAM_3: -15.0,
  RUANG_PO: -5.5,
  RAM_2: 4.0,
  BAHAN_KUE: 13.5,
  RAM_1: 23.5,
};

const RAM_X_POSITIONS: Record<1 | 2 | 3, number> = {
  3: FRONT_ZONE_X.RAM_3, // Paling Kiri (-15.0)
  2: FRONT_ZONE_X.RAM_2, // Tengah (4.0)
  1: FRONT_ZONE_X.RAM_1, // Paling Kanan (23.5) - Bongkar Barang dari Armada Supplier
};

const FLOOR_2_Y = 7.4;

const CATEGORY_COLORS = [
  '#2563eb', // Biru
  '#059669', // Hijau
  '#d97706', // Oranye
  '#7c3aed', // Ungu
  '#e11d48', // Merah
  '#0891b2', // Cyan
  '#4f46e5', // Indigo
  '#ea580c', // Amber Tua
];

function buildAisleVisualDataUri(
  aisleNum: number,
  label: string,
  hasFloor2: boolean,
  style: AisleSlot3D['rackStyle']
): string {
  const bg = hasFloor2 ? '#1e293b' : '#0f172a';
  const roofColor = hasFloor2 ? '#ea580c' : '#d97706';
  const leftRack = style === 'BULK_SACK_SHEET' ? '#f8fafc' : '#1d4ed8';
  const rightRack =
    style === 'MIXED_RACK_SACK' || style === 'BULK_SACK_SHEET' ? '#e2e8f0' : '#1d4ed8';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="260" viewBox="0 0 400 260">
    <rect width="400" height="260" fill="${bg}"/>
    <polygon points="0,0 400,0 320,65 80,65" fill="#334155"/>
    <line x1="20" y1="15" x2="380" y2="15" stroke="${roofColor}" stroke-width="6"/>
    <line x1="50" y1="40" x2="350" y2="40" stroke="${roofColor}" stroke-width="5"/>
    ${
      hasFloor2
        ? `<rect x="65" y="48" width="270" height="16" fill="#ea580c" rx="2"/>
           <text x="200" y="60" fill="#ffffff" font-family="sans-serif" font-size="10" font-weight="bold" text-anchor="middle">DEK LANTAI 2 (MEZZANINE)</text>`
        : ''
    }
    <polygon points="0,260 135,175 265,175 400,260" fill="#64748b"/>
    <polygon points="0,35 135,75 135,195 0,250" fill="${leftRack}" opacity="0.9"/>
    <polygon points="400,35 265,75 265,195 400,250" fill="${rightRack}" opacity="0.9"/>
    <line x1="0" y1="95" x2="135" y2="115" stroke="#ea580c" stroke-width="5"/>
    <line x1="0" y1="155" x2="135" y2="155" stroke="#ea580c" stroke-width="5"/>
    <line x1="400" y1="95" x2="265" y2="115" stroke="#ea580c" stroke-width="5"/>
    <line x1="400" y1="155" x2="265" y2="155" stroke="#ea580c" stroke-width="5"/>
    <rect x="95" y="218" width="210" height="28" rx="6" fill="#0f172a" opacity="0.9"/>
    <text x="200" y="236" fill="#fbbf24" font-family="sans-serif" font-size="12" font-weight="bold" text-anchor="middle">LORONG ${aisleNum} • ${label}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// Referensi Fisik Lorong Gudang (Lorong 1 s/d Lorong 8 dari Sisi Kiri ke Kanan)
export const WAREHOUSE_PHOTO_POSITIONS: Array<{
  aisleNumber: number;
  photoLabel: string;
  title: string;
  photoUrl: string;
  fallbackUrl: string;
  description: string;
  hasFloor2Above: boolean;
  frontFeature: string;
  rackStyle: AisleSlot3D['rackStyle'];
}> = [
  {
    aisleNumber: 1,
    photoLabel: 'Lorong 1 (Paling Kiri)',
    title: 'Lorong 1 — Posisi Lantai 1 Paling Kiri',
    photoUrl: '/assets/aistudio/image_4ec98a9c.png',
    fallbackUrl: buildAisleVisualDataUri(1, 'PALING KIRI', false, 'HIGH_RACK'),
    description:
      'Rak pallet besi tinggi biru-oranye di sisi paling kiri gudang (langsung atap tanpa Lantai 2). Di depannya terdapat Gudang/Rak Bahan Makan.',
    hasFloor2Above: false,
    frontFeature: 'Depan: Gudang / Rak Bahan Makan',
    rackStyle: 'HIGH_RACK',
  },
  {
    aisleNumber: 2,
    photoLabel: 'Lorong 2 (Akses Ram 3)',
    title: 'Lorong 2 — Area Depan Pintu Ram 3',
    photoUrl: '/assets/aistudio/image_a839345b.png',
    fallbackUrl: buildAisleVisualDataUri(2, 'AKSES RAM 3', false, 'HIGH_RACK'),
    description:
      'Rak besi tinggi C9/C10 berisi karton box, tissue See-U, dan bal kemasan plastik (langsung atap). Di depannya mengarah ke Pintu Ram 3.',
    hasFloor2Above: false,
    frontFeature: 'Depan: Pintu Ram 3 (Muat Kiri)',
    rackStyle: 'HIGH_RACK',
  },
  {
    aisleNumber: 3,
    photoLabel: 'Lorong 3 (Transisi Rak)',
    title: 'Lorong 3 — Transisi Rak Tinggi & Bal Karung',
    photoUrl: '/assets/aistudio/image_6f67b269.png',
    fallbackUrl: buildAisleVisualDataUri(3, 'TRANSISI RAK', false, 'MIXED_RACK_SACK'),
    description:
      'Sisi kiri berupa rak besi tinggi dan sisi kanan berupa staging bal/karung putih (langsung atap tanpa Lantai 2). Di depannya akses Ruang PO.',
    hasFloor2Above: false,
    frontFeature: 'Depan: Akses Pintu Ram 3 & Ruang PO',
    rackStyle: 'MIXED_RACK_SACK',
  },
  {
    aisleNumber: 4,
    photoLabel: 'Lorong 4 (Pallet Lantai)',
    title: 'Lorong 4 — Area Pallet Terbuka (Tanpa Rak Besi)',
    photoUrl: '/assets/aistudio/image_e1f6e9bd.png',
    fallbackUrl: buildAisleVisualDataUri(4, 'PALLET LANTAI', false, 'BULK_SACK_SHEET'),
    description:
      'Area penataan khusus pallet lantai terbuka (tanpa struktur rak besi) untuk tumpukan bal plastik putih dan lembaran sheet karton lipat. Di depannya terdapat Ruang PO.',
    hasFloor2Above: false,
    frontFeature: 'Depan: Ruang PO (Purchase Order)',
    rackStyle: 'BULK_SACK_SHEET',
  },
  {
    aisleNumber: 5,
    photoLabel: 'Lorong 5 (Pallet Lantai Tengah)',
    title: 'Lorong 5 — Area Pallet Terbuka Tengah (Tanpa Rak Besi)',
    photoUrl: '/assets/aistudio/image_cbadfd7a.png',
    fallbackUrl: buildAisleVisualDataUri(5, 'PALLET LANTAI', false, 'BULK_SACK_SHEET'),
    description:
      'Area penataan pallet lantai terbuka tengah (tanpa struktur rak besi) untuk tumpukan karung bal putih & karton. Di depannya terdapat Pintu Ram 2.',
    hasFloor2Above: false,
    frontFeature: 'Depan: Pintu Ram 2 (Muat Tengah)',
    rackStyle: 'BULK_SACK_SHEET',
  },
  {
    aisleNumber: 6,
    photoLabel: 'Lorong 6 (Pallet Lantai Batas Mezzanine)',
    title: 'Lorong 6 — Area Pallet Terbuka Batas Mezzanine (Tanpa Rak Besi)',
    photoUrl: '/assets/aistudio/image_030eecf5.png',
    fallbackUrl: buildAisleVisualDataUri(6, 'PALLET LANTAI', false, 'BULK_SACK_SHEET'),
    description:
      'Area penataan pallet lantai terbuka (tanpa struktur rak besi). Di sebelah kanannya mulai berdiri tiang baja dek mezzanine Lantai 2. Di depannya terdapat Gudang/Rak Bahan Kue.',
    hasFloor2Above: false,
    frontFeature: 'Depan: Gudang / Rak Bahan Kue',
    rackStyle: 'BULK_SACK_SHEET',
  },
  {
    aisleNumber: 7,
    photoLabel: 'Lorong 7 (Bawah Mezzanine)',
    title: 'Lorong 7 — Rak Besi di Bawah Dek Mezzanine Lantai 2',
    photoUrl: '/assets/aistudio/image_b3c2eaa5.png',
    fallbackUrl: buildAisleVisualDataUri(7, 'BAWAH MEZZANINE', true, 'UNDER_MEZZANINE'),
    description:
      'Berada tepat di bawah dek Lantai 2 (konstruksi balok baja oranye di atasnya) dengan rak besi abu-abu (A7) di kiri dan kanan.',
    hasFloor2Above: true,
    frontFeature: 'Depan: Gudang Bahan Kue & Akses Ram 1',
    rackStyle: 'UNDER_MEZZANINE',
  },
  {
    aisleNumber: 8,
    photoLabel: 'Lorong 8 (Bawah Mezzanine • Tangga)',
    title: 'Lorong 8 — Rak Bawah Mezzanine & Tangga Akses',
    photoUrl: '/assets/aistudio/image_e8147110.png',
    fallbackUrl: buildAisleVisualDataUri(8, 'PALING KANAN • TANGGA', true, 'UNDER_MEZZANINE'),
    description:
      'Posisi paling kanan di bawah dek Lantai 2. Tepat di depan lorong ini terdapat Tangga naik ke Lantai 2 dan Pintu Ram 1 (Bongkar Armada Supplier).',
    hasFloor2Above: true,
    frontFeature: 'Depan: Tangga Lantai 2 & Pintu Ram 1 (Bongkar Supplier)',
    rackStyle: 'UNDER_MEZZANINE',
  },
];

// Cache untuk tekstur Billboard agar rendering instan tanpa overhead canvas 2D berulang
const billboardTextureCache = new Map<string, THREE.CanvasTexture>();

function getBillboardTexture(
  titleText: string,
  subtitleText: string,
  borderColor: string,
  bgColor: string,
  titleColor: string,
  subColor: string
): THREE.CanvasTexture {
  const cacheKey = `${titleText}|${subtitleText}|${borderColor}|${bgColor}|${titleColor}|${subColor}`;
  const cached = billboardTextureCache.get(cacheKey);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 144;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = bgColor;
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.roundRect(8, 8, canvas.width - 16, canvas.height - 16, 18);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = titleColor;
    ctx.font = '900 26px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(titleText.slice(0, 32), canvas.width / 2, 52);

    ctx.fillStyle = subColor;
    ctx.font = '700 19px Inter, system-ui, sans-serif';
    ctx.fillText(subtitleText.slice(0, 38), canvas.width / 2, 98);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  billboardTextureCache.set(cacheKey, texture);
  return texture;
}

// Helper membuat Sprite Label Teks 3D yang tajam & kontras (cepat dengan cache)
function createBillboardLabel(
  titleText: string,
  subtitleText: string,
  borderColor: string,
  bgColor = '#ffffff',
  titleColor = '#0f172a',
  subColor = '#334155',
  scaleWidth = 6.2,
  scaleHeight = 1.65
): THREE.Sprite {
  const texture = getBillboardTexture(titleText, subtitleText, borderColor, bgColor, titleColor, subColor);
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(scaleWidth, scaleHeight, 1);
  sprite.renderOrder = 999;
  return sprite;
}

// Helper mengambil daftar Kategori Barang unik langsung dari Master Barang
function extractCategoriesFromMasterStock(items: MasterSkuRecord[]): Array<{
  kategori: string;
  totalStok: number;
  satuan: string;
}> {
  const map = new Map<string, { totalStok: number; satuan: string }>();
  items.forEach((item) => {
    const kat = (item.kategoriBarang || 'Kemasan Umum').trim();
    const prev = map.get(kat);
    if (prev) {
      prev.totalStok += item.stokTersedia;
    } else {
      map.set(kat, {
        totalStok: item.stokTersedia,
        satuan: item.satuan || 'Pcs',
      });
    }
  });

  const result = Array.from(map.entries()).map(([kategori, info]) => ({
    kategori,
    totalStok: info.totalStok,
    satuan: info.satuan,
  }));

  const defaultCategories = [
    { kategori: 'Karton Box Corrugated', totalStok: 6500, satuan: 'Pcs' },
    { kategori: 'Tissue & Kemasan Plastik', totalStok: 4800, satuan: 'Pcs' },
    { kategori: 'Karung & Bal Plastik Putih', totalStok: 3900, satuan: 'Bal' },
    { kategori: 'Lembaran Sheet Karton Lipat', totalStok: 5200, satuan: 'Lembar' },
    { kategori: 'Bahan Makan & Food Pack', totalStok: 4100, satuan: 'Pack' },
    { kategori: 'Bahan Kue & Paper Tray', totalStok: 3600, satuan: 'Pack' },
    { kategori: 'Gelas & Cup Plastik (A7)', totalStok: 4400, satuan: 'Roll' },
    { kategori: 'Lakban & Stretch Film', totalStok: 2900, satuan: 'Roll' },
  ];

  defaultCategories.forEach((def) => {
    if (!result.some((r) => r.kategori.toLowerCase() === def.kategori.toLowerCase())) {
      result.push(def);
    }
  });

  return result;
}

function buildInitial2FloorSlots(items: MasterSkuRecord[]): AisleSlot3D[] {
  const categories = extractCategoriesFromMasterStock(items);
  const slots: AisleSlot3D[] = [];

  // Lantai 1: 8 Lorong dari Sisi Paling Kiri (Lorong 1) sampai Paling Kanan (Lorong 8)
  WAREHOUSE_PHOTO_POSITIONS.forEach((pos, idx) => {
    const catObj = categories[idx % categories.length];
    const colorHex = CATEGORY_COLORS[idx % CATEGORY_COLORS.length];
    // Lorong 4, 5, 6 adalah staging pallet lantai terbuka tanpa rak besi
    const isFloorPallet = pos.aisleNumber >= 4 && pos.aisleNumber <= 6;
    const maxPallets = isFloorPallet ? 18 : pos.hasFloor2Above ? 24 : 32;
    const occupiedPallets = isFloorPallet
      ? 14
      : pos.hasFloor2Above
      ? Math.min(maxPallets, 14 + (idx % 5) * 2)
      : Math.min(maxPallets, 20 + (idx % 6) * 2);

    slots.push({
      id: `F1-L${pos.aisleNumber}`,
      floor: 1,
      aisleNumber: pos.aisleNumber,
      aisleName: `Lorong ${pos.aisleNumber}`,
      photoLabel: pos.photoLabel,
      photoUrl: pos.photoUrl,
      spatialDesc: pos.description,
      hasMezzanineAbove: pos.hasFloor2Above,
      rackStyle: pos.rackStyle,
      kategoriBarang: catObj.kategori,
      occupiedPallets,
      maxPallets,
      stockQty: Math.max(600, Math.round(catObj.totalStok * 0.55)),
      satuan: catObj.satuan,
      colorHex,
    });
  });

  // Lantai 2 (Mezzanine): Hanya berada di atas Lorong 7 & Lorong 8
  [7, 8].forEach((aisleNum, i) => {
    const pos = WAREHOUSE_PHOTO_POSITIONS.find((p) => p.aisleNumber === aisleNum)!;
    const catObj = categories[(aisleNum + i) % categories.length];
    const colorHex = CATEGORY_COLORS[(aisleNum + 1) % CATEGORY_COLORS.length];
    const maxPallets = 24;
    const occupiedPallets = 15 + i * 3;

    slots.push({
      id: `F2-L${aisleNum}`,
      floor: 2,
      aisleNumber: aisleNum,
      aisleName: `Lorong ${aisleNum} (Dek Mezzanine)`,
      photoLabel: `Lantai 2 Mezzanine (Lorong ${aisleNum})`,
      photoUrl: pos.photoUrl,
      spatialDesc: `Dek Lantai 2 tepat di atas Lorong ${aisleNum}. Diakses melalui Tangga di depan Lorong 8.`,
      hasMezzanineAbove: false,
      rackStyle: 'MEZZANINE_TOP',
      kategoriBarang: catObj.kategori,
      occupiedPallets,
      maxPallets,
      stockQty: Math.max(450, Math.round(catObj.totalStok * 0.45)),
      satuan: catObj.satuan,
      colorHex,
    });
  });

  return slots;
}

interface Warehouse3DSimulationProps {
  skuList?: MasterSkuRecord[];
  isVisible?: boolean;
}

export const Warehouse3DSimulation: React.FC<Warehouse3DSimulationProps> = ({ skuList = [], isVisible = true }) => {
  const mountRef = useRef<HTMLDivElement | null>(null);

  const masterCategories = useMemo(
    () => extractCategoriesFromMasterStock(skuList),
    [skuList]
  );

  const [slots, setSlots] = useState<AisleSlot3D[]>(() =>
    buildInitial2FloorSlots(skuList)
  );

  // Filter tampilan lantai di 3D ("ALL" = Semua Lantai, 1 = Lantai 1 Saja, 2 = Lantai 2 Saja)
  const [floorViewFilter, setFloorViewFilter] = useState<'ALL' | 1 | 2>('ALL');

  // Form Kustomisasi & Simulasi
  const [simMode, setSimMode] = useState<'PENAMBAHAN' | 'PENGURANGAN'>('PENAMBAHAN');
  const [selectedFloor, setSelectedFloor] = useState<1 | 2>(1);
  const [selectedAisle, setSelectedAisle] = useState<number>(1);
  const [selectedRam, setSelectedRam] = useState<1 | 2 | 3>(1);
  const [selectedKategori, setSelectedKategori] = useState<string>(
    () => masterCategories[0]?.kategori || 'Karton Box Corrugated'
  );
  const [simPallets, setSimPallets] = useState<number>(2);
  const [simQty, setSimQty] = useState<number>(500);
  const [customStepPallets, setCustomStepPallets] = useState<number>(2);
  const [showPhotoModal, setShowPhotoModal] = useState<boolean>(false);

  const [activeTask, setActiveTask] = useState<ActiveForkliftTask | null>(null);
  const [simLogs, setSimLogs] = useState<SimulationLog[]>([
    {
      id: 'SIM-INIT-1',
      timestamp: '08:15:10',
      operation: 'PENAMBAHAN',
      ramNumber: 1,
      floor: 1,
      aisleNumber: 8,
      kategoriBarang: 'Karton Box Corrugated',
      qty: 600,
      palletsDelta: 2,
      status: 'Selesai: Bongkar dari Armada Supplier di Pintu Ram 1 (Kanan) -> Lantai 1 Lorong 8 (Gambar 9)',
    },
    {
      id: 'SIM-INIT-2',
      timestamp: '09:05:42',
      operation: 'PENGURANGAN',
      ramNumber: 3,
      floor: 1,
      aisleNumber: 2,
      kategoriBarang: 'Tissue & Kemasan Plastik',
      qty: 450,
      palletsDelta: 2,
      status: 'Selesai: Muat dari Lantai 1 Lorong 2 (Gambar 3) -> Pintu Ram 3 (Paling Kiri)',
    },
  ]);

  // Otomatis sesuaikan Pintu Ram saat mode berubah
  useEffect(() => {
    if (simMode === 'PENAMBAHAN') {
      setSelectedRam(1); // Ram 1 di paling kanan untuk bongkar supplier
    } else if (selectedRam === 1) {
      setSelectedRam(2); // Ram 2 (tengah) atau Ram 3 (paling kiri) untuk muat
    }
  }, [simMode, selectedRam]);

  // Pastikan jika memilih Lantai 2, lorong hanya 7 atau 8 (di atas Gambar 8 & Gambar 9)
  useEffect(() => {
    if (selectedFloor === 2 && selectedAisle < 7) {
      setSelectedAisle(7);
    }
  }, [selectedFloor, selectedAisle]);

  const activeTaskRef = useRef<ActiveForkliftTask | null>(null);
  useEffect(() => {
    activeTaskRef.current = activeTask;
  }, [activeTask]);

  const slotsRef = useRef<AisleSlot3D[]>(slots);
  useEffect(() => {
    slotsRef.current = slots;
  }, [slots]);

  const floorViewRef = useRef<'ALL' | 1 | 2>(floorViewFilter);
  useEffect(() => {
    floorViewRef.current = floorViewFilter;
  }, [floorViewFilter]);

  const palletVisualsRef = useRef<THREE.Group | null>(null);
  const floor2GroupRef = useRef<THREE.Group | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const isVisibleRef = useRef<boolean>(isVisible);

  const fullscreenWrapperRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const toggleFullscreen = () => {
    if (!fullscreenWrapperRef.current) return;

    if (!document.fullscreenElement && !isFullscreen) {
      if (fullscreenWrapperRef.current.requestFullscreen) {
        fullscreenWrapperRef.current.requestFullscreen().catch(() => {
          setIsFullscreen(true);
        });
      } else {
        setIsFullscreen(true);
      }
    } else {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        }
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  useEffect(() => {
    const timer = setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 50);
    return () => clearTimeout(timer);
  }, [isFullscreen]);

  useEffect(() => {
    isVisibleRef.current = isVisible;
    if (isVisible && rendererRef.current && cameraRef.current && mountRef.current) {
      const container = mountRef.current;
      const w = container.clientWidth || 920;
      const h = container.clientHeight || 560;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
      if (sceneRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    }
  }, [isVisible]);

  // Fungsi fokus kamera ke lorong tertentu atau tampak keseluruhan
  const focusCameraOnSection = (view: 'OVERVIEW' | 'FRONT_DOORS' | 'FLOOR_2' | number) => {
    if (!cameraRef.current || !controlsRef.current) return;
    if (view === 'OVERVIEW') {
      cameraRef.current.position.set(0, 31, 44);
      controlsRef.current.target.set(0, 3, -1);
    } else if (view === 'FRONT_DOORS') {
      cameraRef.current.position.set(0, 18, 38);
      controlsRef.current.target.set(0, 2, 11);
    } else if (view === 'FLOOR_2') {
      cameraRef.current.position.set(21, 20, 28);
      controlsRef.current.target.set(21, 8, -2);
    } else if (typeof view === 'number') {
      const targetX = AISLE_X_POSITIONS[view] ?? 0;
      cameraRef.current.position.set(targetX, 14, 24);
      controlsRef.current.target.set(targetX, 3.5, -4);
    }
    controlsRef.current.update();
  };

  // Render Palet 3D Dinamis sesuai posisi Gambar 2 s/d Gambar 9 + Lantai 2 di atas Gambar 8 & 9
  const rebuildPallets3D = (currentSlots: AisleSlot3D[], viewMode: 'ALL' | 1 | 2) => {
    const group = palletVisualsRef.current;
    if (!group) return;

    while (group.children.length > 0) {
      const child = group.children[0];
      group.remove(child);
    }

    const palletWoodGeo = new THREE.BoxGeometry(1.15, 0.14, 1.35);
    const palletWoodMat = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      roughness: 0.75,
    });
    const boxGeo = new THREE.BoxGeometry(1.06, 0.72, 1.22);
    const sackGeo = new THREE.CylinderGeometry(0.46, 0.52, 0.76, 12);
    const sheetGeo = new THREE.BoxGeometry(1.18, 0.45, 1.35);
    const stripGeo = new THREE.BoxGeometry(1.08, 0.14, 1.24);
    const stripMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

    currentSlots.forEach((slot) => {
      if (viewMode === 1 && slot.floor === 2) return;

      const aisleX = AISLE_X_POSITIONS[slot.aisleNumber] ?? 0;
      const baseFloorY = slot.floor === 1 ? 0 : FLOOR_2_Y;
      const boxMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(slot.colorHex),
        roughness: 0.35,
        metalness: 0.05,
      });
      const whiteSackMat = new THREE.MeshStandardMaterial({
        color: 0xf8fafc,
        roughness: 0.6,
      });
      const cardboardSheetMat = new THREE.MeshStandardMaterial({
        color: 0xc28e5c,
        roughness: 0.65,
      });

      const isDimmed = viewMode === 2 && slot.floor === 1;
      if (isDimmed) {
        boxMat.transparent = true;
        boxMat.opacity = 0.2;
      }

      // Label Lorong di bagian depan masing-masing lorong
      const isFloorPalletOnly = slot.floor === 1 && slot.aisleNumber >= 4 && slot.aisleNumber <= 6;
      const labelY = isFloorPalletOnly
        ? 3.6
        : slot.floor === 1
        ? slot.hasMezzanineAbove
          ? 4.7
          : 6.3
        : FLOOR_2_Y + 5.2;

      const headerTitle =
        slot.floor === 1
          ? isFloorPalletOnly
            ? `LORONG ${slot.aisleNumber} • PALLET LANTAI`
            : `LORONG ${slot.aisleNumber} • ${slot.aisleName.toUpperCase()}`
          : `LANTAI 2 • MEZZANINE (LORONG ${slot.aisleNumber})`;

      const labelSprite = createBillboardLabel(
        headerTitle,
        `${slot.kategoriBarang} (${slot.occupiedPallets}/${slot.maxPallets} Palet)`,
        slot.colorHex,
        slot.floor === 1 ? '#ffffff' : '#f0fdf4',
        '#0f172a',
        slot.colorHex,
        5.8,
        1.55
      );
      labelSprite.position.set(aisleX, labelY, 3.8);
      group.add(labelSprite);

      // Penataan palet/barang:
      // Lorong 4 sampai 6 HANYA PALLET LANTAI (tanpa rak besi), bertumpuk langsung di atas lantai
      let placed = 0;
      const levels = isFloorPalletOnly ? 1 : slot.hasMezzanineAbove ? 3 : 4;
      const levelHeights = isFloorPalletOnly
        ? [0.12]
        : slot.hasMezzanineAbove
        ? [0.22, 1.55, 2.85]
        : [0.22, 1.62, 3.02, 4.42];

      const zOffsets = isFloorPalletOnly
        ? [-13.0, -11.0, -9.0, -7.0, -5.0, -3.0, -1.0, 1.0, 3.0]
        : [-12.0, -9.0, -6.0, -3.0, 0.0, 2.5];

      for (let lvl = 0; lvl < levels; lvl++) {
        for (let zIdx = 0; zIdx < zOffsets.length; zIdx++) {
          for (const side of [-1, 1]) {
            if (placed >= slot.occupiedPallets) break;

            const px = aisleX + side * 1.48;
            const py = baseFloorY + levelHeights[lvl];
            const pz = zOffsets[zIdx];

            const baseMesh = new THREE.Mesh(palletWoodGeo, palletWoodMat);
            baseMesh.position.set(px, py, pz);
            group.add(baseMesh);

            // Variasi bentuk barang sesuai karakteristik lorong:
            // Lorong 4..6 memiliki tumpukan bal/karung putih & lembaran sheet karton lipat
            if (
              slot.floor === 1 &&
              (slot.rackStyle === 'BULK_SACK_SHEET' ||
                (slot.rackStyle === 'MIXED_RACK_SACK' && side === 1))
            ) {
              if (slot.aisleNumber === 4 && side === 1) {
                // Tumpukan lembaran karton box lipat di Lorong 4 sisi kanan
                const sheetMesh = new THREE.Mesh(sheetGeo, cardboardSheetMat);
                sheetMesh.position.set(px, py + 0.35, pz);
                group.add(sheetMesh);
              } else {
                // Tumpukan karung/bal putih di Lorong 4 kiri, Lorong 5 & Lorong 6
                const sackMesh = new THREE.Mesh(sackGeo, whiteSackMat);
                sackMesh.position.set(px, py + 0.44, pz);
                group.add(sackMesh);
              }
            } else {
              const cargoMesh = new THREE.Mesh(boxGeo, boxMat);
              cargoMesh.position.set(px, py + 0.43, pz);
              cargoMesh.castShadow = true;
              group.add(cargoMesh);

              if (!isDimmed) {
                const stripMesh = new THREE.Mesh(stripGeo, stripMat);
                stripMesh.position.set(px, py + 0.46, pz);
                group.add(stripMesh);
              }
            }

            placed++;
          }
        }
      }
    });
  };

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 920;
    const height = 560;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf1f5f9);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(44, width / height, 0.1, 500);
    camera.position.set(0, 31, 44);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.target.set(0, 3, -1);
    controls.maxPolarAngle = Math.PI / 2 - 0.03;
    controls.minDistance = 12;
    controls.maxDistance = 95;
    controlsRef.current = controls;

    // Pencahayaan terang benderang
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.35);
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0xe2e8f0, 0.95);
    hemiLight.position.set(0, 40, 0);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.15);
    dirLight.position.set(22, 42, 28);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    scene.add(dirLight);

    // Lantai 1 (Utama)
    const floor1Geo = new THREE.PlaneGeometry(64, 44);
    const floor1Mat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.65,
    });
    const floor1Mesh = new THREE.Mesh(floor1Geo, floor1Mat);
    floor1Mesh.rotation.x = -Math.PI / 2;
    floor1Mesh.receiveShadow = true;
    scene.add(floor1Mesh);

    const grid1 = new THREE.GridHelper(64, 32, 0xcbd5e1, 0xe2e8f0);
    grid1.position.y = 0.02;
    scene.add(grid1);

    // Dinding Belakang & Samping Gudang
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.8,
      transparent: true,
      opacity: 0.55,
    });
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(64, 16, 0.35), wallMat);
    backWall.position.set(0, 8, -16.5);
    scene.add(backWall);

    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.35, 16, 36), wallMat);
    leftWall.position.set(-31.8, 8, 1.5);
    scene.add(leftWall);

    const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.35, 16, 36), wallMat);
    rightWall.position.set(31.8, 8, 1.5);
    scene.add(rightWall);

    // Rangka Baja Atap Oranye di atas Gambar 2 s/d Gambar 7 (Sisi Kiri-Tengah langsung atap sesuai foto)
    const roofTrussMat = new THREE.MeshStandardMaterial({
      color: 0xea580c,
      metalness: 0.4,
      roughness: 0.45,
    });
    for (const zTruss of [-14, -8, -2, 4]) {
      const trussBeam = new THREE.Mesh(new THREE.BoxGeometry(44, 0.22, 0.22), roofTrussMat);
      trussBeam.position.set(-9.5, 13.8, zTruss);
      scene.add(trussBeam);
    }

    // Group Lantai 2 (Mezzanine) — HANYA di atas Gambar 8 (Lorong 7) & Gambar 9 (Lorong 8) di sisi kanan!
    // X membentang dari X = 13.5 (batas kanan Gambar 7) sampai X = 28.5 (sisi paling kanan) -> lebar 15.0, pusat X = 21.0
    const floor2Group = new THREE.Group();
    floor2GroupRef.current = floor2Group;
    scene.add(floor2Group);

    const mezzWidth = 15.6;
    const mezzCenterX = 21.0; // Meliputi Lorong 7 (X=17.5) & Lorong 8 (X=24.5)
    const mezzDepth = 20.0;
    const mezzCenterZ = -5.5; // Dari Z = -15.5 s/d Z = 4.5

    const mezzFloorGeo = new THREE.BoxGeometry(mezzWidth, 0.32, mezzDepth);
    const mezzFloorMat = new THREE.MeshStandardMaterial({
      color: 0xdbeafe,
      transparent: true,
      opacity: 0.72,
      roughness: 0.4,
    });
    const mezzFloorMesh = new THREE.Mesh(mezzFloorGeo, mezzFloorMat);
    mezzFloorMesh.position.set(mezzCenterX, FLOOR_2_Y - 0.16, mezzCenterZ);
    floor2Group.add(mezzFloorMesh);

    // Balok Baja Oranye Penyangga Dek Lantai 2 (Sesuai Gambar 8 & Gambar 9)
    const orangeSteelMat = new THREE.MeshStandardMaterial({
      color: 0xea580c,
      metalness: 0.45,
      roughness: 0.35,
    });
    for (const zBeam of [-14.5, -10.5, -6.5, -2.5, 1.5, 4.3]) {
      const mainGirder = new THREE.Mesh(new THREE.BoxGeometry(mezzWidth, 0.38, 0.32), orangeSteelMat);
      mainGirder.position.set(mezzCenterX, FLOOR_2_Y - 0.36, zBeam);
      floor2Group.add(mainGirder);
    }

    // Tiang Kolom Baja Penyangga Lantai 2 di Batas Gambar 7 & Gambar 8 (X = 13.5) dan Sisi Kanan (X = 28.5)
    for (const xCol of [13.4, 21.0, 28.6]) {
      for (const zCol of [-14.5, -6.5, 4.3]) {
        const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.32, FLOOR_2_Y, 0.32), orangeSteelMat);
        pillar.position.set(xCol, FLOOR_2_Y / 2, zCol);
        floor2Group.add(pillar);
      }
    }

    // Pagar Pengaman Besi Oranye di Batas Kiri Lantai 2 (X = 13.4, terlihat dari Gambar 7) & Sisi Depan (Z = 4.4)
    const leftRailTop = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, mezzDepth), orangeSteelMat);
    leftRailTop.position.set(13.4, FLOOR_2_Y + 1.05, mezzCenterZ);
    floor2Group.add(leftRailTop);

    const leftRailMid = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, mezzDepth), orangeSteelMat);
    leftRailMid.position.set(13.4, FLOOR_2_Y + 0.55, mezzCenterZ);
    floor2Group.add(leftRailMid);

    // Pagar depan Lantai 2 (disisakan bukaan di depan Gambar 9 / X=24.5 untuk Tangga)
    const frontRailLeft = new THREE.Mesh(new THREE.BoxGeometry(9.5, 0.12, 0.12), orangeSteelMat);
    frontRailLeft.position.set(18.1, FLOOR_2_Y + 1.05, 4.4);
    floor2Group.add(frontRailLeft);

    const mezzBoundaryLabel = createBillboardLabel(
      'DEK LANTAI 2 (MEZZANINE LORONG 7 & 8)',
      'Batas Dek Mezzanine di atas Lorong 7 & Lorong 8',
      '#ea580c',
      '#fff7ed',
      '#9a3412',
      '#ea580c',
      7.2,
      1.7
    );
    mezzBoundaryLabel.position.set(21.0, FLOOR_2_Y + 1.6, 4.6);
    floor2Group.add(mezzBoundaryLabel);

    // TANGGA NAIK KE LANTAI 2 — Tepat di depan Lorong 8 (X = 24.5, Z = 4.5 s/d 10.2)
    const stairGroup = new THREE.Group();
    const stairMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.4, roughness: 0.5 });
    const stairRailMat = new THREE.MeshStandardMaterial({ color: 0xea580c, metalness: 0.4, roughness: 0.4 });
    const stairX = AISLE_X_POSITIONS[8]; // 24.5 (Depan Lorong 8)
    for (let s = 0; s < 14; s++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.16, 0.42), stairMat);
      const stepY = (s + 1) * (FLOOR_2_Y / 14);
      const stepZ = 10.2 - s * 0.41; // Naik dari depan (Z=10.2) menuju dek Lantai 2 di atas Lorong 8 (Z=4.5)
      step.position.set(stairX, stepY, stepZ);
      stairGroup.add(step);
    }
    // Handrail tangga kiri & kanan
    for (const side of [-1.05, 1.05]) {
      const postBottom = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.2, 0.1), stairRailMat);
      postBottom.position.set(stairX + side, 0.8, 10.2);
      stairGroup.add(postBottom);

      const postTop = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.2, 0.1), stairRailMat);
      postTop.position.set(stairX + side, FLOOR_2_Y + 0.6, 4.5);
      stairGroup.add(postTop);
    }
    const stairLabel = createBillboardLabel(
      'TANGGA LANTAI 2',
      'Akses Dek Mezzanine (Lorong 8)',
      '#ea580c',
      '#ffffff',
      '#0f172a',
      '#ea580c',
      4.8,
      1.35
    );
    stairLabel.position.set(stairX, 4.2, 9.2);
    stairGroup.add(stairLabel);
    scene.add(stairGroup);

    // Fungsi pembangun struktur Rak Besi per Lorong
    const uprightMatBlue = new THREE.MeshStandardMaterial({
      color: 0x1e3a8a,
      metalness: 0.4,
      roughness: 0.4,
    });
    const uprightMatGrey = new THREE.MeshStandardMaterial({
      color: 0x475569,
      metalness: 0.45,
      roughness: 0.45,
    });
    const beamMatOrange = new THREE.MeshStandardMaterial({
      color: 0xea580c,
      metalness: 0.3,
      roughness: 0.45,
    });

    const postGeoCache = new Map<number, THREE.BoxGeometry>();
    const getSharedPostGeo = (h: number) => {
      let geo = postGeoCache.get(h);
      if (!geo) {
        geo = new THREE.BoxGeometry(0.12, h, 0.12);
        postGeoCache.set(h, geo);
      }
      return geo;
    };
    const sharedBeamGeo = new THREE.BoxGeometry(0.08, 0.11, 17.5);

    const buildRackStructure = (
      targetGroup: THREE.Group,
      aisleX: number,
      baseY: number,
      rackHeight: number,
      levelsCount: number,
      useGreyFrame = false
    ) => {
      const frameMat = useGreyFrame ? uprightMatGrey : uprightMatBlue;
      const postGeo = getSharedPostGeo(rackHeight);
      const beamMat = useGreyFrame ? uprightMatGrey : beamMatOrange;

      for (const side of [-1, 1]) {
        const rackCenterX = aisleX + side * 1.48;
        const zPosts = [-13.5, -10.5, -7.5, -4.5, -1.5, 1.5, 3.8];

        for (const zPos of zPosts) {
          for (const depthOffset of [-0.52, 0.52]) {
            const post = new THREE.Mesh(postGeo, frameMat);
            post.position.set(rackCenterX + depthOffset, baseY + rackHeight / 2, zPos);
            targetGroup.add(post);
          }
        }

        const beamHeights =
          levelsCount === 3
            ? [0.15, 1.48, 2.78, 4.05]
            : [0.15, 1.55, 2.95, 4.35, 5.65];

        for (const bh of beamHeights) {
          for (const depthOffset of [-0.52, 0.52]) {
            const beam = new THREE.Mesh(sharedBeamGeo, beamMat);
            beam.position.set(rackCenterX + depthOffset, baseY + bh, -4.85);
            targetGroup.add(beam);
          }
        }
      }
    };

    // Bangun 8 Lorong Lantai 1:
    // PENTING: Lorong 4 sampai 6 TIDAK PERLU RAK, HANYA PERLU PALLET LANTAI
    WAREHOUSE_PHOTO_POSITIONS.forEach((pos) => {
      const ax = AISLE_X_POSITIONS[pos.aisleNumber];

      // Jika Lorong 4, 5, atau 6: Area terbuka khusus Pallet Lantai (tanpa tiang & balok rak besi)
      if (pos.aisleNumber >= 4 && pos.aisleNumber <= 6) {
        // Visualisasi garis batas area staging pallet kuning di lantai
        const stagingZoneGeo = new THREE.PlaneGeometry(3.6, 17.6);
        const stagingZoneMat = new THREE.MeshBasicMaterial({
          color: 0xfef08a,
          opacity: 0.18,
          transparent: true,
        });
        const stagingZone = new THREE.Mesh(stagingZoneGeo, stagingZoneMat);
        stagingZone.rotation.x = -Math.PI / 2;
        stagingZone.position.set(ax, 0.02, -4.8);
        scene.add(stagingZone);

        // Garis batas strip kuning/amber di ujung depan dan belakang zona pallet lantai
        const borderLineGeo = new THREE.PlaneGeometry(3.6, 0.14);
        const borderLineMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
        for (const bz of [-13.6, 3.9]) {
          const bl = new THREE.Mesh(borderLineGeo, borderLineMat);
          bl.rotation.x = -Math.PI / 2;
          bl.position.set(ax, 0.03, bz);
          scene.add(bl);
        }

        // Garis pemisah sisi kiri dan kanan pallet
        const centerLineGeo = new THREE.PlaneGeometry(0.08, 17.5);
        const centerLineMat = new THREE.MeshBasicMaterial({ color: 0xfde047 });
        const cl = new THREE.Mesh(centerLineGeo, centerLineMat);
        cl.rotation.x = -Math.PI / 2;
        cl.position.set(ax, 0.025, -4.8);
        scene.add(cl);

        return; // Tidak membangun tiang dan balok rak besi untuk lorong 4, 5, 6
      }

      const isUnderMezz = pos.hasFloor2Above; // Lorong 7 & Lorong 8 berada di bawah Lantai 2
      const rackHeight = isUnderMezz ? 4.3 : 5.8;
      const levelsCount = isUnderMezz ? 3 : 4;
      const useGrey = pos.aisleNumber >= 7; // Lorong 7 & 8 menggunakan rak besi abu-abu di bawah mezzanine
      buildRackStructure(scene as unknown as THREE.Group, ax, 0, rackHeight, levelsCount, useGrey);
    });

    // Bangun Rak Lantai 2 (Hanya di atas Lorong 7 dan Lorong 8)
    [7, 8].forEach((aisleNum) => {
      const ax = AISLE_X_POSITIONS[aisleNum];
      buildRackStructure(floor2Group, ax, FLOOR_2_Y, 4.4, 3, false);
    });

    // =========================================================================
    // AREA DEPAN GUDANG (Urutan Kiri ke Kanan Sesuai Instruksi User):
    // 1. Depan Gambar 2: Gudang / Rak Bahan Makan (X = -24.5)
    // 2. Pintu Ram 3 (Paling Kiri): X = -15.0
    // 3. Ruang PO: X = -5.5
    // 4. Pintu Ram 2 (Tengah): X = 4.0
    // 5. Gudang / Rak Bahan Kue: X = 13.5
    // 6. Pintu Ram 1 (Paling Kanan - Bongkar Armada Supplier): X = 23.5
    // =========================================================================

    // 1. Gudang / Rak Bahan Makan (Di depan Gambar 2, X = -24.5, Z = 11.8)
    const buildFrontStorageZone = (
      xPos: number,
      title: string,
      subtitle: string,
      themeColorHex: number,
      badgeBorderHex: string
    ) => {
      const zoneGrp = new THREE.Group();
      const basePad = new THREE.Mesh(
        new THREE.BoxGeometry(6.8, 0.12, 4.8),
        new THREE.MeshStandardMaterial({ color: themeColorHex, transparent: true, opacity: 0.18 })
      );
      basePad.position.set(xPos, 0.06, 11.8);
      zoneGrp.add(basePad);

      // Rak khusus 2 baris di zona depan
      const miniRackMat = new THREE.MeshStandardMaterial({ color: themeColorHex, roughness: 0.4 });
      const miniCargoMat = new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.5 });
      for (const rZ of [10.4, 13.0]) {
        const shelfFrame = new THREE.Mesh(new THREE.BoxGeometry(5.6, 2.6, 0.9), miniRackMat);
        shelfFrame.position.set(xPos, 1.3, rZ);
        zoneGrp.add(shelfFrame);

        for (let b = -2; b <= 2; b += 1.3) {
          const itemBox = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.65, 0.75), miniCargoMat);
          itemBox.position.set(xPos + b, 2.95, rZ);
          zoneGrp.add(itemBox);
        }
      }

      const zoneSprite = createBillboardLabel(
        title,
        subtitle,
        badgeBorderHex,
        '#ffffff',
        '#0f172a',
        badgeBorderHex,
        6.0,
        1.55
      );
      zoneSprite.position.set(xPos, 4.5, 12.0);
      zoneGrp.add(zoneSprite);
      scene.add(zoneGrp);
    };

    // 1. Depan Gambar 2: Gudang / Rak Bahan Makan
    buildFrontStorageZone(
      FRONT_ZONE_X.BAHAN_MAKAN,
      'GUDANG / RAK BAHAN MAKAN',
      'Di Depan Gambar 2 (Paling Kiri)',
      0x0d9488,
      '#0d9488'
    );

    // 3. Ruang PO (Di antara Pintu Ram 3 dan Pintu Ram 2, X = -5.5, Z = 12.2)
    const poOfficeGrp = new THREE.Group();
    const poBody = new THREE.Mesh(
      new THREE.BoxGeometry(6.4, 3.6, 4.6),
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3 })
    );
    poBody.position.set(FRONT_ZONE_X.RUANG_PO, 1.8, 12.2);
    poOfficeGrp.add(poBody);

    const poRoof = new THREE.Mesh(
      new THREE.BoxGeometry(6.8, 0.28, 5.0),
      new THREE.MeshStandardMaterial({ color: 0x1e40af, roughness: 0.4 })
    );
    poRoof.position.set(FRONT_ZONE_X.RUANG_PO, 3.74, 12.2);
    poOfficeGrp.add(poRoof);

    const poGlass = new THREE.Mesh(
      new THREE.BoxGeometry(5.2, 1.8, 4.72),
      new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.45,
        roughness: 0.1,
      })
    );
    poGlass.position.set(FRONT_ZONE_X.RUANG_PO, 2.0, 12.2);
    poOfficeGrp.add(poGlass);

    const poLabel = createBillboardLabel(
      'RUANG PO (ADMIN GUDANG)',
      'Antara Pintu Ram 3 & Pintu Ram 2',
      '#1e40af',
      '#eff6ff',
      '#1e3a8a',
      '#1d4ed8',
      5.8,
      1.55
    );
    poLabel.position.set(FRONT_ZONE_X.RUANG_PO, 5.0, 12.4);
    poOfficeGrp.add(poLabel);
    scene.add(poOfficeGrp);

    // 5. Gudang / Rak Bahan Kue (Di antara Pintu Ram 2 dan Pintu Ram 1, X = 13.5, Z = 11.8)
    buildFrontStorageZone(
      FRONT_ZONE_X.BAHAN_KUE,
      'GUDANG / RAK BAHAN KUE',
      'Antara Pintu Ram 2 & Pintu Ram 1',
      0xd97706,
      '#d97706'
    );

    // 2, 4, 6. Pintu Ram 3 (Paling Kiri), Pintu Ram 2 (Tengah), Pintu Ram 1 (Paling Kanan - Bongkar Supplier)
    const ramDefinitions: Array<{
      ram: 1 | 2 | 3;
      x: number;
      title: string;
      subtitle: string;
      color: number;
      hex: string;
    }> = [
      {
        ram: 3,
        x: FRONT_ZONE_X.RAM_3,
        title: 'PINTU RAM 3 (KIRI)',
        subtitle: 'MUAT BARANG KELUAR (OUTBOUND)',
        color: 0xd97706,
        hex: '#d97706',
      },
      {
        ram: 2,
        x: FRONT_ZONE_X.RAM_2,
        title: 'PINTU RAM 2 (TENGAH)',
        subtitle: 'MUAT BARANG KELUAR (OUTBOUND)',
        color: 0x2563eb,
        hex: '#2563eb',
      },
      {
        ram: 1,
        x: FRONT_ZONE_X.RAM_1,
        title: 'PINTU RAM 1 (KANAN)',
        subtitle: 'BONGKAR BARANG ARMADA SUPPLIER',
        color: 0x059669,
        hex: '#059669',
      },
    ];

    ramDefinitions.forEach((cfg) => {
      const gateMat = new THREE.MeshStandardMaterial({
        color: cfg.color,
        roughness: 0.3,
        metalness: 0.2,
      });

      const leftPillar = new THREE.Mesh(new THREE.BoxGeometry(0.6, 5.0, 0.6), gateMat);
      leftPillar.position.set(cfg.x - 2.6, 2.5, 13.8);
      scene.add(leftPillar);

      const rightPillar = new THREE.Mesh(new THREE.BoxGeometry(0.6, 5.0, 0.6), gateMat);
      rightPillar.position.set(cfg.x + 2.6, 2.5, 13.8);
      scene.add(rightPillar);

      const topHeader = new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.85, 0.75), gateMat);
      topHeader.position.set(cfg.x, 5.1, 13.8);
      scene.add(topHeader);

      const ramSprite = createBillboardLabel(
        cfg.title,
        cfg.subtitle,
        cfg.hex,
        '#ffffff',
        '#0f172a',
        cfg.hex,
        6.0,
        1.6
      );
      ramSprite.position.set(cfg.x, 6.7, 13.8);
      scene.add(ramSprite);

      // Visual Truk Box Parkir di masing-masing Pintu Ram
      const truckGroup = new THREE.Group();
      const boxMesh = new THREE.Mesh(
        new THREE.BoxGeometry(3.1, 3.0, 6.0),
        new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35 })
      );
      boxMesh.position.set(0, 2.0, 0);
      boxMesh.castShadow = true;
      truckGroup.add(boxMesh);

      const stripeMesh = new THREE.Mesh(
        new THREE.BoxGeometry(3.16, 0.45, 6.04),
        gateMat
      );
      stripeMesh.position.set(0, 2.1, 0);
      truckGroup.add(stripeMesh);

      const cabMesh = new THREE.Mesh(
        new THREE.BoxGeometry(2.8, 2.2, 2.0),
        gateMat
      );
      cabMesh.position.set(0, 1.6, 4.1);
      truckGroup.add(cabMesh);

      truckGroup.position.set(cfg.x, 0, 18.0);
      scene.add(truckGroup);
    });

    // Jalur Kuning Lalu Lintas Forklift di Depan Lorong (Z = 7.2)
    const pathLineGeo = new THREE.PlaneGeometry(58, 0.25);
    const pathLineMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
    const pathLine1 = new THREE.Mesh(pathLineGeo, pathLineMat);
    pathLine1.rotation.x = -Math.PI / 2;
    pathLine1.position.set(0, 0.04, 6.4);
    scene.add(pathLine1);

    const pathLine2 = new THREE.Mesh(pathLineGeo, pathLineMat);
    pathLine2.rotation.x = -Math.PI / 2;
    pathLine2.position.set(0, 0.04, 8.8);
    scene.add(pathLine2);

    // Group Palet Dinamis
    const palletGroup = new THREE.Group();
    palletVisualsRef.current = palletGroup;
    scene.add(palletGroup);

    rebuildPallets3D(slotsRef.current, floorViewRef.current);

    // Forklift Animasi 3D
    const forkliftGroup = new THREE.Group();
    const fkBody = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 1.1, 2.0),
      new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.3 })
    );
    fkBody.position.set(0, 0.7, 0);
    forkliftGroup.add(fkBody);

    const fkCab = new THREE.Mesh(
      new THREE.BoxGeometry(1.25, 1.1, 1.2),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, wireframe: true })
    );
    fkCab.position.set(0, 1.75, 0.15);
    forkliftGroup.add(fkCab);

    const fkCargo = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 0.85, 1.1),
      new THREE.MeshStandardMaterial({ color: 0x10b981 })
    );
    fkCargo.position.set(0, 0.85, -1.3);
    forkliftGroup.add(fkCargo);

    forkliftGroup.position.set(FRONT_ZONE_X.RAM_1, 0, 7.6);
    scene.add(forkliftGroup);

    const routeLineMat = new THREE.LineBasicMaterial({ color: 0x059669, linewidth: 3 });
    const routeLineGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(FRONT_ZONE_X.RAM_1, 0.12, 13.0),
      new THREE.Vector3(FRONT_ZONE_X.RAM_1, 0.12, 7.6),
    ]);
    const routeLine = new THREE.Line(routeLineGeo, routeLineMat);
    scene.add(routeLine);

    let animFrameId = 0;
    const animate = () => {
      if (!isVisibleRef.current) return;
      animFrameId = requestAnimationFrame(animate);
      controls.update();

      const task = activeTaskRef.current;
      if (task) {
        const ramX = RAM_X_POSITIONS[task.ramNumber];
        const aisleX = AISLE_X_POSITIONS[task.targetAisle] ?? 0;
        const targetFloorY = task.floor === 1 ? 0 : FLOOR_2_Y;

        const p1 = new THREE.Vector3(ramX, 0, 13.2);
        const p2 = new THREE.Vector3(ramX, 0, 7.6);
        const p3 = new THREE.Vector3(aisleX, targetFloorY, 7.6);
        const p4 = new THREE.Vector3(aisleX, targetFloorY, -4.5);

        const points =
          task.operation === 'PENAMBAHAN' ? [p1, p2, p3, p4] : [p4, p3, p2, p1];

        routeLine.geometry.setFromPoints(
          points.map((pt) => new THREE.Vector3(pt.x, pt.y + 0.15, pt.z))
        );
        routeLineMat.color.set(task.operation === 'PENAMBAHAN' ? 0x059669 : 0x2563eb);
        (fkCargo.material as THREE.MeshStandardMaterial).color.set(task.colorHex);
        fkCargo.visible = true;

        const t = Math.min(1, Math.max(0, task.progress / 100));
        let pos = new THREE.Vector3();
        if (t < 0.33) {
          pos.lerpVectors(points[0], points[1], t / 0.33);
        } else if (t < 0.66) {
          pos.lerpVectors(points[1], points[2], (t - 0.33) / 0.33);
        } else {
          pos.lerpVectors(points[2], points[3], (t - 0.66) / 0.34);
        }

        forkliftGroup.position.copy(pos);
      } else {
        fkCargo.visible = false;
      }

      renderer.render(scene, camera);
    };
    if (isVisibleRef.current) {
      animate();
    }

    const handleResize = () => {
      if (!container) return;
      const newW = container.clientWidth || 920;
      const newH = container.clientHeight || 560;
      camera.aspect = newW / newH;
      camera.updateProjectionMatrix();
      renderer.setSize(newW, newH);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animFrameId);
      renderer.dispose();
    };
  }, []);

  // Update tampilan 3D setiap kali data slot atau filter lantai berubah
  useEffect(() => {
    rebuildPallets3D(slots, floorViewFilter);
    if (floor2GroupRef.current) {
      floor2GroupRef.current.visible = floorViewFilter !== 1;
    }
  }, [slots, floorViewFilter]);

  // Fungsi Kustomisasi Langsung (+/- Palet pada Lorong & Lantai)
  const handleCustomizeSlotStock = (slotId: string, deltaPallets: number) => {
    const targetSlot = slots.find((s) => s.id === slotId);
    if (!targetSlot) return;

    const newPallets = Math.min(
      targetSlot.maxPallets,
      Math.max(0, targetSlot.occupiedPallets + deltaPallets)
    );
    const actualDelta = newPallets - targetSlot.occupiedPallets;
    if (actualDelta === 0) return;

    const qtyDelta = Math.abs(actualDelta) * 250;
    const isAddition = actualDelta > 0;
    const ramUsed: 1 | 2 | 3 = isAddition ? 1 : 2;

    setSlots((prev) =>
      prev.map((s) => {
        if (s.id !== slotId) return s;
        return {
          ...s,
          occupiedPallets: newPallets,
          stockQty: isAddition
            ? s.stockQty + qtyDelta
            : Math.max(0, s.stockQty - qtyDelta),
        };
      })
    );

    const nowStr = new Date().toTimeString().slice(0, 8);
    setSimLogs((prev) => [
      {
        id: `CUST-${Date.now()}`,
        timestamp: nowStr,
        operation: isAddition ? 'PENAMBAHAN' : 'PENGURANGAN',
        ramNumber: ramUsed,
        floor: targetSlot.floor,
        aisleNumber: targetSlot.aisleNumber,
        kategoriBarang: targetSlot.kategoriBarang,
        qty: qtyDelta,
        palletsDelta: Math.abs(actualDelta),
        status: isAddition
          ? `Kustomisasi +${actualDelta} Palet (${targetSlot.kategoriBarang}) pada Lantai ${targetSlot.floor} ${targetSlot.aisleName}`
          : `Kustomisasi ${actualDelta} Palet (${targetSlot.kategoriBarang}) pada Lantai ${targetSlot.floor} ${targetSlot.aisleName}`,
      },
      ...prev.slice(0, 14),
    ]);
  };

  // Fungsi Ubah Kategori Barang pada Lorong tertentu
  const handleCustomizeSlotCategory = (slotId: string, newKategori: string) => {
    const matchedMaster = masterCategories.find((c) => c.kategori === newKategori);
    setSlots((prev) =>
      prev.map((s) => {
        if (s.id !== slotId) return s;
        return {
          ...s,
          kategoriBarang: newKategori,
          satuan: matchedMaster?.satuan || s.satuan,
        };
      })
    );
  };

  // Jalankan Animasi Forklift Penambahan / Pengurangan
  const handleStartSimulation = () => {
    if (activeTask) return;

    const targetSlot = slots.find(
      (s) => s.floor === selectedFloor && s.aisleNumber === selectedAisle
    );
    const colorHex = targetSlot?.colorHex || '#2563eb';
    const ramToUse: 1 | 2 | 3 =
      simMode === 'PENAMBAHAN' ? 1 : selectedRam === 1 ? 2 : selectedRam;

    setActiveTask({
      operation: simMode,
      ramNumber: ramToUse,
      floor: selectedFloor,
      targetAisle: selectedAisle,
      colorHex,
      progress: 0,
    });

    let currentProgress = 0;
    const interval = setInterval(() => {
      currentProgress += 4;
      if (currentProgress >= 100) {
        clearInterval(interval);
        setActiveTask(null);

        setSlots((prev) =>
          prev.map((slot) => {
            if (slot.floor !== selectedFloor || slot.aisleNumber !== selectedAisle) {
              return slot;
            }
            const nextPallets =
              simMode === 'PENAMBAHAN'
                ? Math.min(slot.maxPallets, slot.occupiedPallets + simPallets)
                : Math.max(0, slot.occupiedPallets - simPallets);
            const nextQty =
              simMode === 'PENAMBAHAN'
                ? slot.stockQty + simQty
                : Math.max(0, slot.stockQty - simQty);
            return {
              ...slot,
              kategoriBarang: selectedKategori,
              occupiedPallets: nextPallets,
              stockQty: nextQty,
            };
          })
        );

        const nowStr = new Date().toTimeString().slice(0, 8);
        setSimLogs((prev) => [
          {
            id: `SIM-${Date.now()}`,
            timestamp: nowStr,
            operation: simMode,
            ramNumber: ramToUse,
            floor: selectedFloor,
            aisleNumber: selectedAisle,
            kategoriBarang: selectedKategori,
            qty: simQty,
            palletsDelta: simPallets,
            status:
              simMode === 'PENAMBAHAN'
                ? `Bongkar Supplier dari Pintu Ram 1 (Kanan) -> Lantai ${selectedFloor} Lorong ${selectedAisle} (+${simPallets} Palet)`
                : `Muat dari Lantai ${selectedFloor} Lorong ${selectedAisle} -> Pintu Ram ${ramToUse} (-${simPallets} Palet)`,
          },
          ...prev.slice(0, 14),
        ]);
      } else {
        setActiveTask((prev) => (prev ? { ...prev, progress: currentProgress } : null));
      }
    }, 55);
  };

  const totalPallets = slots.reduce((acc, s) => acc + s.occupiedPallets, 0);
  const maxTotalPallets = slots.reduce((acc, s) => acc + s.maxPallets, 0);
  const overallOccupancy = Math.round((totalPallets / maxTotalPallets) * 100);

  const visibleSlots = useMemo(() => {
    if (floorViewFilter === 'ALL') return slots;
    return slots.filter((s) => s.floor === floorViewFilter);
  }, [slots, floorViewFilter]);

  const currentSelectedSlot = useMemo(
    () => slots.find((s) => s.floor === selectedFloor && s.aisleNumber === selectedAisle),
    [slots, selectedFloor, selectedAisle]
  );

  const selectedPhotoInfo = useMemo(
    () =>
      WAREHOUSE_PHOTO_POSITIONS.find((p) => p.aisleNumber === selectedAisle) ||
      WAREHOUSE_PHOTO_POSITIONS[0],
    [selectedAisle]
  );

  const availableAislesForSelectedFloor = selectedFloor === 1 ? [1, 2, 3, 4, 5, 6, 7, 8] : [7, 8];

  return (
    <div className="space-y-4">
      {/* Top Summary Banner: Struktur Aktual Gudang (Lorong 1 s/d Lorong 8 + Area Depan) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Box className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-black text-slate-900">
                  Simulasi 3D Denah Rak &amp; Staging Pallet Gudang
                </h3>
                <span className="px-2.5 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 text-[11px] font-extrabold">
                  8 Lorong Distribusi (Lorong 4&ndash;6 Pallet Lantai &bull; Lantai 2 Mezzanine)
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                <strong>Pintu Ram 3</strong> di paling kiri, <strong>Pintu Ram 2</strong> di tengah, dan{' '}
                <strong>Pintu Ram 1</strong> di sebelah paling kanan (bongkar armada supplier).{' '}
                <strong>Lantai 2</strong> berada di atas Lorong 7 &amp; 8 dengan <strong>Tangga</strong> di depan Lorong 8.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowPhotoModal((v) => !v)}
              className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer transition"
            >
              <Camera className="w-3.5 h-3.5 text-amber-700" />
              <span>{showPhotoModal ? 'Tutup Galeri Foto Lorong' : 'Lihat 8 Foto Dokumentasi Lorong'}</span>
            </button>
            <div className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
              <span className="text-slate-500 font-semibold">Okupansi Total: </span>
              <strong className="text-slate-900 font-black">
                {totalPallets}/{maxTotalPallets} Palet ({overallOccupancy}%)
              </strong>
            </div>
          </div>
        </div>

        {/* Diagram Skematik Urutan Posisi Aktual (Kiri ke Kanan) */}
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/90 space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-blue-600" />
              <span>Peta Orientasi Gudang (Urutan Sisi Kiri ke Kanan — Klik Lorong untuk Fokus Kamera 3D)</span>
            </span>
            <span className="text-[11px] font-bold text-orange-700 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-md">
              Lantai 2 berupa dek mezzanine di atas Lorong 7 &amp; Lorong 8 (Sisi Kanan)
            </span>
          </div>

          {/* Baris Belakang/Tengah: 8 Lorong (Lorong 1 s/d Lorong 8) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-1.5">
            {WAREHOUSE_PHOTO_POSITIONS.map((pos) => {
              const isSelected = selectedAisle === pos.aisleNumber;
              const isFloorPallet = pos.aisleNumber >= 4 && pos.aisleNumber <= 6;
              return (
                <button
                  key={pos.aisleNumber}
                  type="button"
                  onClick={() => {
                    setSelectedAisle(pos.aisleNumber);
                    if (selectedFloor === 2 && pos.aisleNumber < 7) {
                      setSelectedFloor(1);
                    }
                    focusCameraOnSection(pos.aisleNumber);
                  }}
                  className={`p-2 rounded-lg border text-left transition cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'bg-blue-600 text-white border-blue-700 shadow-xs'
                      : pos.hasFloor2Above
                      ? 'bg-orange-50/80 hover:bg-orange-100/80 text-slate-900 border-orange-300'
                      : isFloorPallet
                      ? 'bg-amber-50/80 hover:bg-amber-100/80 text-slate-900 border-amber-300'
                      : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-200'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[10px] font-black uppercase">
                        Lorong {pos.aisleNumber}
                      </span>
                      {pos.hasFloor2Above ? (
                        <span
                          className={`text-[9px] font-black px-1.5 py-0.2 rounded ${
                            isSelected
                              ? 'bg-amber-300 text-slate-950'
                              : 'bg-orange-200 text-orange-950'
                          }`}
                        >
                          + Lantai 2
                        </span>
                      ) : isFloorPallet ? (
                        <span
                          className={`text-[9px] font-black px-1.5 py-0.2 rounded ${
                            isSelected
                              ? 'bg-amber-200 text-slate-950'
                              : 'bg-amber-200 text-amber-950'
                          }`}
                        >
                          Pallet
                        </span>
                      ) : null}
                    </div>
                    <div
                      className={`text-[11px] font-extrabold mt-0.5 ${
                        isSelected ? 'text-white' : 'text-blue-700'
                      }`}
                    >
                      {pos.photoLabel.split('(')[0].trim()}
                    </div>
                  </div>
                  <div
                    className={`text-[10px] mt-1 line-clamp-1 ${
                      isSelected ? 'text-blue-100' : 'text-slate-500'
                    }`}
                  >
                    {pos.aisleNumber === 1
                      ? 'Paling Kiri'
                      : isFloorPallet
                      ? 'Pallet Lantai'
                      : pos.aisleNumber === 8
                      ? 'Paling Kanan + Tangga'
                      : pos.aisleNumber === 7
                      ? 'Bawah Mezzanine'
                      : 'Rak Tinggi'}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Baris Depan: Urutan Area Depan Gudang dari Kiri ke Kanan */}
          <div className="pt-1">
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1.5">
              <Building2 className="w-3 h-3 text-emerald-600" />
              <span>Area Depan Gudang (Urutan Sisi Kiri ke Kanan):</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-1.5 text-[11px]">
              <div className="p-2 rounded-lg bg-teal-50 border border-teal-200 text-teal-950 font-bold">
                <div className="text-[9px] font-black uppercase text-teal-700">1. Posisi Kiri</div>
                <div>Gudang / Rak Bahan Makan</div>
              </div>
              <div className="p-2 rounded-lg bg-amber-50 border border-amber-300 text-amber-950 font-bold">
                <div className="text-[9px] font-black uppercase text-amber-700">2. Paling Kiri</div>
                <div>Pintu Ram 3 (Muat Keluar)</div>
              </div>
              <div className="p-2 rounded-lg bg-blue-50 border border-blue-200 text-blue-950 font-bold">
                <div className="text-[9px] font-black uppercase text-blue-700">3. Antara Ram 3 &amp; 2</div>
                <div>Ruang PO (Purchase Order)</div>
              </div>
              <div className="p-2 rounded-lg bg-indigo-50 border border-indigo-300 text-indigo-950 font-bold">
                <div className="text-[9px] font-black uppercase text-indigo-700">4. Posisi Tengah</div>
                <div>Pintu Ram 2 (Muat Keluar)</div>
              </div>
              <div className="p-2 rounded-lg bg-orange-50 border border-orange-200 text-orange-950 font-bold">
                <div className="text-[9px] font-black uppercase text-orange-700">5. Kanan Ram 2</div>
                <div>Gudang / Rak Bahan Kue</div>
              </div>
              <div className="p-2 rounded-lg bg-slate-100 border border-slate-300 text-slate-900 font-bold">
                <div className="text-[9px] font-black uppercase text-slate-600">6. Depan Lorong 8</div>
                <div>Tangga Naik Lantai 2</div>
              </div>
              <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-300 text-emerald-950 font-bold">
                <div className="text-[9px] font-black uppercase text-emerald-700">7. Paling Kanan</div>
                <div>Pintu Ram 1 (Bongkar Supplier)</div>
              </div>
            </div>
          </div>
        </div>

        {/* Panel Galeri Foto Aktual Lorong Gudang */}
        {showPhotoModal && (
          <div className="p-3.5 rounded-2xl bg-slate-900 text-white space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-amber-400">
                  Referensi Foto Fisik Gudang (Urutan Sisi Kiri ke Kanan)
                </h4>
                <p className="text-[11px] text-slate-300">
                  Klik salah satu kartu foto di bawah untuk memfokuskan kamera 3D langsung ke lorong tersebut.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPhotoModal(false)}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 cursor-pointer"
              >
                Tutup
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
              {WAREHOUSE_PHOTO_POSITIONS.map((pos) => (
                <div
                  key={pos.aisleNumber}
                  onClick={() => {
                    setSelectedAisle(pos.aisleNumber);
                    focusCameraOnSection(pos.aisleNumber);
                  }}
                  className={`rounded-xl overflow-hidden border cursor-pointer transition flex flex-col ${
                    selectedAisle === pos.aisleNumber
                      ? 'border-amber-400 ring-2 ring-amber-400/40 bg-slate-800'
                      : 'border-slate-700 bg-slate-800/70 hover:border-slate-500'
                  }`}
                >
                  <div className="h-28 w-full bg-slate-950 overflow-hidden relative">
                    <img
                      src={pos.photoUrl}
                      alt={pos.title}
                      onError={(e) => {
                        const target = e.currentTarget;
                        if (target.src !== pos.fallbackUrl) {
                          target.src = pos.fallbackUrl;
                        }
                      }}
                      className="w-full h-full object-cover"
                    />
                    <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-slate-950/85 text-[10px] font-black text-amber-300">
                      Lorong {pos.aisleNumber}
                    </span>
                    {pos.hasFloor2Above && (
                      <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-orange-600 text-[9px] font-black text-white">
                        Ada Lantai 2
                      </span>
                    )}
                  </div>
                  <div className="p-2 text-[10px] space-y-0.5">
                    <div className="font-black text-white">{pos.photoLabel}</div>
                    <div className="text-slate-300 line-clamp-2">{pos.frontFeature}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Main Grid: 3D Viewport (Left 8 cols) + Customization & Simulation Controls (Right 4 cols) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        {/* Left Column: 3D Viewport */}
        <div className="xl:col-span-8 flex flex-col gap-3">
          <div
            ref={fullscreenWrapperRef}
            className={
              isFullscreen
                ? 'fixed inset-0 z-[99999] bg-slate-900 flex flex-col w-screen h-screen p-3 overflow-hidden'
                : 'bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs'
            }
          >
            {/* 3D Viewport Header Bar */}
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-600 text-white text-xs font-extrabold">
                  <Layers className="w-3.5 h-3.5" />
                  <span>Filter Lantai 3D:</span>
                </span>
                <div className="inline-flex rounded-xl bg-slate-200/80 p-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setFloorViewFilter('ALL');
                      focusCameraOnSection('OVERVIEW');
                    }}
                    className={`px-3 py-1 rounded-lg text-xs font-extrabold transition cursor-pointer ${
                      floorViewFilter === 'ALL'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Semua Lantai (1 &amp; 2)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFloorViewFilter(1);
                      setSelectedFloor(1);
                      focusCameraOnSection('OVERVIEW');
                    }}
                    className={`px-3 py-1 rounded-lg text-xs font-extrabold transition cursor-pointer ${
                      floorViewFilter === 1
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Lantai 1 (Lorong 1 &ndash; 8)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFloorViewFilter(2);
                      setSelectedFloor(2);
                      if (selectedAisle < 7) setSelectedAisle(7);
                      focusCameraOnSection('FLOOR_2');
                    }}
                    className={`px-3 py-1 rounded-lg text-xs font-extrabold transition cursor-pointer ${
                      floorViewFilter === 2
                        ? 'bg-orange-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Lantai 2 (Dek Mezzanine Lorong 7 &amp; 8)
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => focusCameraOnSection('FRONT_DOORS')}
                  className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Truck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Area Depan &amp; Ram 3-2-1</span>
                </button>
                <button
                  type="button"
                  onClick={() => focusCameraOnSection('FLOOR_2')}
                  className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5 text-orange-600" />
                  <span>Fokus Lantai 2 &amp; Tangga</span>
                </button>
                <button
                  type="button"
                  onClick={() => focusCameraOnSection('OVERVIEW')}
                  className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-blue-600" />
                  <span>Reset Kamera</span>
                </button>
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold flex items-center gap-1 cursor-pointer transition shadow-2xs"
                  title={isFullscreen ? 'Keluar Layar Penuh' : 'Tampilkan Layar Penuh'}
                >
                  {isFullscreen ? (
                    <>
                      <Minimize2 className="w-3.5 h-3.5" />
                      <span>Keluar Fullscreen</span>
                    </>
                  ) : (
                    <>
                      <Maximize2 className="w-3.5 h-3.5" />
                      <span>Layar Penuh (Fullscreen)</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Three.js Canvas Mount */}
            <div className={isFullscreen ? 'relative flex-1 w-full min-h-0 bg-slate-950 rounded-xl overflow-hidden' : 'relative'}>
              <div ref={mountRef} className={isFullscreen ? 'w-full h-full' : 'w-full h-[560px] bg-slate-100'} />

              {/* Floating Fullscreen Toggle Button on Canvas */}
              <button
                type="button"
                onClick={toggleFullscreen}
                className="absolute top-3 right-3 px-3 py-1.5 rounded-xl bg-slate-900/85 hover:bg-slate-900 text-white border border-slate-700 backdrop-blur-md text-xs font-bold flex items-center gap-1.5 shadow-lg transition cursor-pointer z-10"
              >
                {isFullscreen ? (
                  <>
                    <Minimize2 className="w-4 h-4 text-amber-400" />
                    <span>Keluar Fullscreen</span>
                  </>
                ) : (
                  <>
                    <Maximize2 className="w-4 h-4 text-blue-400" />
                    <span>Layar Penuh</span>
                  </>
                )}
              </button>

              {/* Floating Active Task Progress */}
              {activeTask && (
                <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-xs border border-slate-300 rounded-xl px-3.5 py-2.5 shadow-md flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-black text-xs">
                    {activeTask.progress}%
                  </div>
                  <div className="text-xs">
                    <div className="font-black text-slate-900">
                      {activeTask.operation === 'PENAMBAHAN'
                        ? `Bongkar Supplier: Pintu Ram 1 (Kanan) -> Lantai ${activeTask.floor} Lorong ${activeTask.targetAisle}`
                        : `Muat Armada: Lantai ${activeTask.floor} Lorong ${activeTask.targetAisle} -> Pintu Ram ${activeTask.ramNumber}`}
                    </div>
                    <div className="text-slate-600 font-semibold">
                      Forklift sedang bergerak di jalur gudang...
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Legend Bar */}
            <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex flex-wrap items-center gap-3 font-bold text-slate-700">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-amber-600 inline-block" />
                  <span>Pintu Ram 3 (Paling Kiri: Muat)</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-blue-600 inline-block" />
                  <span>Pintu Ram 2 (Tengah: Muat)</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-emerald-600 inline-block" />
                  <span>Pintu Ram 1 (Paling Kanan: Bongkar Supplier)</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-orange-600 inline-block" />
                  <span>Lantai 2: Atas Gambar 8 &amp; 9 + Tangga di Depan Gambar 9</span>
                </span>
              </div>
              <span className="text-slate-500 font-medium">
                Klik Kiri + Geser: Putar 3D &bull; Scroll: Zoom
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Foto Aktual Lorong Terpilih + Kustomisasi Penambahan & Pengurangan */}
        <div className="xl:col-span-4 flex flex-col gap-4">
          {/* Card Preview Foto Aktual Lorong (Gambar 2 s/d Gambar 9) */}
          <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-xs space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-blue-600 block">
                  Referensi Posisi Aktual Terpilih
                </span>
                <h4 className="text-xs font-black text-slate-900">
                  {selectedPhotoInfo.title}
                </h4>
              </div>
              <span
                className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                  selectedPhotoInfo.hasFloor2Above
                    ? 'bg-orange-100 text-orange-800 border border-orange-300'
                    : 'bg-slate-100 text-slate-700 border border-slate-200'
                }`}
              >
                {selectedPhotoInfo.hasFloor2Above ? 'Ada Lantai 2 di Atasnya' : 'Langsung Atap (Lantai 1)'}
              </span>
            </div>

            <div className="grid grid-cols-12 gap-2.5 items-center">
              <div className="col-span-5 h-28 rounded-xl overflow-hidden border border-slate-200 bg-slate-950 relative">
                <img
                  src={selectedPhotoInfo.photoUrl}
                  alt={selectedPhotoInfo.title}
                  onError={(e) => {
                    const target = e.currentTarget;
                    if (target.src !== selectedPhotoInfo.fallbackUrl) {
                      target.src = selectedPhotoInfo.fallbackUrl;
                    }
                  }}
                  className="w-full h-full object-cover"
                />
                <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-slate-900/85 text-white text-[9px] font-black">
                  {selectedPhotoInfo.photoLabel}
                </span>
              </div>
              <div className="col-span-7 space-y-1.5 text-[11px]">
                <p className="text-slate-600 leading-snug">{selectedPhotoInfo.description}</p>
                <div className="p-1.5 rounded-lg bg-slate-50 border border-slate-200 font-bold text-slate-800 text-[10px]">
                  {selectedPhotoInfo.frontFeature}
                </div>
              </div>
            </div>
          </div>

          {/* Card Kontrol Kustomisasi & Simulasi Forklift */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div>
                <h4 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                  <Sliders className="w-4 h-4 text-blue-600" />
                  <span>Kustomisasi &amp; Simulasi Rak</span>
                </h4>
                <p className="text-[11px] text-slate-500">
                  Penambahan (Ram 1 Kanan) &amp; Pengurangan (Ram 2 Tengah / Ram 3 Kiri)
                </p>
              </div>
            </div>

            {/* Mode Toggle: Penambahan vs Pengurangan */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSimMode('PENAMBAHAN')}
                className={`py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 border transition cursor-pointer ${
                  simMode === 'PENAMBAHAN'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <ArrowDownToLine className="w-3.5 h-3.5" />
                <span>+ Penambahan (Ram 1)</span>
              </button>
              <button
                type="button"
                onClick={() => setSimMode('PENGURANGAN')}
                className={`py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 border transition cursor-pointer ${
                  simMode === 'PENGURANGAN'
                    ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <ArrowUpFromLine className="w-3.5 h-3.5" />
                <span>- Pengurangan (Ram 2/3)</span>
              </button>
            </div>

            {/* Select Lantai (Lantai 1 / Lantai 2) */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500">
                1. Pilih Lantai Gudang
              </label>
              <div className="grid grid-cols-2 gap-2">
                {([1, 2] as const).map((fl) => (
                  <button
                    key={fl}
                    type="button"
                    onClick={() => {
                      setSelectedFloor(fl);
                      const nextAisle = fl === 2 && selectedAisle < 7 ? 7 : selectedAisle;
                      setSelectedAisle(nextAisle);
                      const slot = slots.find((s) => s.floor === fl && s.aisleNumber === nextAisle);
                      if (slot) setSelectedKategori(slot.kategoriBarang);
                    }}
                    className={`py-2 px-3 rounded-xl text-xs font-extrabold border transition cursor-pointer ${
                      selectedFloor === fl
                        ? fl === 1
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-orange-600 text-white border-orange-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {fl === 1 ? 'Lantai 1 (Lorong 1 - 8)' : 'Lantai 2 (Dek Mezzanine)'}
                  </button>
                ))}
              </div>
            </div>

            {/* Select Lorong */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500">
                2. Pilih Posisi Lorong ({selectedFloor === 1 ? 'Lorong 1 s/d Lorong 8' : 'Dek Mezzanine Lorong 7 & 8'})
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {availableAislesForSelectedFloor.map((num) => {
                  const slot = slots.find((s) => s.floor === selectedFloor && s.aisleNumber === num);
                  const isFloorPallet = selectedFloor === 1 && num >= 4 && num <= 6;
                  return (
                    <button
                      key={num}
                      type="button"
                      onClick={() => {
                        setSelectedAisle(num);
                        if (slot) setSelectedKategori(slot.kategoriBarang);
                        focusCameraOnSection(num);
                      }}
                      className={`py-1.5 px-2 rounded-xl text-xs font-bold border transition cursor-pointer flex flex-col items-center ${
                        selectedAisle === num
                          ? 'bg-amber-500 text-slate-950 border-amber-500 font-black shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <span>Lorong {num}</span>
                      <span className="text-[9px] opacity-85">
                        {isFloorPallet ? 'Pallet' : num >= 7 ? 'Mezzanine' : 'Rak Tinggi'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Select Kategori Barang */}
            <div className="space-y-1">
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500">
                3. Kategori Barang (Master Barang)
              </label>
              <select
                value={selectedKategori}
                onChange={(e) => {
                  setSelectedKategori(e.target.value);
                  if (currentSelectedSlot) {
                    handleCustomizeSlotCategory(currentSelectedSlot.id, e.target.value);
                  }
                }}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-600 cursor-pointer"
              >
                {masterCategories.map((cat) => (
                  <option key={cat.kategori} value={cat.kategori}>
                    {cat.kategori} (Stok: {cat.totalStok.toLocaleString('id-ID')} {cat.satuan})
                  </option>
                ))}
              </select>
            </div>

            {/* Instant Direct Customization (+/-) */}
            {currentSelectedSlot && (
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700">
                    Lantai {currentSelectedSlot.floor} &bull; Lorong {currentSelectedSlot.aisleNumber}{' '}
                    {currentSelectedSlot.floor === 1 && currentSelectedSlot.aisleNumber >= 4 && currentSelectedSlot.aisleNumber <= 6
                      ? '(Pallet Lantai)'
                      : ''}
                  </span>
                  <span className="font-mono font-black text-blue-700">
                    {currentSelectedSlot.occupiedPallets} / {currentSelectedSlot.maxPallets} Palet
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleCustomizeSlotStock(currentSelectedSlot.id, -customStepPallets)}
                    className="flex-1 py-1.5 px-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-extrabold text-xs flex items-center justify-center gap-1 cursor-pointer transition"
                  >
                    <Minus className="w-3.5 h-3.5" />
                    <span>Kurangi ({customStepPallets})</span>
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={12}
                    value={customStepPallets}
                    onChange={(e) => setCustomStepPallets(Math.max(1, Math.min(12, Number(e.target.value) || 1)))}
                    className="w-12 text-center py-1.5 rounded-xl bg-white border border-slate-200 font-mono text-xs font-black text-slate-900"
                  />
                  <button
                    type="button"
                    onClick={() => handleCustomizeSlotStock(currentSelectedSlot.id, customStepPallets)}
                    className="flex-1 py-1.5 px-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-extrabold text-xs flex items-center justify-center gap-1 cursor-pointer transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah ({customStepPallets})</span>
                  </button>
                </div>
              </div>
            )}

            {/* Select Pintu Ram & Run 3D Forklift Animation */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500">
                  Pintu Ram
                </label>
                <select
                  value={selectedRam}
                  onChange={(e) => setSelectedRam(Number(e.target.value) as 1 | 2 | 3)}
                  className="w-full px-2.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900"
                >
                  {simMode === 'PENAMBAHAN' ? (
                    <option value={1}>Ram 1 (Kanan - Bongkar Supplier)</option>
                  ) : (
                    <>
                      <option value={3}>Ram 3 (Paling Kiri - Muat)</option>
                      <option value={2}>Ram 2 (Tengah - Muat)</option>
                    </>
                  )}
                </select>
              </div>
              <div className="space-y-1">
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500">
                  Palet Simulasi
                </label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={simPallets}
                  onChange={(e) => {
                    const val = Math.max(1, Math.min(10, Number(e.target.value) || 1));
                    setSimPallets(val);
                    setSimQty(val * 250);
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono font-bold text-slate-900"
                />
              </div>
            </div>

            <button
              type="button"
              disabled={Boolean(activeTask)}
              onClick={handleStartSimulation}
              className={`w-full py-2.5 px-4 rounded-xl font-black text-xs text-white flex items-center justify-center gap-2 shadow-sm transition cursor-pointer ${
                activeTask
                  ? 'bg-slate-400 cursor-not-allowed'
                  : simMode === 'PENAMBAHAN'
                  ? 'bg-emerald-600 hover:bg-emerald-500'
                  : 'bg-blue-600 hover:bg-blue-500'
              }`}
            >
              <Play className="w-4 h-4 fill-current" />
              <span>
                {activeTask
                  ? 'Forklift Sedang Berjalan...'
                  : simMode === 'PENAMBAHAN'
                  ? `Jalankan Simulasi Bongkar (Ram 1 Kanan -> Lt.${selectedFloor} Lorong ${selectedAisle})`
                  : `Jalankan Simulasi Muat (Lt.${selectedFloor} Lorong ${selectedAisle} -> Ram ${selectedRam})`}
              </span>
            </button>
          </div>

          {/* Log Riwayat */}
          <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-xs flex-1 flex flex-col">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Log Operasional Ram &amp; Lorong</span>
            </h4>
            <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
              {simLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-2 rounded-xl bg-slate-50 border border-slate-200/80 text-xs space-y-0.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`px-1.5 py-0.5 rounded font-black text-[10px] ${
                        log.operation === 'PENAMBAHAN'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {log.operation === 'PENAMBAHAN' ? '+ RAM 1 (KANAN)' : `- RAM ${log.ramNumber}`} &bull; LT.{log.floor} LORONG {log.aisleNumber}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">{log.timestamp}</span>
                  </div>
                  <div className="text-[11px] text-slate-600">{log.status}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Grid: Status & Kustomisasi Langsung per Lorong */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <Package className="w-4 h-4 text-blue-600" />
              <span>Daftar Lorong Lantai 1 (Lorong 1 &ndash; 8) &amp; Lantai 2 (Mezzanine Lorong 7 &ndash; 8)</span>
            </h4>
            <p className="text-xs text-slate-500">
              Urutan sisi kiri ke kanan. Lorong 4 sampai 6 adalah staging pallet lantai terbuka tanpa rak besi. Klik kartu untuk fokus kamera 3D atau gunakan tombol <strong>-</strong> / <strong>+</strong> untuk mengatur jumlah palet.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {visibleSlots.map((slot) => {
            const pct = Math.round((slot.occupiedPallets / slot.maxPallets) * 100);
            const isSelected = selectedFloor === slot.floor && selectedAisle === slot.aisleNumber;
            const isFloorPallet = slot.floor === 1 && slot.aisleNumber >= 4 && slot.aisleNumber <= 6;
            return (
              <div
                key={slot.id}
                onClick={() => {
                  setSelectedFloor(slot.floor);
                  setSelectedAisle(slot.aisleNumber);
                  setSelectedKategori(slot.kategoriBarang);
                  focusCameraOnSection(slot.aisleNumber);
                }}
                className={`p-3 rounded-2xl border transition cursor-pointer flex flex-col justify-between gap-2.5 ${
                  isSelected
                    ? 'bg-blue-50/70 border-blue-500 ring-2 ring-blue-500/20'
                    : 'bg-slate-50/70 border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-1">
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                        slot.floor === 1
                          ? isFloorPallet
                            ? 'bg-amber-100 text-amber-900 border border-amber-300'
                            : slot.hasMezzanineAbove
                            ? 'bg-orange-100 text-orange-900 border border-orange-300'
                            : 'bg-blue-100 text-blue-800 border border-blue-200'
                          : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      }`}
                    >
                      Lt.{slot.floor} &bull; Lorong {slot.aisleNumber} {isFloorPallet ? '(Pallet Lantai)' : ''}
                    </span>
                    <span className="text-[11px] font-mono font-black text-slate-700">
                      {slot.occupiedPallets}/{slot.maxPallets} Palet
                    </span>
                  </div>

                  <div className="text-[10px] font-bold text-slate-500">
                    {isFloorPallet
                      ? 'Staging Pallet Terbuka (Tanpa Rak)'
                      : slot.floor === 1 && slot.hasMezzanineAbove
                      ? 'Di Bawah Dek Mezzanine Lantai 2'
                      : slot.floor === 2
                      ? 'Dek Mezzanine (Akses Tangga Lorong 8)'
                      : 'Lantai 1 (Rak Besi Tinggi)'}
                  </div>

                  {/* Category Selector per Lorong */}
                  <div onClick={(e) => e.stopPropagation()}>
                    <select
                      value={slot.kategoriBarang}
                      onChange={(e) => handleCustomizeSlotCategory(slot.id, e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-extrabold text-slate-900 focus:outline-none focus:border-blue-500 cursor-pointer"
                    >
                      {masterCategories.map((cat) => (
                        <option key={cat.kategori} value={cat.kategori}>
                          {cat.kategori}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        pct > 85 ? 'bg-amber-500' : slot.floor === 1 ? 'bg-blue-600' : 'bg-emerald-600'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-600">
                    <span>Stok Rak:</span>
                    <strong className="font-mono text-slate-900">
                      {slot.stockQty.toLocaleString('id-ID')} {slot.satuan}
                    </strong>
                  </div>

                  {/* Direct +/- Customization Buttons */}
                  <div className="flex items-center gap-1.5 pt-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => handleCustomizeSlotStock(slot.id, -1)}
                      className="flex-1 py-1.5 rounded-lg bg-white hover:bg-rose-50 text-rose-600 border border-slate-200 hover:border-rose-300 font-black text-xs flex items-center justify-center gap-1 transition cursor-pointer"
                    >
                      <Minus className="w-3 h-3" />
                      <span>Kurangi</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCustomizeSlotStock(slot.id, 1)}
                      className="flex-1 py-1.5 rounded-lg bg-white hover:bg-emerald-50 text-emerald-600 border border-slate-200 hover:border-emerald-300 font-black text-xs flex items-center justify-center gap-1 transition cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Tambah</span>
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
};
