import { FuelLog, VehicleType } from '../types';

export const FUEL_TARGET_RATIOS: Record<VehicleType, { target: number; minAcceptable: number; label: string }> = {
  'Pick Up Box': { target: 11.0, minAcceptable: 9.5, label: '11.0 KM / Liter' },
  'Engkel STD': { target: 8.2, minAcceptable: 7.0, label: '8.2 KM / Liter' },
  'Engkel Long': { target: 7.5, minAcceptable: 6.4, label: '7.5 KM / Liter' },
  'Double STD': { target: 6.2, minAcceptable: 5.2, label: '6.2 KM / Liter' }
};

export const STANDARD_FUEL_PRICES = {
  'BioSolar': 6800,
  'Dexlite': 14500,
  'Pertamina Dex': 15650,
  'Pertalite': 10000,
  'Pertamax': 12950
};

export const COMMON_GAS_STATIONS = [
  'SPBU 54.684.02 Rogojampi, Banyuwangi',
  'SPBU 54.684.18 Ketapang Pelabuhan, Banyuwangi',
  'SPBU 54.684.33 Klatak Kalipuro, Banyuwangi',
  'SPBU Rest Area Tol Probolinggo KM 833 A',
  'SPBU Rest Area Tol Pasuruan-Probolinggo KM 792',
  'SPBU 54.671.05 Gempol Bundaran, Pasuruan',
  'SPBU 54.612.01 Waru, Sidoarjo',
  'SPBU 54.681.04 Rambipuji, Jember',
  'SPBU 54.651.10 Singosari, Malang',
  'SPBU 54.822.03 Raya Gilimanuk - Negara, Bali'
];

// Data riwayat & angka efisiensi BBM dikosongkan agar pengguna dapat menginput data aktual dari awal
export const INITIAL_FUEL_LOGS: FuelLog[] = [];
