import { SparePart, SparePartUsage } from '../types';

export const INITIAL_SPARE_PARTS: SparePart[] = [
  // Kategori: OLI (Pelumas Mesin & Transmisi)
  {
    id: 'sp-oil-01',
    name: 'Oli Mesin Diesel Meditran SX 15W-40 (4 Liter)',
    category: 'oli',
    partNumber: 'MED-SX-4L',
    unit: 'Galon (4L)',
    stock: 14,
    minStock: 4,
    costPerUnit: 195000,
    compatibleVehicles: 'Pick Up L300, Traga, Canter CDD',
    storageLocation: 'Rak Gudang A-01 (Pelumas)',
    lastRestockDate: '2026-09-01',
    notes: 'Pelumas mesin standar heavy duty API CH-4, interval 10.000 KM.'
  },
  {
    id: 'sp-oil-02',
    name: 'Oli Mesin Rimula R4X 15W-40 CI-4 (5 Liter)',
    category: 'oli',
    partNumber: 'SH-RIM-R4X',
    unit: 'Galon (5L)',
    stock: 8,
    minStock: 3,
    costPerUnit: 265000,
    compatibleVehicles: 'Hino Wingbox, Fuso Fighter 6x2',
    storageLocation: 'Rak Gudang A-02 (Pelumas Berat)',
    lastRestockDate: '2026-08-25',
    notes: 'Untuk armada mesin besar dengan turbo intercooler.'
  },
  {
    id: 'sp-oil-03',
    name: 'Oli Gardan & Transmisi Rored HDA SAE 90 GL-5',
    category: 'oli',
    partNumber: 'ROR-90-GL5',
    unit: 'Liter',
    stock: 20,
    minStock: 6,
    costPerUnit: 68000,
    compatibleVehicles: 'Semua Armada (Pick Up s/d Wingbox)',
    storageLocation: 'Rak Gudang A-03 (Pelumas)',
    lastRestockDate: '2026-08-15',
    notes: 'Interval penggantian tiap 20.000 KM atau 6 bulan.'
  },

  // Kategori: BAN (Tires)
  {
    id: 'sp-tire-01',
    name: 'Ban Radial Bridgestone Ecopia R156 185/80 R14 8PR',
    category: 'ban',
    partNumber: 'BS-ECO-185R14',
    unit: 'Pcs',
    stock: 6,
    minStock: 2,
    costPerUnit: 740000,
    compatibleVehicles: 'Mitsubishi L300, Isuzu Traga Pick Up',
    storageLocation: 'Area Ban Rak B-01 (Ring 14)',
    lastRestockDate: '2026-08-20',
    notes: 'Ban tubeless depan/belakang armada pick up box.'
  },
  {
    id: 'sp-tire-02',
    name: 'Ban Truk Gajah Tunggal Super Lug 7.50-16 14PR',
    category: 'ban',
    partNumber: 'GT-SL-750-16',
    unit: 'Pcs',
    stock: 8,
    minStock: 3,
    costPerUnit: 1480000,
    compatibleVehicles: 'Mitsubishi Canter CDD, Isuzu Giga CDD',
    storageLocation: 'Area Ban Rak B-02 (Ring 16)',
    lastRestockDate: '2026-09-10',
    notes: 'Ban heavy duty tapak kasar traksi tinggi jalur Banyuwangi - Jember.'
  },
  {
    id: 'sp-tire-03',
    name: 'Ban Heavy Duty Michelin X Multi Z 10.00-20 16PR',
    category: 'ban',
    partNumber: 'MICH-XM-1000R20',
    unit: 'Pcs',
    stock: 4,
    minStock: 2,
    costPerUnit: 2850000,
    compatibleVehicles: 'Hino Wingbox, Fuso Fighter',
    storageLocation: 'Area Ban Rak B-03 (Ring 20)',
    lastRestockDate: '2026-08-18',
    notes: 'Ban utama tronton & wingbox kapasitas muatan 25 Ton.'
  },

  // Kategori: AKI (Baterai Kendaraan)
  {
    id: 'sp-battery-01',
    name: 'Aki GS Astra Hybrid N70 12V 70Ah',
    category: 'aki',
    partNumber: 'GS-HYB-N70',
    unit: 'Unit',
    stock: 5,
    minStock: 2,
    costPerUnit: 1180000,
    compatibleVehicles: 'Mitsubishi Canter CDD, Isuzu Traga',
    storageLocation: 'Rak Gudang C-01 (Kelistrikan)',
    lastRestockDate: '2026-09-05',
    notes: 'Aki hybrid minim perawatan, garansi pabrik 12 bulan.'
  },
  {
    id: 'sp-battery-02',
    name: 'Aki Incoe Gold NS70 12V 65Ah',
    category: 'aki',
    partNumber: 'INC-GOLD-NS70',
    unit: 'Unit',
    stock: 4,
    minStock: 2,
    costPerUnit: 940000,
    compatibleVehicles: 'Pick Up Box L300',
    storageLocation: 'Rak Gudang C-02 (Kelistrikan)',
    lastRestockDate: '2026-08-30',
    notes: 'Daya starter handal untuk operasional harian ritase padat.'
  },
  {
    id: 'sp-battery-03',
    name: 'Aki Yuasa Heavy Duty N120 12V 120Ah (Pasang 24V)',
    category: 'aki',
    partNumber: 'YUA-HD-N120',
    unit: 'Unit',
    stock: 3,
    minStock: 2,
    costPerUnit: 2150000,
    compatibleVehicles: 'Hino Wingbox 500, Fuso Fighter (Sistem 24V)',
    storageLocation: 'Rak Gudang C-03 (Kelistrikan Berat)',
    lastRestockDate: '2026-08-12',
    notes: 'Dipasang berpasangan (seri 2x12V = 24V) untuk tronton wingbox.'
  },

  // Kategori: FILTER (Filter Oli, Solar, & Udara)
  {
    id: 'sp-filter-01',
    name: 'Filter Oli Mesin Canter / PS120 (ME014833)',
    category: 'filter',
    partNumber: 'ME-014833',
    unit: 'Pcs',
    stock: 12,
    minStock: 4,
    costPerUnit: 65000,
    compatibleVehicles: 'Mitsubishi Canter CDD Box',
    storageLocation: 'Rak Gudang D-01 (Filter)',
    lastRestockDate: '2026-09-02',
    notes: 'Wajib diganti bersamaan tiap penggantian oli mesin.'
  },
  {
    id: 'sp-filter-02',
    name: 'Filter Solar Bawah (Sedimenter) Isuzu Panther / L300',
    category: 'filter',
    partNumber: 'FIL-SOL-L300',
    unit: 'Pcs',
    stock: 10,
    minStock: 3,
    costPerUnit: 85000,
    compatibleVehicles: 'L300 Pick Up, Isuzu Traga',
    storageLocation: 'Rak Gudang D-02 (Filter)',
    lastRestockDate: '2026-08-28',
    notes: 'Mencegah injektor mampet akibat biosolar B35.'
  },

  // Kategori: REM & KAKI-KAKI
  {
    id: 'sp-brake-01',
    name: 'Kampas Rem Depan Canter CDD Double (Set Kiri-Kanan)',
    category: 'rem',
    partNumber: 'BRK-CTR-FR',
    unit: 'Set',
    stock: 5,
    minStock: 2,
    costPerUnit: 290000,
    compatibleVehicles: 'Mitsubishi Canter CD-03',
    storageLocation: 'Rak Gudang E-01 (Pengereman)',
    lastRestockDate: '2026-08-10',
    notes: 'Bahan non-asbestos tahan panas turunan Gumitir.'
  },
  {
    id: 'sp-brake-02',
    name: 'Kampas Rem Belakang L300 Tromol (Set)',
    category: 'rem',
    partNumber: 'BRK-L300-RR',
    unit: 'Set',
    stock: 6,
    minStock: 2,
    costPerUnit: 185000,
    compatibleVehicles: 'Pick Up Box L300 PU-05',
    storageLocation: 'Rak Gudang E-02 (Pengereman)',
    lastRestockDate: '2026-08-14',
    notes: 'Kampas rem tromol heavy duty.'
  }
];

export const INITIAL_SPARE_PART_USAGES: SparePartUsage[] = [
  // B 9673 XYZ (PU-05) - Penggantian Oli & Filter Rutin
  {
    id: 'usg-01',
    fleetId: 'flt-05',
    plateNumber: 'B 9673 XYZ',
    initialCode: 'PU-05',
    partId: 'sp-oil-01',
    partName: 'Oli Mesin Diesel Meditran SX 15W-40 (4 Liter)',
    category: 'oli',
    quantity: 1,
    unit: 'Galon (4L)',
    replacementDate: '2026-09-05',
    odometerKm: 38500,
    nextReplacementKm: 48500,
    nextReplacementDate: '2026-12-05',
    mechanicOrWorkshop: 'Mekanik Internal AKK (Pak Slamet)',
    totalCost: 195000,
    notes: 'Ganti oli rutin berkala, kondisi mesin prima dan tarikan enteng.',
    performedBy: 'Budi Santoso'
  },
  {
    id: 'usg-02',
    fleetId: 'flt-05',
    plateNumber: 'B 9673 XYZ',
    initialCode: 'PU-05',
    partId: 'sp-filter-02',
    partName: 'Filter Solar Bawah (Sedimenter) Isuzu Panther / L300',
    category: 'filter',
    quantity: 1,
    unit: 'Pcs',
    replacementDate: '2026-09-05',
    odometerKm: 38500,
    nextReplacementKm: 58500,
    nextReplacementDate: '2027-03-05',
    mechanicOrWorkshop: 'Mekanik Internal AKK (Pak Slamet)',
    totalCost: 85000,
    notes: 'Filter solar lama kotor akibat biosolar, diganti baru.',
    performedBy: 'Budi Santoso'
  },

  // DK 8192 AA (CD-03) - Penggantian Ban Depan
  {
    id: 'usg-03',
    fleetId: 'flt-03',
    plateNumber: 'DK 8192 AA',
    initialCode: 'CD-03',
    partId: 'sp-tire-02',
    partName: 'Ban Truk Gajah Tunggal Super Lug 7.50-16 14PR',
    category: 'ban',
    quantity: 2,
    unit: 'Pcs',
    replacementDate: '2026-09-02',
    odometerKm: 72100,
    nextReplacementKm: 122100,
    nextReplacementDate: '2027-09-02',
    mechanicOrWorkshop: 'Toko Ban Sumber Rejeki Rogojampi',
    totalCost: 2960000,
    notes: 'Ganti 2 ban depan baru + balancing dan spooring.',
    performedBy: 'Admin Logistik'
  },

  // B 9822 TAA (WB-02) - Penggantian Aki 24V (2 Unit)
  {
    id: 'usg-04',
    fleetId: 'flt-02',
    plateNumber: 'B 9822 TAA',
    initialCode: 'WB-02',
    partId: 'sp-battery-03',
    partName: 'Aki Yuasa Heavy Duty N120 12V 120Ah (Pasang 24V)',
    category: 'aki',
    quantity: 2,
    unit: 'Unit',
    replacementDate: '2026-08-14',
    odometerKm: 115400,
    nextReplacementKm: 195400,
    nextReplacementDate: '2028-08-14',
    mechanicOrWorkshop: 'Bengkel Resmi Hino Banyuwangi',
    totalCost: 4300000,
    notes: 'Penggantian 2 aki 120Ah baru karena voltase drop saat starter subuh.',
    performedBy: 'Pak Hendra'
  },

  // P 8125 VC (N1 / NP1) - Penggantian Aki L300
  {
    id: 'usg-05',
    fleetId: 'flt-01',
    plateNumber: 'P 8125 VC',
    initialCode: 'N1 / NP1',
    partId: 'sp-battery-02',
    partName: 'Aki Incoe Gold NS70 12V 65Ah',
    category: 'aki',
    quantity: 1,
    unit: 'Unit',
    replacementDate: '2026-08-20',
    odometerKm: 51200,
    nextReplacementKm: 91200,
    nextReplacementDate: '2028-02-20',
    mechanicOrWorkshop: 'Mekanik Internal AKK',
    totalCost: 940000,
    notes: 'Aki lama sudah berumur 2.5 tahun dan sel baterai melemah.',
    performedBy: 'Budi Santoso'
  },

  // P 9102 UQ (FS-04) - Penggantian Oli & Kampas Rem
  {
    id: 'usg-06',
    fleetId: 'flt-04',
    plateNumber: 'P 9102 UQ',
    initialCode: 'FS-04',
    partId: 'sp-oil-02',
    partName: 'Oli Mesin Rimula R4X 15W-40 CI-4 (5 Liter)',
    category: 'oli',
    quantity: 3,
    unit: 'Galon (5L)',
    replacementDate: '2026-08-01',
    odometerKm: 142000,
    nextReplacementKm: 152000,
    nextReplacementDate: '2026-11-01',
    mechanicOrWorkshop: 'Bengkel Hino Kalipuro',
    totalCost: 795000,
    notes: 'Pengisian oli 14.5 Liter + ganti saringan oli.',
    performedBy: 'Admin Logistik'
  }
];
