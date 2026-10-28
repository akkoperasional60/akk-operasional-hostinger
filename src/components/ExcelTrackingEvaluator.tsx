import React, { useState, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  Upload,
  FileSpreadsheet,
  Download,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Gauge,
  MapPin,
  RefreshCw,
  Search,
  Store,
  TrendingUp,
  Truck,
  ArrowLeft,
  History,
  Check,
  ShieldAlert,
  Calendar,
  Layers,
  Eye,
  Trash2
} from 'lucide-react';
import { LeafletMap } from './LeafletMap';
import { logisticsStore } from '../services/store';
import {
  TrackingEvaluation,
  TracksolidTripLeg,
  TracksolidDateSubtotal,
  TracksolidBottomSummary,
  RouteStop,
  TrackingPoint,
  RetailStore,
  Fleet
} from '../types';
import { getStoreLocationType } from '../utils/coordinateParser';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function parseTimeSeconds(timeStr: string): number | null {
  if (!timeStr) return null;
  const clean = String(timeStr).trim();
  const timeMatch = clean.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!timeMatch) return null;
  const h = parseInt(timeMatch[1], 10);
  const m = parseInt(timeMatch[2], 10);
  const s = timeMatch[3] ? parseInt(timeMatch[3], 10) : 0;
  return h * 3600 + m * 60 + s;
}

function formatSecondsToHMS(totalSec: number): string {
  const sec = Math.max(0, Math.round(totalSec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function computeStopMinutesBetween(prevEndTime: string, nextStartTime: string): number {
  const t1 = parseTimeSeconds(prevEndTime);
  const t2 = parseTimeSeconds(nextStartTime);
  if (t1 === null || t2 === null) return 0;
  let diffSec = t2 - t1;
  if (diffSec < 0) {
    diffSec += 24 * 3600;
  }
  return Math.max(0, Math.round(diffSec / 60));
}

// Coordinates dictionary for geocoding Tracksolid & Wanway locations in Banyuwangi, Jatim, and Bali
const TRACKSOLID_GEO_DICT: Record<string, [number, number]> = {
  // Banyuwangi
  'argopuro': [-8.1906, 114.3708],
  'sukowidi': [-8.1906, 114.3708],
  'klatak': [-8.1906, 114.3708],
  'gereja advent': [-8.1906, 114.3708],
  'pertamina': [-8.1990, 114.3730],
  'bulusan': [-8.1990, 114.3730],
  'gatot subroto': [-8.1990, 114.3730],
  'indomarket': [-8.1432, 114.3976],
  'alfamart': [-8.1435, 114.3978],
  'ketapang': [-8.1435, 114.3975],
  'pier 1 ketapang': [-8.1420, 114.4010],
  'tirtopuro': [-8.2050, 114.3500],
  'genteng': [-8.3650, 114.1530],
  'rogojampi': [-8.3050, 114.2980],
  'jajag': [-8.4265, 114.1825],
  'muncar': [-8.4350, 114.3320],
  'banyuwangi': [-8.2192, 114.3691],

  // Luar Kota (Jember, Situbondo, Bondowoso)
  'jember': [-8.1724, 113.6995],
  'roxy square': [-8.1845, 113.6682],
  'sumbersari': [-8.1682, 113.7155],
  'tanggul': [-8.1642, 113.4485],
  'situbondo': [-7.7062, 114.0095],
  'panji': [-7.7150, 114.0350],
  'besuki': [-7.7345, 113.6892],
  'bondowoso': [-7.9135, 113.8214],

  // Bali - Jembrana & Gilimanuk
  'gilimanuk': [-8.1628, 114.4382],
  'pier 4 gilimanuk': [-8.1635, 114.4390],
  'swt mart': [-8.1642, 114.4395],
  'yeh sumbul': [-8.3956, 114.7764],
  'jembrana': [-8.3575, 114.6255],
  'negara': [-8.3575, 114.6255],

  // Bali - Tabanan
  'megati': [-8.4982, 115.0412],
  'bunut puhun': [-8.4982, 115.0412],
  'sembung gede': [-8.5120, 115.0680],
  'samsam': [-8.5325, 115.0985],
  'tabanan': [-8.5412, 115.1255],

  // Bali - Badung
  'penarungan': [-8.5892, 115.1824],
  'lukluk': [-8.5892, 115.1824],
  'badung': [-8.6500, 115.1667],
  'kuta': [-8.7233, 115.1723],
  'bypass ngurah rai': [-8.7185, 115.1825],
  'kok tong bali': [-8.7185, 115.1825],
  'pondok sulawesi': [-8.7124, 115.1838],
  'sunset road': [-8.6982, 115.1765],
  'agung bali': [-8.6982, 115.1765],
  'indomaret fresh': [-8.7233, 115.1812],

  // Bali - Denpasar
  'ubung': [-8.6345, 115.2035],
  'north denpasar': [-8.6345, 115.2035],
  'pemecutan kaja': [-8.6410, 115.1980],
  'buluh indah': [-8.6425, 115.1950],
  'gas station buluh indah': [-8.6425, 115.1950],
  'gunung batukaru': [-8.6552, 115.2028],
  'honda kertiawan': [-8.6552, 115.2028],
  'gang imbura': [-8.6625, 115.1975],
  'gang nyuh bubuh': [-8.6640, 115.1960],
  'pemecutan kelod': [-8.6685, 115.1885],
  'pulau bungin': [-8.6768, 115.2045],
  'warung jawa muslim': [-8.6768, 115.2045],
  'pulau indah': [-8.6732, 115.2012],
  'imam bonjol': [-8.6745, 115.1952],
  'surya ban': [-8.6745, 115.1952],
  'teuku umar': [-8.6685, 115.1885],
  'gojek hq': [-8.6685, 115.1885],
  'gunung salak': [-8.6712, 115.1782],
  'padangsambian': [-8.6712, 115.1782],
  'nasi ayam betutu sunari': [-8.6712, 115.1782],
  'denpasar': [-8.6705, 115.2126]
};

function resolveTracksolidCoords(
  locationName: string,
  index = 0,
  stores: RetailStore[] = []
): [number, number] {
  const raw = String(locationName || '').trim();
  // 1. Check if raw string contains explicit lat,lng coordinates like "-8.219, 114.369"
  const coordMatch = raw.match(/(-?\d+\.\d+)\s*[,;/]\s*(\d+\.\d+)/);
  if (coordMatch) {
    const lat = parseFloat(coordMatch[1]);
    const lng = parseFloat(coordMatch[2]);
    if (!isNaN(lat) && !isNaN(lng) && lat >= -11 && lat <= 6 && lng >= 95 && lng <= 141) {
      return [lat, lng];
    }
  }

  const norm = raw.toLowerCase();

  // 2. Match against registered customer stores in Jaringan Toko & Mitra
  for (const st of stores) {
    const sName = st.storeName.toLowerCase();
    if (sName.length > 4 && norm.includes(sName)) {
      return [st.latitude, st.longitude];
    }
  }

  // 3. Match against known geographic dictionary
  for (const [key, coords] of Object.entries(TRACKSOLID_GEO_DICT)) {
    if (norm.includes(key)) {
      return coords;
    }
  }

  // 4. Match by kecamatan/kabupaten in registered stores
  for (const st of stores) {
    const kec = (st.kecamatan || '').toLowerCase();
    if (kec.length > 4 && norm.includes(kec)) {
      return [st.latitude, st.longitude];
    }
  }

  const seed = (index * 37 + norm.length * 13) % 100;
  return [-8.3050 + seed / 1200, 114.2980 + seed / 1200];
}

// Default 26 Trip Legs from Tracksolid export
export const DEFAULT_TRACKSOLID_26_LEGS: TracksolidTripLeg[] = [
  // 2026-10-26 (21 trips)
  {
    legNumber: 1,
    dateGroup: '2026-10-26',
    startTime: '17:15:33',
    startLocation: 'Ketapang, 21, Ketapang, Banyuwangi, Ketapang, East Java, Java, 68451, Indonesia',
    endTime: '17:30:57',
    endLocation: 'Lingkungan Sukowidi Desa Klatak, Banyuwangi, Tirtopuro, Banyuwangi, East Java, Java, 68421, Indonesia',
    mileageKm: 7.26,
    travelTime: '00:15:23',
    travelMinutes: 15.38,
    avgSpeedKmh: 28.30,
    maxSpeedKmh: 51.00,
    fuelPer100Km: 0.0,
    totalFuelLiters: 0.0,
    startLat: -8.1435,
    startLng: 114.3975,
    endLat: -8.1906,
    endLng: 114.3708,
    stopBeforeMinutes: 122,
    stopBeforeStart: '15:13:37',
    stopBeforeEnd: '17:15:33',
    matchedStoreName: 'Gudang Pusat Banyuwangi DC (Klatak)',
    matchedStoreKecamatan: 'Kalipuro',
    matchedStoreKabupaten: 'Banyuwangi'
  },
  {
    legNumber: 2,
    dateGroup: '2026-10-26',
    startTime: '15:10:13',
    startLocation: 'SWT mart, Jalan Raya Denpasar-Gilimanuk, Gilimanuk, Jembrana, Bali, Lesser Sunda Islands, Indonesia',
    endTime: '15:13:37',
    endLocation: 'Pier 4 Gilimanuk ferry port, Jalan Raya Denpasar-Gilimanuk, Gilimanuk, Jembrana, Bali, Lesser Sunda Islands, Indonesia',
    mileageKm: 0.32,
    travelTime: '00:03:23',
    travelMinutes: 3.38,
    avgSpeedKmh: 5.71,
    maxSpeedKmh: 17.00,
    fuelPer100Km: 0.0,
    totalFuelLiters: 0.0,
    startLat: -8.1642,
    startLng: 114.4395,
    endLat: -8.1635,
    endLng: 114.4390,
    stopBeforeMinutes: 7,
    stopBeforeStart: '15:02:53',
    stopBeforeEnd: '15:10:13',
    matchedStoreName: 'SWT MART GILIMANUK',
    matchedStoreKecamatan: 'Melaya',
    matchedStoreKabupaten: 'Jembrana'
  },
  {
    legNumber: 3,
    dateGroup: '2026-10-26',
    startTime: '12:42:57',
    startLocation: 'Pick up?, Jalan Raya Denpasar-Gilimanuk, Bunut Puhun, Megati, Tabanan, Bali, Lesser Sunda Islands, 82162, Indonesia',
    endTime: '15:02:53',
    endLocation: 'SWT mart, Jalan Raya Denpasar-Gilimanuk, Gilimanuk, Jembrana, Bali, Lesser Sunda Islands, Indonesia',
    mileageKm: 94.50,
    travelTime: '02:19:56',
    travelMinutes: 139.93,
    avgSpeedKmh: 40.52,
    maxSpeedKmh: 76.00,
    fuelPer100Km: 0.0,
    totalFuelLiters: 0.0,
    startLat: -8.4982,
    startLng: 115.0412,
    endLat: -8.1642,
    endLng: 114.4395,
    stopBeforeMinutes: 12,
    stopBeforeStart: '12:30:36',
    stopBeforeEnd: '12:42:57',
    matchedStoreName: 'TOKO SEMBUNG GEDE & MEGATI TABANAN',
    matchedStoreKecamatan: 'Selemadeg Timur',
    matchedStoreKabupaten: 'Tabanan'
  },
  {
    legNumber: 4,
    dateGroup: '2026-10-26',
    startTime: '12:21:16',
    startLocation: 'Sembung Gede, Tabanan, Bali, Lesser Sunda Islands, Indonesia',
    endTime: '12:30:36',
    endLocation: 'Pick up?, Jalan Raya Denpasar-Gilimanuk, Bunut Puhun, Megati, Tabanan, Bali, Lesser Sunda Islands, 82162, Indonesia',
    mileageKm: 4.60,
    travelTime: '00:09:20',
    travelMinutes: 9.33,
    avgSpeedKmh: 29.57,
    maxSpeedKmh: 57.00,
    fuelPer100Km: 0.0,
    totalFuelLiters: 0.0,
    startLat: -8.5120,
    startLng: 115.0680,
    endLat: -8.4982,
    endLng: 115.0412,
    stopBeforeMinutes: 80,
    stopBeforeStart: '11:00:57',
    stopBeforeEnd: '12:21:16',
    matchedStoreName: 'TOKO SEMBUNG GEDE & MEGATI TABANAN',
    matchedStoreKecamatan: 'Selemadeg Timur',
    matchedStoreKabupaten: 'Tabanan'
  },
  {
    legNumber: 5,
    dateGroup: '2026-10-26',
    startTime: '10:49:21',
    startLocation: 'Tabanan, Samsam, Tabanan, Bali, Lesser Sunda Islands, Indonesia',
    endTime: '11:00:57',
    endLocation: 'Sembung Gede, Tabanan, Bali, Lesser Sunda Islands, Indonesia',
    mileageKm: 5.02,
    travelTime: '00:11:36',
    travelMinutes: 11.60,
    avgSpeedKmh: 25.95,
    maxSpeedKmh: 50.00,
    fuelPer100Km: 0.0,
    totalFuelLiters: 0.0,
    startLat: -8.5325,
    startLng: 115.0985,
    endLat: -8.5120,
    endLng: 115.0680,
    stopBeforeMinutes: 5,
    stopBeforeStart: '10:44:48',
    stopBeforeEnd: '10:49:21',
    matchedStoreName: 'DISTRIBUSI KEMASAN SAMSAM TABANAN',
    matchedStoreKecamatan: 'Kerambitan',
    matchedStoreKabupaten: 'Tabanan'
  },
  {
    legNumber: 6,
    dateGroup: '2026-10-26',
    startTime: '10:16:39',
    startLocation: 'Jalan Raya Penarungan, Lukluk, Badung, Bali, Lesser Sunda Islands, 80117, Indonesia',
    endTime: '10:44:48',
    endLocation: 'Tabanan, Samsam, Tabanan, Bali, Lesser Sunda Islands, 08351, Indonesia',
    mileageKm: 12.24,
    travelTime: '00:28:09',
    travelMinutes: 28.15,
    avgSpeedKmh: 26.10,
    maxSpeedKmh: 57.00,
    fuelPer100Km: 0.0,
    totalFuelLiters: 0.0,
    startLat: -8.5892,
    startLng: 115.1824,
    endLat: -8.5325,
    endLng: 115.0985,
    stopBeforeMinutes: 4,
    stopBeforeStart: '10:12:49',
    stopBeforeEnd: '10:16:39',
    matchedStoreName: 'TOKO MITRA KEMASAN LUKLUK BADUNG',
    matchedStoreKecamatan: 'Mengwi',
    matchedStoreKabupaten: 'Badung'
  },
  {
    legNumber: 7,
    dateGroup: '2026-10-26',
    startTime: '09:53:00',
    startLocation: 'Ubung, North Denpasar, Denpasar, Bali, Lesser Sunda Islands, Indonesia',
    endTime: '10:12:49',
    endLocation: 'Lukluk, Badung, Bali, Lesser Sunda Islands, 80117, Indonesia',
    mileageKm: 6.94,
    travelTime: '00:19:48',
    travelMinutes: 19.80,
    avgSpeedKmh: 21.03,
    maxSpeedKmh: 48.00,
    fuelPer100Km: 0.0,
    totalFuelLiters: 0.0,
    startLat: -8.6345,
    startLng: 115.2035,
    endLat: -8.5892,
    endLng: 115.1824,
    stopBeforeMinutes: 3,
    stopBeforeStart: '09:49:38',
    stopBeforeEnd: '09:53:00',
    matchedStoreName: 'GROSIR KEMASAN UBUNG DENPASAR UTARA',
    matchedStoreKecamatan: 'Denpasar Utara',
    matchedStoreKabupaten: 'Denpasar'
  },
  {
    legNumber: 8,
    dateGroup: '2026-10-26',
    startTime: '09:47:20',
    startLocation: 'Ubung, North Denpasar, Denpasar, Bali, Lesser Sunda Islands, 80116, Indonesia',
    endTime: '09:49:38',
    endLocation: 'Ubung, North Denpasar, Denpasar, Bali, Lesser Sunda Islands, 80116, Indonesia',
    mileageKm: 0.08,
    travelTime: '00:02:18',
    travelMinutes: 2.30,
    avgSpeedKmh: 2.11,
    maxSpeedKmh: 13.00,
    fuelPer100Km: 0.0,
    totalFuelLiters: 0.0,
    startLat: -8.6345,
    startLng: 115.2035,
    endLat: -8.6345,
    endLng: 115.2035,
    stopBeforeMinutes: 4,
    stopBeforeStart: '09:43:35',
    stopBeforeEnd: '09:47:20',
    matchedStoreName: 'GROSIR KEMASAN UBUNG DENPASAR UTARA',
    matchedStoreKecamatan: 'Denpasar Utara',
    matchedStoreKabupaten: 'Denpasar'
  },
  {
    legNumber: 9,
    dateGroup: '2026-10-26',
    startTime: '09:37:58',
    startLocation: 'Pemecutan Kaja, North Denpasar, Denpasar, Bali, Lesser Sunda Islands, Indonesia',
    endTime: '09:43:35',
    endLocation: 'Ubung, North Denpasar, Denpasar, Bali, Lesser Sunda Islands, 80116, Indonesia',
    mileageKm: 0.96,
    travelTime: '00:05:36',
    travelMinutes: 5.60,
    avgSpeedKmh: 10.28,
    maxSpeedKmh: 35.00,
    fuelPer100Km: 0.0,
    totalFuelLiters: 0.0,
    startLat: -8.6410,
    startLng: 115.1980,
    endLat: -8.6345,
    endLng: 115.2035,
    stopBeforeMinutes: 7,
    stopBeforeStart: '09:30:38',
    stopBeforeEnd: '09:37:58',
    matchedStoreName: 'GROSIR KEMASAN UBUNG DENPASAR UTARA',
    matchedStoreKecamatan: 'Denpasar Utara',
    matchedStoreKabupaten: 'Denpasar'
  },
  {
    legNumber: 10,
    dateGroup: '2026-10-26',
    startTime: '09:17:49',
    startLocation: 'Honda Kertiawan Motor, Jalan Gunung Batukaru, Pemecutan, West Denpasar',
    endTime: '09:30:38',
    endLocation: 'Gas Station Buluh Indah (54.801.31), Jalan Raya Buluh Indah, Pemecutan Kaja',
    mileageKm: 2.45,
    travelTime: '00:12:49',
    travelMinutes: 12.82,
    avgSpeedKmh: 11.45,
    maxSpeedKmh: 36.00,
    fuelPer100Km: 0.0,
    totalFuelLiters: 0.0,
    startLat: -8.6552,
    startLng: 115.2028,
    endLat: -8.6425,
    endLng: 115.1950,
    stopBeforeMinutes: 7,
    stopBeforeStart: '09:10:45',
    stopBeforeEnd: '09:17:49',
    matchedStoreName: 'HONDA KERTIAWAN MOTOR & MITRA GUNUNG BATUKARU',
    matchedStoreKecamatan: 'Denpasar Barat',
    matchedStoreKabupaten: 'Denpasar'
  },
  {
    legNumber: 11,
    dateGroup: '2026-10-26',
    startTime: '09:05:59',
    startLocation: 'Gang Imbura, Pemecutan Kelod, West Denpasar, Denpasar, Bali, Lesser Sunda Islands, Indonesia',
    endTime: '09:10:45',
    endLocation: 'Honda Kertiawan Motor, Jalan Gunung Batukaru, Pemecutan, West Denpasar',
    mileageKm: 1.77,
    travelTime: '00:04:46',
    travelMinutes: 4.77,
    avgSpeedKmh: 22.27,
    maxSpeedKmh: 35.00,
    fuelPer100Km: 0.0,
    totalFuelLiters: 0.0,
    startLat: -8.6625,
    startLng: 115.1975,
    endLat: -8.6552,
    endLng: 115.2028,
    stopBeforeMinutes: 5,
    stopBeforeStart: '09:01:00',
    stopBeforeEnd: '09:05:59',
    matchedStoreName: 'TOKO PLASTIK GANG IMBURA PEMECUTAN',
    matchedStoreKecamatan: 'Denpasar Barat',
    matchedStoreKabupaten: 'Denpasar'
  },
  {
    legNumber: 12,
    dateGroup: '2026-10-26',
    startTime: '08:57:09',
    startLocation: 'Gang Nyuh Bubuh, Pemecutan Kelod, West Denpasar, Denpasar, Bali, Lesser Sunda Islands, Indonesia',
    endTime: '09:01:00',
    endLocation: 'Gang Imbura, Pemecutan Kelod, West Denpasar, Denpasar, Bali, Lesser Sunda Islands, Indonesia',
    mileageKm: 1.12,
    travelTime: '00:03:51',
    travelMinutes: 3.85,
    avgSpeedKmh: 17.38,
    maxSpeedKmh: 36.00,
    fuelPer100Km: 0.0,
    totalFuelLiters: 0.0,
    startLat: -8.6640,
    startLng: 115.1960,
    endLat: -8.6625,
    endLng: 115.1975,
    stopBeforeMinutes: 4,
    stopBeforeStart: '08:52:49',
    stopBeforeEnd: '08:57:09',
    matchedStoreName: 'TOKO PLASTIK GANG IMBURA PEMECUTAN',
    matchedStoreKecamatan: 'Denpasar Barat',
    matchedStoreKabupaten: 'Denpasar'
  },
  {
    legNumber: 13,
    dateGroup: '2026-10-26',
    startTime: '08:35:27',
    startLocation: 'Warung Jawa Muslim Rena, 112, Jalan Pulau Bungin, Dauh Puri Kauh, West Denpasar',
    endTime: '08:52:49',
    endLocation: 'Jalan Pulau Indah, Dauh Puri Kauh, West Denpasar, Denpasar, Bali, Lesser Sunda Islands, Indonesia',
    mileageKm: 5.19,
    travelTime: '00:17:21',
    travelMinutes: 17.35,
    avgSpeedKmh: 17.95,
    maxSpeedKmh: 37.00,
    fuelPer100Km: 0.0,
    totalFuelLiters: 0.0,
    startLat: -8.6768,
    startLng: 115.2045,
    endLat: -8.6732,
    endLng: 115.2012,
    stopBeforeMinutes: 19,
    stopBeforeStart: '08:16:01',
    stopBeforeEnd: '08:35:27',
    matchedStoreName: 'WARUNG JAWA MUSLIM RENA PULAU BUNGIN',
    matchedStoreKecamatan: 'Denpasar Barat',
    matchedStoreKabupaten: 'Denpasar'
  },
  {
    legNumber: 14,
    dateGroup: '2026-10-26',
    startTime: '08:00:23',
    startLocation: 'Surya Ban, Jalan Imam Bonjol, Pemecutan Kelod, West Denpasar',
    endTime: '08:16:01',
    endLocation: 'Warung Jawa Muslim Rena, 112, Jalan Pulau Bungin, Dauh Puri Kauh, West Denpasar',
    mileageKm: 3.34,
    travelTime: '00:15:37',
    travelMinutes: 15.62,
    avgSpeedKmh: 12.82,
    maxSpeedKmh: 35.00,
    fuelPer100Km: 0.0,
    totalFuelLiters: 0.0,
    startLat: -8.6745,
    startLng: 115.1952,
    endLat: -8.6768,
    endLng: 115.2045,
    stopBeforeMinutes: 9,
    stopBeforeStart: '07:50:52',
    stopBeforeEnd: '08:00:23',
    matchedStoreName: 'SURYA BAN & RETAIL IMAM BONJOL',
    matchedStoreKecamatan: 'Denpasar Barat',
    matchedStoreKabupaten: 'Denpasar'
  },
  {
    legNumber: 15,
    dateGroup: '2026-10-26',
    startTime: '07:41:33',
    startLocation: 'Jalan Gunung Salak, Padangsambian Kelod, West Denpasar',
    endTime: '07:50:52',
    endLocation: 'GoJek HQ, 41, Jalan Teuku Umar Barat, Pemecutan Kelod, West Denpasar',
    mileageKm: 2.66,
    travelTime: '00:09:19',
    travelMinutes: 9.32,
    avgSpeedKmh: 17.15,
    maxSpeedKmh: 44.00,
    fuelPer100Km: 0.0,
    totalFuelLiters: 0.0,
    startLat: -8.6712,
    startLng: 115.1782,
    endLat: -8.6685,
    endLng: 115.1885,
    stopBeforeMinutes: 5,
    stopBeforeStart: '07:36:54',
    stopBeforeEnd: '07:41:33',
    matchedStoreName: 'MITRA KEMASAN TEUKU UMAR BARAT (GOJEK HQ)',
    matchedStoreKecamatan: 'Denpasar Barat',
    matchedStoreKabupaten: 'Denpasar'
  },
  {
    legNumber: 16,
    dateGroup: '2026-10-26',
    startTime: '07:16:41',
    startLocation: 'Agung Bali Pusat Oleh - Oleh, 18 X, Sunset Road, Kuta, Badung, Bali',
    endTime: '07:36:54',
    endLocation: 'Nasi Ayam Betutu Sunari - Padangsambian Klod, Jalan Gunung Salak',
    mileageKm: 5.68,
    travelTime: '00:20:12',
    travelMinutes: 20.20,
    avgSpeedKmh: 16.88,
    maxSpeedKmh: 50.00,
    fuelPer100Km: 0.0,
    totalFuelLiters: 0.0,
    startLat: -8.6982,
    startLng: 115.1765,
    endLat: -8.6712,
    endLng: 115.1782,
    stopBeforeMinutes: 7,
    stopBeforeStart: '07:09:51',
    stopBeforeEnd: '07:16:41',
    matchedStoreName: 'NASI AYAM BETUTU SUNARI PADANGSAMBIAN',
    matchedStoreKecamatan: 'Denpasar Barat',
    matchedStoreKabupaten: 'Denpasar'
  },
  {
    legNumber: 17,
    dateGroup: '2026-10-26',
    startTime: '07:05:41',
    startLocation: 'Pondok Sulawesi, 39, Jalan Bypass Ngurah Rai, Kuta, Badung, Bali',
    endTime: '07:09:51',
    endLocation: 'Sunset Road, Pemecutan Kelod, West Denpasar, Denpasar, Bali',
    mileageKm: 2.27,
    travelTime: '00:04:09',
    travelMinutes: 4.15,
    avgSpeedKmh: 32.76,
    maxSpeedKmh: 50.00,
    fuelPer100Km: 0.0,
    totalFuelLiters: 0.0,
    startLat: -8.7124,
    startLng: 115.1838,
    endLat: -8.6982,
    endLng: 115.1765,
    stopBeforeMinutes: 35,
    stopBeforeStart: '06:30:01',
    stopBeforeEnd: '07:05:41',
    matchedStoreName: 'AGUNG BALI PUSAT OLEH - OLEH SUNSET ROAD',
    matchedStoreKecamatan: 'Kuta',
    matchedStoreKabupaten: 'Badung'
  },
  {
    legNumber: 18,
    dateGroup: '2026-10-26',
    startTime: '06:28:51',
    startLocation: 'Kok Tong Bali, Jalan Bypass Ngurah Rai, Kuta, Badung, Bali',
    endTime: '06:30:01',
    endLocation: 'Pondok Sulawesi, 39, Jalan Bypass Ngurah Rai, Kuta, Badung, Bali',
    mileageKm: 0.61,
    travelTime: '00:01:09',
    travelMinutes: 1.15,
    avgSpeedKmh: 31.82,
    maxSpeedKmh: 33.00,
    fuelPer100Km: 0.0,
    totalFuelLiters: 0.0,
    startLat: -8.7185,
    startLng: 115.1825,
    endLat: -8.7124,
    endLng: 115.1838,
    stopBeforeMinutes: 139,
    stopBeforeStart: '04:09:43',
    stopBeforeEnd: '06:28:51',
    matchedStoreName: 'PONDOK SULAWESI BYPASS NGURAH RAI',
    matchedStoreKecamatan: 'Kuta',
    matchedStoreKabupaten: 'Badung'
  },
  {
    legNumber: 19,
    dateGroup: '2026-10-26',
    startTime: '01:49:28',
    startLocation: 'Yeh Sumbul, Jembrana, Bali, Lesser Sunda Islands, Indonesia',
    endTime: '04:09:43',
    endLocation: 'Indomaret Fresh, Jalan Bypass Ngurah Rai, Kuta, Badung, Bali',
    mileageKm: 83.38,
    travelTime: '02:20:15',
    travelMinutes: 140.25,
    avgSpeedKmh: 35.67,
    maxSpeedKmh: 71.00,
    fuelPer100Km: 0.0,
    totalFuelLiters: 0.0,
    startLat: -8.3956,
    startLng: 114.7764,
    endLat: -8.7233,
    endLng: 115.1812,
    stopBeforeMinutes: 4,
    stopBeforeStart: '01:45:48',
    stopBeforeEnd: '01:49:28',
    matchedStoreName: 'INDOMARET FRESH BYPASS NGURAH RAI KUTA',
    matchedStoreKecamatan: 'Kuta',
    matchedStoreKabupaten: 'Badung'
  },
  {
    legNumber: 20,
    dateGroup: '2026-10-26',
    startTime: '00:45:28',
    startLocation: 'Gilimanuk, Jembrana, Bali, Lesser Sunda Islands',
    endTime: '01:45:48',
    endLocation: 'Yeh Sumbul, Jembrana, Bali, Lesser Sunda Islands, Indonesia',
    mileageKm: 52.98,
    travelTime: '01:00:19',
    travelMinutes: 60.32,
    avgSpeedKmh: 52.70,
    maxSpeedKmh: 79.00,
    fuelPer100Km: 0.0,
    totalFuelLiters: 0.0,
    startLat: -8.1628,
    startLng: 114.4382,
    endLat: -8.3956,
    endLng: 114.7764,
    stopBeforeMinutes: 33,
    stopBeforeStart: '00:12:04',
    stopBeforeEnd: '00:45:28',
    matchedStoreName: 'MITRA PLASTIK YEH SUMBUL',
    matchedStoreKecamatan: 'Mendoyo',
    matchedStoreKabupaten: 'Jembrana'
  },
  {
    legNumber: 21,
    dateGroup: '2026-10-26',
    startTime: '00:06:06',
    startLocation: 'Gilimanuk, Jembrana, Bali, Lesser Sunda Islands, Indonesia',
    endTime: '00:12:04',
    endLocation: 'Gilimanuk, Jembrana, Bali, Lesser Sunda Islands, 82252, Indonesia',
    mileageKm: 1.54,
    travelTime: '00:05:58',
    travelMinutes: 5.97,
    avgSpeedKmh: 15.46,
    maxSpeedKmh: 45.00,
    fuelPer100Km: 0.0,
    totalFuelLiters: 0.0,
    startLat: -8.1628,
    startLng: 114.4382,
    endLat: -8.1628,
    endLng: 114.4382,
    stopBeforeMinutes: 87,
    stopBeforeStart: '22:38:46',
    stopBeforeEnd: '00:06:06',
    matchedStoreName: 'SWT MART GILIMANUK',
    matchedStoreKecamatan: 'Melaya',
    matchedStoreKabupaten: 'Jembrana'
  },

  // 2026-10-25 (5 trips)
  {
    legNumber: 22,
    dateGroup: '2026-10-25',
    startTime: '22:37:56',
    startLocation: 'Ketapang, 21, Ketapang, Banyuwangi, Ketapang, East Java',
    endTime: '22:38:46',
    endLocation: 'Ketapang, 21, Ketapang, Banyuwangi, Ketapang, East Java, Java, 68451',
    mileageKm: 0.05,
    travelTime: '00:00:50',
    travelMinutes: 0.83,
    avgSpeedKmh: 3.74,
    maxSpeedKmh: 8.00,
    fuelPer100Km: 0.0,
    totalFuelLiters: 0.0,
    startLat: -8.1435,
    startLng: 114.3975,
    endLat: -8.1435,
    endLng: 114.3975,
    stopBeforeMinutes: 22,
    stopBeforeStart: '22:15:37',
    stopBeforeEnd: '22:37:56',
    matchedStoreName: 'INDOMARKET & ALFAMART KETAPANG',
    matchedStoreKecamatan: 'Kalipuro',
    matchedStoreKabupaten: 'Banyuwangi'
  },
  {
    legNumber: 23,
    dateGroup: '2026-10-25',
    startTime: '22:14:52',
    startLocation: '21, Ketapang, Banyuwangi, Ketapang, Banyuwangi',
    endTime: '22:15:37',
    endLocation: 'Pier 1 Ketapang ferry port, 21, Ketapang, Banyuwangi, Ketapang, Banyuwangi',
    mileageKm: 0.17,
    travelTime: '00:00:45',
    travelMinutes: 0.75,
    avgSpeedKmh: 13.28,
    maxSpeedKmh: 19.00,
    fuelPer100Km: 0.0,
    totalFuelLiters: 0.0,
    startLat: -8.1435,
    startLng: 114.3975,
    endLat: -8.1420,
    endLng: 114.4010,
    stopBeforeMinutes: 83,
    stopBeforeStart: '20:51:42',
    stopBeforeEnd: '22:14:52',
    matchedStoreName: 'Area Antrean Pelabuhan Ketapang (Non-Toko)',
    matchedStoreKecamatan: 'Kalipuro',
    matchedStoreKabupaten: 'Banyuwangi'
  },
  {
    legNumber: 24,
    dateGroup: '2026-10-25',
    startTime: '20:51:12',
    startLocation: 'Indomarket, 1;3, Ketapang, Banyuwangi, Ketapang',
    endTime: '20:51:42',
    endLocation: 'Alfamart, 1;AH2, Ketapang, Banyuwangi, Ketapang, Banyuwangi, East Java, 68451',
    mileageKm: 0.08,
    travelTime: '00:00:30',
    travelMinutes: 0.50,
    avgSpeedKmh: 9.16,
    maxSpeedKmh: 11.00,
    fuelPer100Km: 0.0,
    totalFuelLiters: 0.0,
    startLat: -8.1432,
    startLng: 114.3976,
    endLat: -8.1435,
    endLng: 114.3978,
    stopBeforeMinutes: 10,
    stopBeforeStart: '20:40:52',
    stopBeforeEnd: '20:51:12',
    matchedStoreName: 'INDOMARKET & ALFAMART KETAPANG',
    matchedStoreKecamatan: 'Kalipuro',
    matchedStoreKabupaten: 'Banyuwangi'
  },
  {
    legNumber: 25,
    dateGroup: '2026-10-25',
    startTime: '20:38:06',
    startLocation: 'Pertamina, Jalan Gatot Subroto, 03, Krajan, Bulusan',
    endTime: '20:40:52',
    endLocation: '21, Ketapang, Banyuwangi, Ketapang, Banyuwangi, East Java, Java, 68451',
    mileageKm: 0.99,
    travelTime: '00:02:46',
    travelMinutes: 2.77,
    avgSpeedKmh: 21.50,
    maxSpeedKmh: 44.00,
    fuelPer100Km: 0.0,
    totalFuelLiters: 0.0,
    startLat: -8.1990,
    startLng: 114.3730,
    endLat: -8.1435,
    endLng: 114.3975,
    stopBeforeMinutes: 6,
    stopBeforeStart: '20:32:20',
    stopBeforeEnd: '20:38:06',
    matchedStoreName: 'HOTEL KETAPANG INDAH',
    matchedStoreKecamatan: 'Kalipuro',
    matchedStoreKabupaten: 'Banyuwangi'
  },
  {
    legNumber: 26,
    dateGroup: '2026-10-25',
    startTime: '20:22:13',
    startLocation: 'Gereja Advent Hari Ketujuh, Jalan Argopuro, Lingkungan Sukowidi, Banyuwangi (Gudang DC)',
    endTime: '20:32:20',
    endLocation: 'Pertamina, Jalan Gatot Subroto, 03, Krajan, Bulusan, Bulusan Wetan, Banyuwangi',
    mileageKm: 5.77,
    travelTime: '00:10:06',
    travelMinutes: 10.10,
    avgSpeedKmh: 34.28,
    maxSpeedKmh: 55.00,
    fuelPer100Km: 0.0,
    totalFuelLiters: 0.0,
    startLat: -8.1906,
    startLng: 114.3708,
    endLat: -8.1990,
    endLng: 114.3730,
    stopBeforeMinutes: 0,
    matchedStoreName: 'Gudang Pusat PT AKK Banyuwangi DC',
    matchedStoreKecamatan: 'Kalipuro',
    matchedStoreKabupaten: 'Banyuwangi'
  }
];

export const DEFAULT_TRACKSOLID_DATE_SUBTOTALS: TracksolidDateSubtotal[] = [
  {
    dateGroup: '2026-10-26',
    tripCount: 21,
    totalMileageKm: 294.90,
    travelTime: '08:51:14',
    avgSpeedKmh: 33.31,
    maxSpeedKmh: 79.00,
    fuelPer100Km: 0.0,
    totalFuelLiters: 0.0
  },
  {
    dateGroup: '2026-10-25',
    tripCount: 5,
    totalMileageKm: 7.05,
    travelTime: '00:14:57',
    avgSpeedKmh: 28.31,
    maxSpeedKmh: 55.00,
    fuelPer100Km: 0.0,
    totalFuelLiters: 0.0
  }
];

export const DEFAULT_TRACKSOLID_BOTTOM_SUMMARY: TracksolidBottomSummary = {
  trips: 26,
  totalMileageKm: 301.95,
  duration: '09:06:11',
  avgSpeedKmh: 33.17,
  maxSpeedKmh: 79.00,
  totalFuelConsumptionLiters: 0.00
};

// Helper to match a location/coord against registered stores in Jaringan Toko & Mitra
function findMatchingRegisteredStore(
  lat: number,
  lng: number,
  locationText: string,
  registeredStores: RetailStore[]
): { store: RetailStore | null; distanceKm: number; isNonStoreKeyword: boolean } {
  const locLower = String(locationText || '').toLowerCase();

  // Keywords that explicitly indicate non-customer locations (Ferry port, SPBU/Gas Station, Rest Area, Gudang DC)
  const nonCustomerKeywords = [
    'pier 1 ketapang',
    'pier 4 gilimanuk',
    'ferry port',
    'gas station buluh indah',
    'pertamina, jalan gatot subroto',
    'gereja advent',
    'lingkungan sukowidi desa klatak',
    'pick up?, jalan raya denpasar-gilimanuk'
  ];
  const isExplicitNonStore = nonCustomerKeywords.some(k => locLower.includes(k));
  if (isExplicitNonStore) {
    return { store: null, distanceKm: 99, isNonStoreKeyword: true };
  }

  let closestStore: RetailStore | null = null;
  let minDistance = 1.8; // 1.8 km radius for store stop detection

  for (const st of registeredStores) {
    const stNameLower = st.storeName.toLowerCase();
    // Exact name match in address
    if (stNameLower.length > 4 && locLower.includes(stNameLower)) {
      const d = calculateDistanceKm(lat, lng, st.latitude, st.longitude);
      return { store: st, distanceKm: d, isNonStoreKeyword: false };
    }

    const dist = calculateDistanceKm(lat, lng, st.latitude, st.longitude);
    if (dist < minDistance) {
      minDistance = dist;
      closestStore = st;
    }
  }

  return { store: closestStore, distanceKm: minDistance, isNonStoreKeyword: false };
}

function buildEvaluationFromLegs(
  legs: TracksolidTripLeg[],
  subtotals: TracksolidDateSubtotal[],
  bottom: TracksolidBottomSummary,
  meta: {
    fileName: string;
    fleetId: string;
    plateNumber: string;
    initialCode: string;
    driverName: string;
    helperName: string;
    gpsPlatform: 'tracksolid' | 'wanway';
    uploadedMonth: string;
    uploadedYear: string;
  },
  registeredStores: RetailStore[]
): TrackingEvaluation {
  // Sort legs chronologically (oldest date + earliest time first) to build the true continuous GPS road track
  const chronologicalLegs = [...legs].sort((a, b) => {
    const dtA = `${a.dateGroup} ${a.startTime}`;
    const dtB = `${b.dateGroup} ${b.startTime}`;
    return dtA.localeCompare(dtB);
  });

  const points: TrackingPoint[] = [];
  const stops: RouteStop[] = [];
  let stopSeq = 1;

  chronologicalLegs.forEach(leg => {
    points.push({
      timestamp: `${leg.dateGroup} ${leg.startTime}`,
      latitude: leg.startLat,
      longitude: leg.startLng,
      speed: Number(leg.avgSpeedKmh),
      engineStatus: 'RUNNING',
      locationName: `${meta.plateNumber} • ${leg.startLocation}`
    });
    points.push({
      timestamp: `${leg.dateGroup} ${leg.endTime}`,
      latitude: leg.endLat,
      longitude: leg.endLng,
      speed: 0,
      engineStatus: 'STOP',
      locationName: `${meta.plateNumber} • ${leg.endLocation}`
    });

    const stopDur = leg.stopBeforeMinutes || 0;
    if (stopDur > 0) {
      const matchInfo = findMatchingRegisteredStore(
        leg.startLat,
        leg.startLng,
        leg.startLocation,
        registeredStores
      );
      const isCustomer = Boolean(matchInfo.store);
      const isLongNonCustomer = !isCustomer && stopDur >= 15;

      stops.push({
        stopNumber: stopSeq++,
        startTime: leg.stopBeforeStart || leg.startTime,
        endTime: leg.stopBeforeEnd || leg.startTime,
        durationMinutes: stopDur,
        latitude: leg.startLat,
        longitude: leg.startLng,
        locationName: leg.startLocation,
        matchedStoreName: matchInfo.store?.storeName,
        matchedStoreRegion: matchInfo.store ? getStoreLocationType(matchInfo.store) : undefined,
        isCustomerStore: isCustomer,
        isLongNonCustomerStop: isLongNonCustomer,
        fleetPlate: meta.plateNumber,
        reason: isCustomer
          ? 'Retail Unloading'
          : isLongNonCustomer
          ? 'Berhenti Lama Non-Mitra'
          : 'Driver Rest / Meals'
      });
    }
  });

  const totalIdle = stops.reduce((acc, s) => acc + s.durationMinutes, 0);

  return {
    fileName: meta.fileName,
    fleetId: meta.fleetId,
    plateNumber: meta.plateNumber,
    initialCode: meta.initialCode,
    driverName: meta.driverName,
    helperName: meta.helperName,
    gpsPlatform: meta.gpsPlatform,
    uploadedMonth: meta.uploadedMonth,
    uploadedYear: meta.uploadedYear,
    totalPoints: points.length,
    totalDistanceKm: bottom.totalMileageKm,
    durationHours: Number(( (parseTimeSeconds(bottom.duration) || 32771) / 3600 ).toFixed(1)),
    avgSpeedKmh: bottom.avgSpeedKmh,
    maxSpeedKmh: bottom.maxSpeedKmh,
    totalIdleMinutes: totalIdle,
    routeDeviationKm: 0,
    isWithinRouteTolerance: true,
    onTimeStatus: 'On-Time',
    delayMinutes: 0,
    stops,
    points,
    tripLegs: legs,
    dateSubtotals: subtotals,
    bottomSummary: bottom
  };
}

const MONTHS_ID = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember'
];

export const ExcelTrackingEvaluator: React.FC = () => {
  const registeredStores = useMemo(() => logisticsStore.getStores(), []);
  const fleets = useMemo(() => logisticsStore.getFleets(), []);

  // Multi-Fleet Evaluations State (Supports 1 or multiple uploaded fleets)
  const [fleetEvaluations, setFleetEvaluations] = useState<TrackingEvaluation[]>(() => {
    const defaultFleet = fleets.find(f => f.plateNumber.includes('8381')) || fleets[0];
    return [
      buildEvaluationFromLegs(
        DEFAULT_TRACKSOLID_26_LEGS,
        DEFAULT_TRACKSOLID_DATE_SUBTOTALS,
        DEFAULT_TRACKSOLID_BOTTOM_SUMMARY,
        {
          fileName: 'Evaluasi_Rute_P8381VE.xlsx',
          fleetId: defaultFleet?.id || 'flt-02',
          plateNumber: defaultFleet?.plateNumber || 'P 8381 VE',
          initialCode: defaultFleet?.initialCode || 'N2 / NP2',
          driverName: 'Budiono',
          helperName: 'Saifur Rizal',
          gpsPlatform: 'tracksolid',
          uploadedMonth: 'Oktober',
          uploadedYear: '2026'
        },
        logisticsStore.getStores()
      )
    ];
  });

  // Active selected fleet index or 'all'
  const [selectedFleetPlate, setSelectedFleetPlate] = useState<string>(() => {
    return fleetEvaluations[0]?.plateNumber || 'P 8381 VE';
  });

  // View Mode: 'evaluation' (Main Maps & Unified Analysis) vs 'upload_form' (Image 2 style upload screen)
  const [viewMode, setViewMode] = useState<'evaluation' | 'upload_form'>('evaluation');
  const [showUploadHistory, setShowUploadHistory] = useState<boolean>(false);

  // Upload Form States (Matching Image 2 + Tracksolid/Wanway + 1 or Multiple Fleets)
  const [uploadMonth, setUploadMonth] = useState<string>('Oktober');
  const [uploadYear, setUploadYear] = useState<string>('2026');
  const [gpsPlatform, setGpsPlatform] = useState<'tracksolid' | 'wanway'>('tracksolid');
  const [fleetScopeMode, setFleetScopeMode] = useState<'single' | 'multiple'>('single');
  const [selectedSingleFleetId, setSelectedSingleFleetId] = useState<string>(() => fleets[0]?.id || 'flt-01');
  const [selectedMultiFleetIds, setSelectedMultiFleetIds] = useState<string[]>(() =>
    fleets.slice(0, 2).map(f => f.id)
  );
  const [importMode, setImportMode] = useState<'append' | 'replace'>('append');
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);

  // Unified Tabs:
  // 1. 'map' -> Peta Rute GPS & Rincian Harian Armada
  // 2. 'unified_stops_customer' -> Armada Bergerak, Berhenti & Analisa Kirim ke Pelanggan (Jaringan Toko & Mitra)
  // 3. 'speed_summary' -> Profil Kecepatan & Rekapitulasi Harian
  const [activeTab, setActiveTab] = useState<'map' | 'unified_stops_customer' | 'speed_summary'>('map');

  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [selectedDateGroup, setSelectedDateGroup] = useState<string>('all');
  const [activityFilter, setActivityFilter] = useState<
    'all' | 'customer_stop' | 'long_non_customer' | 'moving_only'
  >('all');
  const [searchFilter, setSearchFilter] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Current active evaluation based on selectedFleetPlate
  const activeEvaluation = useMemo(() => {
    if (selectedFleetPlate === 'all') {
      // Combine all uploaded fleet evaluations
      const allLegs: TracksolidTripLeg[] = [];
      const allPoints: TrackingPoint[] = [];
      const allStops: RouteStop[] = [];
      const subtotalMap = new Map<string, TracksolidDateSubtotal>();

      fleetEvaluations.forEach(ev => {
        (ev.tripLegs || []).forEach(l => allLegs.push(l));
        (ev.points || []).forEach(p => allPoints.push(p));
        (ev.stops || []).forEach(s => allStops.push(s));
        (ev.dateSubtotals || []).forEach(ds => {
          const existing = subtotalMap.get(ds.dateGroup);
          if (!existing) {
            subtotalMap.set(ds.dateGroup, { ...ds });
          } else {
            const totalTrips = existing.tripCount + ds.tripCount;
            const totalKm = Number((existing.totalMileageKm + ds.totalMileageKm).toFixed(2));
            const sec1 = parseTimeSeconds(existing.travelTime) || 0;
            const sec2 = parseTimeSeconds(ds.travelTime) || 0;
            const avgSpd = Number(((existing.avgSpeedKmh + ds.avgSpeedKmh) / 2).toFixed(2));
            const maxSpd = Math.max(existing.maxSpeedKmh, ds.maxSpeedKmh);
            subtotalMap.set(ds.dateGroup, {
              dateGroup: ds.dateGroup,
              tripCount: totalTrips,
              totalMileageKm: totalKm,
              travelTime: formatSecondsToHMS(sec1 + sec2),
              avgSpeedKmh: avgSpd,
              maxSpeedKmh: maxSpd,
              fuelPer100Km: 0,
              totalFuelLiters: 0
            });
          }
        });
      });

      const combinedSubtotals = Array.from(subtotalMap.values()).sort((a, b) =>
        b.dateGroup.localeCompare(a.dateGroup)
      );
      const totalTrips = allLegs.length;
      const totalKm = Number(allLegs.reduce((s, l) => s + l.mileageKm, 0).toFixed(2));
      const totalDurationSec = combinedSubtotals.reduce(
        (s, d) => s + (parseTimeSeconds(d.travelTime) || 0),
        0
      );
      const avgSpeed =
        allLegs.length > 0
          ? Number((allLegs.reduce((s, l) => s + l.avgSpeedKmh, 0) / allLegs.length).toFixed(2))
          : 0;
      const maxSpeed = allLegs.length > 0 ? Math.max(...allLegs.map(l => l.maxSpeedKmh)) : 0;

      return {
        ...fleetEvaluations[0],
        plateNumber: `Semua Armada (${fleetEvaluations.length} Unit)`,
        totalPoints: allPoints.length,
        totalDistanceKm: totalKm,
        avgSpeedKmh: avgSpeed,
        maxSpeedKmh: maxSpeed,
        points: allPoints,
        stops: allStops,
        tripLegs: allLegs,
        dateSubtotals: combinedSubtotals,
        bottomSummary: {
          trips: totalTrips,
          totalMileageKm: totalKm,
          duration: formatSecondsToHMS(totalDurationSec),
          avgSpeedKmh: avgSpeed,
          maxSpeedKmh: maxSpeed,
          totalFuelConsumptionLiters: 0
        }
      } as TrackingEvaluation;
    }

    return (
      fleetEvaluations.find(e => e.plateNumber === selectedFleetPlate) ||
      fleetEvaluations[0]
    );
  }, [fleetEvaluations, selectedFleetPlate]);

  // Unified Analysis combining Moving Legs, Stop Duration, Customer Store Matching, and Non-Customer Long Stop Warnings
  const unifiedRows = useMemo(() => {
    const evalList =
      selectedFleetPlate === 'all' ? fleetEvaluations : [activeEvaluation].filter(Boolean);

    const results: Array<{
      id: string;
      fleetPlate: string;
      fleetInitial: string;
      gpsPlatform: 'tracksolid' | 'wanway';
      legNumber: number;
      dateGroup: string;
      startTime: string;
      endTime: string;
      startLocation: string;
      endLocation: string;
      travelTime: string;
      mileageKm: number;
      avgSpeedKmh: number;
      maxSpeedKmh: number;
      stopDurationMinutes: number;
      stopStart: string;
      stopEnd: string;
      matchedStore: RetailStore | null;
      distanceToStoreKm: number;
      stopCategory: 'customer_store' | 'long_non_customer' | 'short_transit' | 'moving_no_stop';
      regionType: 'dalam_kota' | 'luar_kota' | 'luar_pulau';
      nomorToko: string | number;
      namaTokoAtauLokasi: string;
      kecamatan: string;
      kabupaten: string;
    }> = [];

    evalList.forEach(ev => {
      const legs = ev.tripLegs || [];
      legs.forEach(leg => {
        const stopMinutes = leg.stopBeforeMinutes || 0;
        // Match stop location (where vehicle stopped before/at this leg) against Jaringan Toko & Mitra
        const matchStart = findMatchingRegisteredStore(
          leg.startLat,
          leg.startLng,
          leg.startLocation,
          registeredStores
        );
        const matchEnd = findMatchingRegisteredStore(
          leg.endLat,
          leg.endLng,
          leg.endLocation,
          registeredStores
        );

        const matchedStore = matchStart.store || matchEnd.store;
        const bestDist = matchStart.store ? matchStart.distanceKm : matchEnd.distanceKm;

        let stopCategory: 'customer_store' | 'long_non_customer' | 'short_transit' | 'moving_no_stop' =
          'moving_no_stop';

        if (stopMinutes > 0) {
          if (matchedStore && !matchStart.isNonStoreKeyword) {
            stopCategory = 'customer_store';
          } else if (stopMinutes >= 15) {
            stopCategory = 'long_non_customer';
          } else {
            stopCategory = 'short_transit';
          }
        } else if (matchedStore) {
          stopCategory = 'customer_store';
        }

        const locType = matchedStore
          ? getStoreLocationType(matchedStore)
          : leg.startLng > 114.432 || leg.endLng > 114.432
          ? 'luar_pulau'
          : leg.startLat <= -7.75 && leg.startLat >= -8.85 && leg.startLng <= 114.432
          ? 'dalam_kota'
          : 'luar_kota';

        results.push({
          id: `${ev.plateNumber}-${leg.dateGroup}-${leg.legNumber}`,
          fleetPlate: ev.plateNumber || 'P 8381 VE',
          fleetInitial: ev.initialCode || 'N2 / NP2',
          gpsPlatform: ev.gpsPlatform || 'tracksolid',
          legNumber: leg.legNumber,
          dateGroup: leg.dateGroup,
          startTime: leg.startTime,
          endTime: leg.endTime,
          startLocation: leg.startLocation,
          endLocation: leg.endLocation,
          travelTime: leg.travelTime,
          mileageKm: leg.mileageKm,
          avgSpeedKmh: leg.avgSpeedKmh,
          maxSpeedKmh: leg.maxSpeedKmh,
          stopDurationMinutes: stopMinutes,
          stopStart: leg.stopBeforeStart || leg.endTime,
          stopEnd: leg.stopBeforeEnd || leg.startTime,
          matchedStore,
          distanceToStoreKm: Number(bestDist.toFixed(2)),
          stopCategory,
          regionType: locType,
          nomorToko: matchedStore?.nomor ?? '-',
          namaTokoAtauLokasi: matchedStore
            ? matchedStore.storeName
            : leg.startLocation.split(',')[0] || leg.endLocation.split(',')[0],
          kecamatan: matchedStore?.kecamatan || leg.matchedStoreKecamatan || '-',
          kabupaten:
            matchedStore?.kabupaten ||
            leg.matchedStoreKabupaten ||
            (locType === 'dalam_kota' ? 'Banyuwangi' : locType === 'luar_kota' ? 'Jatim' : 'Bali')
        });
      });
    });

    return results;
  }, [fleetEvaluations, activeEvaluation, selectedFleetPlate, registeredStores]);

  // Filtered unified rows
  const filteredUnifiedRows = useMemo(() => {
    return unifiedRows.filter(item => {
      if (selectedDateGroup !== 'all' && item.dateGroup !== selectedDateGroup) return false;
      if (activityFilter === 'customer_stop' && item.stopCategory !== 'customer_store') return false;
      if (activityFilter === 'long_non_customer' && item.stopCategory !== 'long_non_customer') return false;
      if (activityFilter === 'moving_only' && item.stopDurationMinutes > 0) return false;

      if (!searchFilter.trim()) return true;
      const q = searchFilter.toLowerCase();
      return (
        item.namaTokoAtauLokasi.toLowerCase().includes(q) ||
        item.kecamatan.toLowerCase().includes(q) ||
        item.kabupaten.toLowerCase().includes(q) ||
        item.startLocation.toLowerCase().includes(q) ||
        item.endLocation.toLowerCase().includes(q) ||
        item.fleetPlate.toLowerCase().includes(q)
      );
    });
  }, [unifiedRows, selectedDateGroup, activityFilter, searchFilter]);

  // Summary counts for the unified tab
  const unifiedStats = useMemo(() => {
    const customerStops = unifiedRows.filter(r => r.stopCategory === 'customer_store');
    const longNonCustomerStops = unifiedRows.filter(r => r.stopCategory === 'long_non_customer');
    const shortTransits = unifiedRows.filter(r => r.stopCategory === 'short_transit');
    return {
      totalLegs: unifiedRows.length,
      customerStopsCount: customerStops.length,
      longNonCustomerCount: longNonCustomerStops.length,
      shortTransitCount: shortTransits.length
    };
  }, [unifiedRows]);

  // Speed profile data for Recharts
  const speedChartData = useMemo(() => {
    const legs = activeEvaluation?.tripLegs || [];
    return [...legs].reverse().map(leg => ({
      name: `#${leg.legNumber} (${leg.startTime.slice(0, 5)})`,
      legNumber: leg.legNumber,
      time: leg.startTime,
      date: leg.dateGroup,
      avgSpeed: Number(leg.avgSpeedKmh.toFixed(1)),
      maxSpeed: Number(leg.maxSpeedKmh.toFixed(1)),
      mileage: Number(leg.mileageKm.toFixed(1)),
      location: leg.startLocation.split(',')[0]
    }));
  }, [activeEvaluation]);

  // Parse a single Excel file (Tracksolid or Wanway) and return a TrackingEvaluation for a given fleet
  const parseExcelFileForFleet = (
    file: File,
    targetFleet: Fleet,
    platform: 'tracksolid' | 'wanway'
  ): Promise<TrackingEvaluation> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = evt => {
        try {
          const data = evt.target?.result;
          const workbook = XLSX.read(data, { type: 'binary' });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

          if (!rows || rows.length < 2) {
            throw new Error(`File "${file.name}" tidak memiliki baris data perjalanan GPS yang valid.`);
          }

          let headerRowIndex = -1;
          for (let i = 0; i < Math.min(12, rows.length); i++) {
            const rowStr = rows[i].map((c: any) => String(c).toLowerCase()).join(' ');
            if (
              rowStr.includes('start time') ||
              rowStr.includes('start location') ||
              rowStr.includes('total mileage') ||
              rowStr.includes('waktu') ||
              rowStr.includes('latitude') ||
              rowStr.includes('kecepatan') ||
              rowStr.includes('speed')
            ) {
              headerRowIndex = i;
              break;
            }
          }

          if (headerRowIndex === -1) {
            headerRowIndex = 0;
          }

          const headers = rows[headerRowIndex].map((h: any) => String(h).trim().toLowerCase());
          const colStartTime = headers.findIndex((h: string) =>
            h.includes('start time') || h.includes('waktu mulai') || h.includes('time') || h.includes('waktu')
          );
          const colStartLoc = headers.findIndex((h: string) =>
            h.includes('start location') || h.includes('start loc') || h.includes('lokasi awal') || h.includes('location') || h.includes('alamat')
          );
          const colEndTime = headers.findIndex((h: string) =>
            h.includes('end time') || h.includes('waktu selesai')
          );
          const colEndLoc = headers.findIndex((h: string) =>
            h.includes('end location') || h.includes('end loc') || h.includes('lokasi akhir') || h.includes('tujuan')
          );
          const colMileage = headers.findIndex((h: string) =>
            h.includes('mileage') || h.includes('total mileage') || h.includes('jarak') || h.includes('km')
          );
          const colTravelTime = headers.findIndex((h: string) =>
            h.includes('travel time') || h.includes('durasi') || h.includes('duration')
          );
          const colAvgSpeed = headers.findIndex((h: string) =>
            h.includes('average speed') || h.includes('avg speed') || h.includes('rata-rata') || h.includes('speed')
          );
          const colMaxSpeed = headers.findIndex((h: string) =>
            h.includes('max. speed') || h.includes('max speed') || h.includes('maks')
          );
          const colLat = headers.findIndex((h: string) => h === 'lat' || h.includes('latitude'));
          const colLng = headers.findIndex((h: string) => h === 'lng' || h === 'lon' || h.includes('longitude'));

          const parsedLegs: TracksolidTripLeg[] = [];
          const dateSubtotals: TracksolidDateSubtotal[] = [];
          const bottomSummary: TracksolidBottomSummary = {
            trips: 0,
            totalMileageKm: 0,
            duration: '00:00:00',
            avgSpeedKmh: 0,
            maxSpeedKmh: 0,
            totalFuelConsumptionLiters: 0
          };

          let currentDateGroup = '2026-10-26';
          let legCounter = 1;

          for (let i = headerRowIndex + 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row || row.every((c: any) => String(c).trim() === '')) continue;

            const cell0 = String(row[0] || '').trim();
            const cell0Lower = cell0.toLowerCase();

            // Check Bottom Summary rows
            if (cell0Lower === 'trips' || cell0Lower.startsWith('trips')) {
              const val = Number(row[1]);
              if (!isNaN(val) && val > 0) {
                bottomSummary.trips = val;
                continue;
              }
            }
            if (cell0Lower.includes('total mileage')) {
              bottomSummary.totalMileageKm = Number(row[1]) || 0;
              continue;
            }
            if (cell0Lower === 'duration') {
              bottomSummary.duration = String(row[1] || '00:00:00');
              continue;
            }
            if (cell0Lower.includes('average speed')) {
              bottomSummary.avgSpeedKmh = Number(row[1]) || 0;
              continue;
            }
            if (cell0Lower.includes('max. speed') || cell0Lower.includes('max speed')) {
              bottomSummary.maxSpeedKmh = Number(row[1]) || 0;
              continue;
            }
            if (cell0Lower.includes('total fuel')) {
              continue;
            }

            // Date group header row (e.g., 2026-10-26)
            if (cell0.match(/^\d{4}-\d{2}-\d{2}$/)) {
              currentDateGroup = cell0;
              continue;
            }

            // Daily subtotal row ('Total')
            if (cell0Lower === 'total') {
              dateSubtotals.push({
                dateGroup: currentDateGroup,
                tripCount: parsedLegs.filter(l => l.dateGroup === currentDateGroup).length,
                totalMileageKm: colMileage >= 0 ? Number(row[colMileage]) || 0 : 0,
                travelTime: colTravelTime >= 0 ? String(row[colTravelTime] || '00:00:00') : '00:00:00',
                avgSpeedKmh: colAvgSpeed >= 0 ? Number(row[colAvgSpeed]) || 0 : 0,
                maxSpeedKmh: colMaxSpeed >= 0 ? Number(row[colMaxSpeed]) || 0 : 0,
                fuelPer100Km: 0,
                totalFuelLiters: 0
              });
              continue;
            }

            const rawStart = colStartTime >= 0 ? String(row[colStartTime] || '').trim() : cell0;
            const rawStartLoc =
              colStartLoc >= 0 ? String(row[colStartLoc] || '').trim() : String(row[1] || '').trim();
            const rawEnd = colEndTime >= 0 ? String(row[colEndTime] || '').trim() : rawStart;
            const rawEndLoc =
              colEndLoc >= 0 ? String(row[colEndLoc] || '').trim() : rawStartLoc;

            // Extract date if embedded in timestamp (e.g. "2026-10-26 08:15:00")
            let timeOnlyStart = rawStart;
            const dtMatch = rawStart.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{1,2}:\d{2}(?::\d{2})?)/);
            if (dtMatch) {
              currentDateGroup = dtMatch[1];
              timeOnlyStart = dtMatch[2];
            }

            let timeOnlyEnd = rawEnd;
            const dtEndMatch = rawEnd.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{1,2}:\d{2}(?::\d{2})?)/);
            if (dtEndMatch) {
              timeOnlyEnd = dtEndMatch[2];
            }

            if (timeOnlyStart && (rawStartLoc || (colLat >= 0 && colLng >= 0))) {
              const mileageVal = colMileage >= 0 ? Number(row[colMileage]) || 0 : 2.5;
              const travelTimeVal =
                colTravelTime >= 0 && row[colTravelTime]
                  ? String(row[colTravelTime])
                  : '00:10:00';
              const avgSpeedVal = colAvgSpeed >= 0 ? Number(row[colAvgSpeed]) || 28 : 28;
              const maxSpeedVal =
                colMaxSpeed >= 0 ? Number(row[colMaxSpeed]) || avgSpeedVal + 12 : avgSpeedVal + 12;

              let sLat = 0;
              let sLng = 0;
              if (colLat >= 0 && colLng >= 0 && Number(row[colLat]) && Number(row[colLng])) {
                sLat = Number(row[colLat]);
                sLng = Number(row[colLng]);
              } else {
                [sLat, sLng] = resolveTracksolidCoords(rawStartLoc, legCounter, registeredStores);
              }

              const [eLat, eLng] =
                rawEndLoc && rawEndLoc !== rawStartLoc
                  ? resolveTracksolidCoords(rawEndLoc, legCounter + 1, registeredStores)
                  : [sLat, sLng];

              parsedLegs.push({
                legNumber: legCounter++,
                dateGroup: currentDateGroup,
                startTime: timeOnlyStart,
                startLocation: rawStartLoc || `${sLat}, ${sLng}`,
                endTime: timeOnlyEnd || timeOnlyStart,
                endLocation: rawEndLoc || rawStartLoc || `${eLat}, ${eLng}`,
                mileageKm: mileageVal,
                travelTime: travelTimeVal,
                travelMinutes: Math.max(1, Math.round((parseTimeSeconds(travelTimeVal) || 600) / 60)),
                avgSpeedKmh: avgSpeedVal,
                maxSpeedKmh: maxSpeedVal,
                fuelPer100Km: 0,
                totalFuelLiters: 0,
                startLat: sLat,
                startLng: sLng,
                endLat: eLat,
                endLng: eLng
              });
            }
          }

          if (parsedLegs.length === 0) {
            throw new Error(`Tidak ditemukan baris perjalanan GPS yang valid pada file "${file.name}".`);
          }

          // Calculate accurate Stop Durations (in minutes) between consecutive trips
          // Detect whether rows are reverse-chronological (Tracksolid default) or chronological
          const isReverseChronological =
            parsedLegs.length >= 2 &&
            `${parsedLegs[0].dateGroup} ${parsedLegs[0].startTime}` >
              `${parsedLegs[parsedLegs.length - 1].dateGroup} ${parsedLegs[parsedLegs.length - 1].startTime}`;

          for (let idx = 0; idx < parsedLegs.length; idx++) {
            const current = parsedLegs[idx];
            const prevTrip = isReverseChronological ? parsedLegs[idx + 1] : parsedLegs[idx - 1];
            if (prevTrip) {
              current.stopBeforeStart = prevTrip.endTime;
              current.stopBeforeEnd = current.startTime;
              current.stopBeforeMinutes = computeStopMinutesBetween(
                prevTrip.endTime,
                current.startTime
              );
            } else {
              current.stopBeforeMinutes = 0;
            }
          }

          // Build per-date subtotals if not explicitly present in the Excel file
          if (dateSubtotals.length === 0) {
            const byDate = new Map<string, TracksolidTripLeg[]>();
            parsedLegs.forEach(l => {
              const list = byDate.get(l.dateGroup) || [];
              list.push(l);
              byDate.set(l.dateGroup, list);
            });
            byDate.forEach((legsOnDate, dateKey) => {
              const km = Number(legsOnDate.reduce((s, l) => s + l.mileageKm, 0).toFixed(2));
              const sec = legsOnDate.reduce(
                (s, l) => s + (parseTimeSeconds(l.travelTime) || 0),
                0
              );
              const avg = Number(
                (legsOnDate.reduce((s, l) => s + l.avgSpeedKmh, 0) / legsOnDate.length).toFixed(2)
              );
              const max = Math.max(...legsOnDate.map(l => l.maxSpeedKmh));
              dateSubtotals.push({
                dateGroup: dateKey,
                tripCount: legsOnDate.length,
                totalMileageKm: km,
                travelTime: formatSecondsToHMS(sec),
                avgSpeedKmh: avg,
                maxSpeedKmh: max,
                fuelPer100Km: 0,
                totalFuelLiters: 0
              });
            });
          }

          if (!bottomSummary.trips || bottomSummary.trips === 0) {
            bottomSummary.trips = parsedLegs.length;
          }
          if (!bottomSummary.totalMileageKm || bottomSummary.totalMileageKm === 0) {
            bottomSummary.totalMileageKm = Number(
              parsedLegs.reduce((sum, l) => sum + l.mileageKm, 0).toFixed(2)
            );
          }
          if (!bottomSummary.duration || bottomSummary.duration === '00:00:00') {
            const totalSec = parsedLegs.reduce(
              (sum, l) => sum + (parseTimeSeconds(l.travelTime) || 0),
              0
            );
            bottomSummary.duration = formatSecondsToHMS(totalSec);
          }
          if (!bottomSummary.avgSpeedKmh || bottomSummary.avgSpeedKmh === 0) {
            bottomSummary.avgSpeedKmh = Number(
              (parsedLegs.reduce((sum, l) => sum + l.avgSpeedKmh, 0) / parsedLegs.length).toFixed(2)
            );
          }
          if (!bottomSummary.maxSpeedKmh || bottomSummary.maxSpeedKmh === 0) {
            bottomSummary.maxSpeedKmh = Math.max(...parsedLegs.map(l => l.maxSpeedKmh));
          }

          const evaluationObj = buildEvaluationFromLegs(
            parsedLegs,
            dateSubtotals,
            bottomSummary,
            {
              fileName: file.name,
              fleetId: targetFleet.id,
              plateNumber: targetFleet.plateNumber,
              initialCode: targetFleet.initialCode || 'ARMADA',
              driverName: 'Tim Pengiriman AKK',
              helperName: '-',
              gpsPlatform: platform,
              uploadedMonth: uploadMonth,
              uploadedYear: uploadYear
            },
            registeredStores
          );

          resolve(evaluationObj);
        } catch (err: any) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error(`Gagal membaca file "${file.name}".`));
      reader.readAsBinaryString(file);
    });
  };

  // Process staged files from the Image 2 style upload screen
  const handleProcessUploadForm = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    const targetFleets: Fleet[] =
      fleetScopeMode === 'single'
        ? [fleets.find(f => f.id === selectedSingleFleetId) || fleets[0]].filter(Boolean)
        : fleets.filter(f => selectedMultiFleetIds.includes(f.id));

    if (targetFleets.length === 0) {
      setErrorMessage('Pilih minimal 1 armada terlebih dahulu pada Spesifikasi Armada.');
      return;
    }

    if (stagedFiles.length === 0) {
      setErrorMessage('Pilih file Excel (.xls, .xlsx, .csv) Tracksolid / Wanway terlebih dahulu.');
      return;
    }

    setIsProcessing(true);
    try {
      const newEvaluations: TrackingEvaluation[] = [];

      if (fleetScopeMode === 'single') {
        const parsed = await parseExcelFileForFleet(stagedFiles[0], targetFleets[0], gpsPlatform);
        newEvaluations.push(parsed);
      } else {
        // Multi-fleet mode: pair uploaded files with selected fleets or apply file across selected fleets
        for (let i = 0; i < targetFleets.length; i++) {
          const fleet = targetFleets[i];
          const fileToUse = stagedFiles[i] || stagedFiles[0];
          const parsed = await parseExcelFileForFleet(fileToUse, fleet, gpsPlatform);
          newEvaluations.push(parsed);
        }
      }

      setFleetEvaluations(prev => {
        if (importMode === 'replace') {
          return newEvaluations;
        }
        const mapByPlate = new Map<string, TrackingEvaluation>();
        prev.forEach(item => mapByPlate.set(item.plateNumber || item.fileName, item));
        newEvaluations.forEach(item => mapByPlate.set(item.plateNumber || item.fileName, item));
        return Array.from(mapByPlate.values());
      });

      setSelectedFleetPlate(
        newEvaluations.length > 1 ? 'all' : newEvaluations[0].plateNumber || 'all'
      );
      setStagedFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setViewMode('evaluation');
      setSuccessMessage(
        `Berhasil memproses ${newEvaluations.length} armada (${newEvaluations
          .map(e => e.plateNumber)
          .join(', ')}) dari platform ${
          gpsPlatform === 'tracksolid' ? 'Tracksolid Pro' : 'WanwayTrack'
        } periode ${uploadMonth} ${uploadYear}.`
      );
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal memproses file Excel GPS.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Download template Excel (Tracksolid or Wanway) without Fuel columns
  const handleDownloadTemplate = () => {
    const sheetData: any[][] = [
      [
        'Start time',
        'Start location',
        'End time',
        'End location',
        'Total Mileage(km)',
        'Travel time',
        'Average Speed',
        'Max. speed(km/h)'
      ],
      ['2026-10-26']
    ];

    DEFAULT_TRACKSOLID_26_LEGS.filter(l => l.dateGroup === '2026-10-26').forEach(l => {
      sheetData.push([
        l.startTime,
        l.startLocation,
        l.endTime,
        l.endLocation,
        l.mileageKm,
        l.travelTime,
        l.avgSpeedKmh,
        l.maxSpeedKmh
      ]);
    });

    sheetData.push(['Total', '', '', '', 294.90, '08:51:14', 33.31, 79.00]);
    sheetData.push(['2026-10-25']);

    DEFAULT_TRACKSOLID_26_LEGS.filter(l => l.dateGroup === '2026-10-25').forEach(l => {
      sheetData.push([
        l.startTime,
        l.startLocation,
        l.endTime,
        l.endLocation,
        l.mileageKm,
        l.travelTime,
        l.avgSpeedKmh,
        l.maxSpeedKmh
      ]);
    });

    sheetData.push(['Total', '', '', '', 7.05, '00:14:57', 28.31, 55.00]);
    sheetData.push(['Trips', 26]);
    sheetData.push(['Total Mileage(km)', 301.95]);
    sheetData.push(['Duration', '09:06:11']);
    sheetData.push(['Average Speed (km/h)', 33.17]);
    sheetData.push(['Max. speed(km/h)', 79.00]);

    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    ws['!cols'] = [
      { wch: 14 },
      { wch: 48 },
      { wch: 14 },
      { wch: 48 },
      { wch: 18 },
      { wch: 14 },
      { wch: 16 },
      { wch: 18 }
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      ws,
      gpsPlatform === 'tracksolid' ? 'Template_Tracksolid' : 'Template_Wanway'
    );
    XLSX.writeFile(
      wb,
      `Template_Evaluasi_${gpsPlatform === 'tracksolid' ? 'Tracksolid' : 'Wanway'}_AKK.xlsx`
    );
  };

  // Export Unified Analysis to Excel (.XLSX)
  const handleExportUnifiedAnalysis = () => {
    const rows = unifiedRows.map(item => ({
      Armada: `${item.fleetPlate} [${item.fleetInitial}]`,
      Platform: item.gpsPlatform === 'tracksolid' ? 'Tracksolid' : 'Wanway',
      Ritase: `#${item.legNumber}`,
      Tanggal: item.dateGroup,
      'Jam Mulai Gerak': item.startTime,
      'Jam Selesai Gerak': item.endTime,
      'Durasi Gerak': item.travelTime,
      'Lama Berhenti (Menit)': `${item.stopDurationMinutes} Menit`,
      'Status Pemberhentian':
        item.stopCategory === 'customer_store'
          ? 'BERHENTI DI TOKO MITRA PELANGGAN'
          : item.stopCategory === 'long_non_customer'
          ? 'PERINGATAN: BERHENTI LAMA DI LUAR TOKO (NON-MITRA)'
          : item.stopCategory === 'short_transit'
          ? 'Transit Singkat Non-Toko'
          : 'Bergerak Langsung',
      'Nomor Toko': item.nomorToko,
      'Nama Toko Pelanggan / Lokasi Stop': item.namaTokoAtauLokasi,
      Kecamatan: item.kecamatan,
      Kabupaten: item.kabupaten,
      'Kategori Wilayah':
        item.regionType === 'dalam_kota'
          ? 'Dalam Kota (Biru)'
          : item.regionType === 'luar_kota'
          ? 'Luar Kota (Kuning)'
          : 'Luar Pulau (Hijau)',
      'Jarak Tempuh (km)': item.mileageKm,
      'Kecepatan Rata-Rata (km/h)': item.avgSpeedKmh,
      'Kecepatan Maksimal (km/h)': item.maxSpeedKmh,
      'Lokasi Keberangkatan': item.startLocation,
      'Lokasi Tujuan': item.endLocation
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Analisa_Armada_Pelanggan');
    XLSX.writeFile(wb, `Analisa_Rute_Armada_AKK_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const toggleMultiFleetSelection = (fleetId: string) => {
    setSelectedMultiFleetIds(prev =>
      prev.includes(fleetId) ? prev.filter(id => id !== fleetId) : [...prev, fleetId]
    );
  };

  const bottom = activeEvaluation?.bottomSummary || DEFAULT_TRACKSOLID_BOTTOM_SUMMARY;
  const subtotals = activeEvaluation?.dateSubtotals || DEFAULT_TRACKSOLID_DATE_SUBTOTALS;

  // ============================================================================
  // RENDER UPLOAD FORM SCREEN (MATCHING IMAGE 2 + TRACKSOLID/WANWAY + FLEET SPEC)
  // ============================================================================
  if (viewMode === 'upload_form') {
    return (
      <div className="space-y-5">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
          {/* Header Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-2.5">
                <FileSpreadsheet className="w-5 h-5 text-blue-400" />
                <h2 className="text-lg font-bold text-white">
                  Unggah File Evaluasi Rute GPS Armada
                </h2>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Pilih periode bulan, platform GPS (Tracksolid / Wanway), spesifikasi armada (1 atau beberapa armada), dan unggah file Excel (.xls, .xlsx, .csv).
              </p>
            </div>

            <button
              type="button"
              onClick={() => setViewMode('evaluation')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition cursor-pointer shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Kembali ke Peta & Analisa Rute</span>
            </button>
          </div>

          {errorMessage && (
            <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-200 text-xs">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{errorMessage}</span>
              </div>
              <button type="button" onClick={() => setErrorMessage(null)} className="p-1 hover:text-white">
                ✕
              </button>
            </div>
          )}

          {/* Row 1: BULAN DATA & TAHUN DATA */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
                Bulan Data
              </label>
              <select
                value={uploadMonth}
                onChange={e => setUploadMonth(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white font-semibold focus:outline-none focus:border-blue-500"
              >
                {MONTHS_ID.map(m => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
                Tahun Data
              </label>
              <select
                value={uploadYear}
                onChange={e => setUploadYear(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white font-semibold focus:outline-none focus:border-blue-500"
              >
                {['2025', '2026', '2027'].map(y => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 2: PILIHAN PLATFORM GPS (TRACKSOLID ATAU WANWAY) */}
          <div className="space-y-2">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
              Platform Sumber Data GPS (Tracksolid / Wanway)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div
                onClick={() => setGpsPlatform('tracksolid')}
                className={`p-3.5 rounded-xl border cursor-pointer transition flex items-start gap-3 ${
                  gpsPlatform === 'tracksolid'
                    ? 'bg-blue-600/10 border-blue-500 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full border flex items-center justify-center mt-0.5 shrink-0 ${
                    gpsPlatform === 'tracksolid' ? 'border-blue-400 bg-blue-600' : 'border-slate-600'
                  }`}
                >
                  {gpsPlatform === 'tracksolid' && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Tracksolid Pro (Format Trips / Track)</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Unggah file export perjalanan GPS dari platform Tracksolid.
                  </div>
                </div>
              </div>

              <div
                onClick={() => setGpsPlatform('wanway')}
                className={`p-3.5 rounded-xl border cursor-pointer transition flex items-start gap-3 ${
                  gpsPlatform === 'wanway'
                    ? 'bg-blue-600/10 border-blue-500 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full border flex items-center justify-center mt-0.5 shrink-0 ${
                    gpsPlatform === 'wanway' ? 'border-blue-400 bg-blue-600' : 'border-slate-600'
                  }`}
                >
                  {gpsPlatform === 'wanway' && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
                <div>
                  <div className="text-xs font-bold text-white">WanwayTrack (Wanway GPS)</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Unggah file histori perjalanan & koordinat dari platform Wanway GPS.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Row 3: PILIHAN FILE SPESIFIKASI ARMADA (1 ARMADA ATAU BEBERAPA ARMADA) */}
          <div className="space-y-3">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
              Spesifikasi Armada yang Diunggah (1 Armada / Beberapa Armada)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div
                onClick={() => setFleetScopeMode('single')}
                className={`p-3.5 rounded-xl border cursor-pointer transition flex items-start gap-3 ${
                  fleetScopeMode === 'single'
                    ? 'bg-blue-600/10 border-blue-500 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full border flex items-center justify-center mt-0.5 shrink-0 ${
                    fleetScopeMode === 'single' ? 'border-blue-400 bg-blue-600' : 'border-slate-600'
                  }`}
                >
                  {fleetScopeMode === 'single' && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Hanya 1 Armada Spesifik</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    File Excel yang diunggah merupakan track untuk 1 unit armada pengiriman.
                  </div>
                </div>
              </div>

              <div
                onClick={() => setFleetScopeMode('multiple')}
                className={`p-3.5 rounded-xl border cursor-pointer transition flex items-start gap-3 ${
                  fleetScopeMode === 'multiple'
                    ? 'bg-blue-600/10 border-blue-500 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full border flex items-center justify-center mt-0.5 shrink-0 ${
                    fleetScopeMode === 'multiple' ? 'border-blue-400 bg-blue-600' : 'border-slate-600'
                  }`}
                >
                  {fleetScopeMode === 'multiple' && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Beberapa Armada Sekaligus</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Unggah file untuk beberapa armada pengiriman sekaligus dalam satu proses.
                  </div>
                </div>
              </div>
            </div>

            {/* Selector Unit Armada */}
            {fleetScopeMode === 'single' ? (
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Pilih Unit Armada untuk File Ini:
                </label>
                <select
                  value={selectedSingleFleetId}
                  onChange={e => setSelectedSingleFleetId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-semibold focus:outline-none focus:border-blue-500"
                >
                  {fleets.map(f => (
                    <option key={f.id} value={f.id}>
                      {f.plateNumber} {f.initialCode ? `[Inisial: ${f.initialCode}]` : ''} — {f.brand || 'Armada'} ({f.vehicleType})
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Pilih Beberapa Armada yang Terunggah ({selectedMultiFleetIds.length} Armada Dipilih):
                  </span>
                  <div className="flex items-center gap-2 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setSelectedMultiFleetIds(fleets.map(f => f.id))}
                      className="text-blue-400 hover:underline font-semibold cursor-pointer"
                    >
                      Pilih Semua
                    </button>
                    <span className="text-slate-600">•</span>
                    <button
                      type="button"
                      onClick={() => setSelectedMultiFleetIds([])}
                      className="text-slate-400 hover:text-white cursor-pointer"
                    >
                      Reset
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
                  {fleets.map(f => {
                    const checked = selectedMultiFleetIds.includes(f.id);
                    return (
                      <div
                        key={f.id}
                        onClick={() => toggleMultiFleetSelection(f.id)}
                        className={`p-2.5 rounded-xl border text-xs flex items-center gap-2.5 cursor-pointer transition ${
                          checked
                            ? 'bg-blue-600/15 border-blue-500 text-white font-semibold'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 ${
                            checked ? 'bg-blue-600 border-blue-400 text-white' : 'border-slate-600'
                          }`}
                        >
                          {checked && <Check className="w-3 h-3" />}
                        </div>
                        <div className="truncate">
                          <div className="font-bold text-white truncate">
                            {f.plateNumber} {f.initialCode ? `[${f.initialCode}]` : ''}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate">{f.brand || f.vehicleType} ({f.vehicleType})</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Row 4: MODE IMPORT (Matching Image 2) */}
          <div className="space-y-2">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
              Mode Import
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div
                onClick={() => setImportMode('append')}
                className={`p-3.5 rounded-xl border cursor-pointer transition flex items-start gap-3 ${
                  importMode === 'append'
                    ? 'bg-blue-600/10 border-blue-500 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full border flex items-center justify-center mt-0.5 shrink-0 ${
                    importMode === 'append' ? 'border-blue-400 bg-blue-600' : 'border-slate-600'
                  }`}
                >
                  {importMode === 'append' && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Tambahkan data</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Data armada pada bulan yang sama ditambahkan tanpa menghapus armada lain.
                  </div>
                </div>
              </div>

              <div
                onClick={() => setImportMode('replace')}
                className={`p-3.5 rounded-xl border cursor-pointer transition flex items-start gap-3 ${
                  importMode === 'replace'
                    ? 'bg-blue-600/10 border-blue-500 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full border flex items-center justify-center mt-0.5 shrink-0 ${
                    importMode === 'replace' ? 'border-blue-400 bg-blue-600' : 'border-slate-600'
                  }`}
                >
                  {importMode === 'replace' && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Ganti data bulan ini</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Data lama periode sama dihapus lalu diimport ulang dengan file baru.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Row 5: FILE UPLOAD DASHED BOX (Matching Image 2) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
                File Evaluasi GPS ({gpsPlatform === 'tracksolid' ? 'Tracksolid' : 'Wanway'})
              </label>
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-400 hover:text-blue-300 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Unduh Template Excel</span>
              </button>
            </div>

            <div className="border-2 border-dashed border-slate-800 rounded-2xl p-4 bg-slate-950/60 space-y-2.5">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                multiple={fleetScopeMode === 'multiple'}
                onChange={e => {
                  const files = Array.from(e.target.files || []);
                  setStagedFiles(files);
                }}
                className="hidden"
              />

              <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-xl p-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition cursor-pointer shrink-0"
                >
                  Choose File
                </button>
                <span className="text-xs text-slate-300 truncate">
                  {stagedFiles.length > 0
                    ? stagedFiles.map(f => f.name).join(', ')
                    : 'No file chosen'}
                </span>
              </div>

              <p className="text-[11px] text-slate-400">
                Format didukung: .xls, .xlsx, .csv. Maksimal 10MB. Sistem akan memetakan track perjalanan armada di peta & menganalisa pemberhentian di pelanggan.
              </p>
            </div>
          </div>

          {/* Bottom Buttons (Matching Image 2: Preview Dulu & Lihat Riwayat Upload) */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleProcessUploadForm}
              disabled={isProcessing}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-sm transition cursor-pointer disabled:opacity-50"
            >
              <Search className="w-4 h-4" />
              <span>{isProcessing ? 'Memproses Track GPS...' : 'Preview & Proses Rute'}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowUploadHistory(prev => !prev)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-200 border border-slate-800 font-bold text-xs transition cursor-pointer"
            >
              <History className="w-4 h-4 text-slate-400" />
              <span>Lihat Riwayat Upload ({fleetEvaluations.length} Armada)</span>
            </button>
          </div>

          {/* Collapsible Riwayat Upload */}
          {showUploadHistory && (
            <div className="pt-4 border-t border-slate-800 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Riwayat Armada yang Telah Diunggah
              </h4>
              <div className="overflow-x-auto rounded-xl border border-slate-800">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3">Armada</th>
                      <th className="py-2.5 px-3">Platform</th>
                      <th className="py-2.5 px-3">Periode</th>
                      <th className="py-2.5 px-3">Total Ritase</th>
                      <th className="py-2.5 px-3">Total Jarak</th>
                      <th className="py-2.5 px-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {fleetEvaluations.map(ev => (
                      <tr key={ev.plateNumber} className="hover:bg-slate-800/40">
                        <td className="py-2.5 px-3 font-bold text-white">
                          {ev.plateNumber} {ev.initialCode ? `[${ev.initialCode}]` : ''}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded bg-blue-500/15 text-blue-300 border border-blue-500/30 text-[10px] font-bold uppercase">
                            {ev.gpsPlatform || 'tracksolid'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          {ev.uploadedMonth || 'Oktober'} {ev.uploadedYear || '2026'}
                        </td>
                        <td className="py-2.5 px-3 font-mono">
                          {ev.bottomSummary?.trips || ev.tripLegs?.length || 0} Ritase
                        </td>
                        <td className="py-2.5 px-3 font-mono text-emerald-400 font-bold">
                          {ev.totalDistanceKm} km
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedFleetPlate(ev.plateNumber || 'all');
                              setViewMode('evaluation');
                            }}
                            className="px-2.5 py-1 rounded-lg bg-blue-600 text-white text-[10px] font-bold hover:bg-blue-500 cursor-pointer"
                          >
                            Buka Rute
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
      </div>
    );
  }

  // ============================================================================
  // MAIN EVALUATION VIEW: MAP, DAILY FLEET BREAKDOWN & UNIFIED CUSTOMER STOPS
  // ============================================================================
  return (
    <div className="space-y-5">
      {/* Top Header Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium mb-1.5">
            <Truck className="w-3.5 h-3.5" />
            <span>Evaluasi Rute GPS Tracksolid & Wanway • Terintegrasi Jaringan Toko & Mitra</span>
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            Peta Rute GPS & Analisa Armada Kirim ke Pelanggan
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Rincian perjalanan setiap armada (ritase, jarak tempuh, durasi per hari, rata-rata kecepatan harian, kecepatan maksimal) serta analisa berhenti di toko pelanggan vs berhenti lama non-mitra.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-xs transition cursor-pointer"
          >
            <Download className="w-4 h-4 text-blue-400" />
            <span>Unduh Template Excel</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('upload_form')}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-sm transition cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            <span>Unggah File Excel (Tracksolid / Wanway)</span>
          </button>

          <button
            type="button"
            onClick={handleExportUnifiedAnalysis}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/30 font-semibold text-xs transition cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>Ekspor Hasil Analisa</span>
          </button>
        </div>
      </div>

      {/* Alert Banners */}
      {errorMessage && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-200 text-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMessage}</span>
          </div>
          <button type="button" onClick={() => setErrorMessage(null)} className="p-1 hover:text-white">
            ✕
          </button>
        </div>
      )}

      {successMessage && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-200 text-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{successMessage}</span>
          </div>
          <button type="button" onClick={() => setSuccessMessage(null)} className="p-1 hover:text-white">
            ✕
          </button>
        </div>
      )}

      {/* Fleet Selector Bar (When 1 or Multiple Fleets are Uploaded) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-400" />
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              Spesifikasi Armada Terunggah ({fleetEvaluations.length} Unit Armada)
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {fleetEvaluations.length > 1 && (
              <button
                type="button"
                onClick={() => setSelectedFleetPlate('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                  selectedFleetPlate === 'all'
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                Semua Armada ({fleetEvaluations.length})
              </button>
            )}
            {fleetEvaluations.map(ev => (
              <button
                key={ev.plateNumber}
                type="button"
                onClick={() => setSelectedFleetPlate(ev.plateNumber || 'P 8381 VE')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition flex items-center gap-2 cursor-pointer ${
                  selectedFleetPlate === ev.plateNumber
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <Truck className="w-3.5 h-3.5" />
                <span>{ev.plateNumber}</span>
                {ev.initialCode && (
                  <span className="px-1.5 py-0.5 rounded bg-slate-900/70 text-[10px] font-mono">
                    {ev.initialCode}
                  </span>
                )}
                <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[9px] uppercase">
                  {ev.gpsPlatform === 'wanway' ? 'Wanway' : 'Tracksolid'}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* 5 KPI Cards (NO FUEL CARD - With Daily Duration & Daily Avg Speed Breakdown) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-1">
          {/* Card 1: Trips */}
          <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-xl">
            <div className="flex items-center justify-between text-slate-400 text-[11px] uppercase font-bold tracking-wider mb-1">
              <span>Trips (Ritase)</span>
              <Truck className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-2xl font-black text-white">{bottom.trips}</div>
            <div className="text-[10px] text-slate-400 mt-1 space-y-0.5">
              {subtotals.slice(0, 2).map(st => (
                <div key={st.dateGroup} className="flex items-center justify-between">
                  <span>{st.dateGroup}:</span>
                  <strong className="text-slate-200">{st.tripCount} ritase</strong>
                </div>
              ))}
            </div>
          </div>

          {/* Card 2: Total KM */}
          <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-xl">
            <div className="flex items-center justify-between text-slate-400 text-[11px] uppercase font-bold tracking-wider mb-1">
              <span>Total KM</span>
              <MapPin className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-black text-emerald-400">
              {bottom.totalMileageKm} <span className="text-xs font-normal text-slate-400">km</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-1 space-y-0.5">
              {subtotals.slice(0, 2).map(st => (
                <div key={st.dateGroup} className="flex items-center justify-between">
                  <span>{st.dateGroup}:</span>
                  <strong className="text-emerald-300">{st.totalMileageKm} km</strong>
                </div>
              ))}
            </div>
          </div>

          {/* Card 3: Durasi Per Hari */}
          <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-xl">
            <div className="flex items-center justify-between text-slate-400 text-[11px] uppercase font-bold tracking-wider mb-1">
              <span>Durasi Per Hari</span>
              <Clock className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-xl font-black text-white font-mono">{bottom.duration}</div>
            <div className="text-[10px] text-slate-400 mt-1 space-y-0.5">
              {subtotals.slice(0, 2).map(st => (
                <div key={st.dateGroup} className="flex items-center justify-between">
                  <span>{st.dateGroup}:</span>
                  <strong className="text-amber-300 font-mono">{st.travelTime}</strong>
                </div>
              ))}
            </div>
          </div>

          {/* Card 4: Rata-Rata Kecepatan Per Hari */}
          <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-xl">
            <div className="flex items-center justify-between text-slate-400 text-[11px] uppercase font-bold tracking-wider mb-1">
              <span>Rata-Rata Kecepatan</span>
              <Gauge className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-2xl font-black text-white">
              {bottom.avgSpeedKmh} <span className="text-xs font-normal text-slate-400">km/h</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-1 space-y-0.5">
              {subtotals.slice(0, 2).map(st => (
                <div key={st.dateGroup} className="flex items-center justify-between">
                  <span>{st.dateGroup}:</span>
                  <strong className="text-blue-300">{st.avgSpeedKmh} km/h</strong>
                </div>
              ))}
            </div>
          </div>

          {/* Card 5: Kecepatan Maksimal */}
          <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-xl">
            <div className="flex items-center justify-between text-slate-400 text-[11px] uppercase font-bold tracking-wider mb-1">
              <span>Kecepatan Maksimal</span>
              <TrendingUp className="w-4 h-4 text-rose-400" />
            </div>
            <div className="text-2xl font-black text-rose-300">
              {bottom.maxSpeedKmh} <span className="text-xs font-normal text-slate-400">km/h</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-1 space-y-0.5">
              {subtotals.slice(0, 2).map(st => (
                <div key={st.dateGroup} className="flex items-center justify-between">
                  <span>{st.dateGroup}:</span>
                  <strong className="text-rose-300">{st.maxSpeedKmh} km/h</strong>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation (NO Trips_Tracksolid_... text on the right!) */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-1">
        <div className="flex items-center gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('map')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'map'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>Peta Rute GPS & Rincian Harian Armada</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('unified_stops_customer')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'unified_stops_customer'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Store className="w-3.5 h-3.5" />
            <span>Armada Bergerak, Berhenti & Analisa Kirim Pelanggan</span>
            {unifiedStats.longNonCustomerCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-black">
                {unifiedStats.longNonCustomerCount} Non-Mitra
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('speed_summary')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'speed_summary'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Gauge className="w-3.5 h-3.5" />
            <span>Profil Kecepatan & Rekapitulasi Per Hari</span>
          </button>
        </div>
      </div>

      {/* ======================================================================
          TAB 1: PETA VISUALISASI RUTE GPS & RINCIAN HARIAN SETIAP ARMADA
         ====================================================================== */}
      {activeTab === 'map' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                <h3 className="text-sm font-bold text-white">
                  Track Rute Aktual GPS Armada: {activeEvaluation?.plateNumber} (
                  {activeEvaluation?.points.length || 0} Titik Track & {activeEvaluation?.stops.length || 0} Titik Berhenti)
                </h3>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
                <span className="flex items-center gap-1.5 font-semibold text-emerald-400">
                  <span className="w-3 h-3 rounded-full bg-emerald-600 border border-white" /> Berhenti di Toko Mitra
                </span>
                <span className="flex items-center gap-1.5 font-semibold text-rose-400">
                  <span className="w-3 h-3 rounded-full bg-rose-600 border border-amber-300" /> ⚠️ Berhenti Lama Non-Mitra
                </span>
                <span className="flex items-center gap-1.5 font-semibold text-blue-400">
                  <span className="w-3 h-3 rounded-full bg-blue-600 border border-white" /> Dalam Kota (Biru)
                </span>
                <span className="flex items-center gap-1.5 font-semibold text-amber-300">
                  <span className="w-3 h-3 rounded-full bg-amber-400 border border-slate-900" /> Luar Kota (Kuning)
                </span>
              </div>
            </div>

            <div className="h-[540px] rounded-xl overflow-hidden relative border border-slate-800">
              <LeafletMap
                stores={registeredStores}
                trackingPoints={activeEvaluation?.points || []}
                stops={activeEvaluation?.stops || []}
                showWarehouse={true}
              />
            </div>
          </div>

          {/* Rincian Setiap Armada & Per Hari Table (No Fuel!) */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">
                  Rincian Performa Setiap Armada & Per Hari
                </h3>
                <p className="text-xs text-slate-400">
                  Rekapitulasi trips, total km, durasi per hari, rata-rata kecepatan per hari, dan kecepatan maksimal dari track armada yang diunggah.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-[11px] uppercase font-bold text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Armada</th>
                    <th className="py-3 px-3">Platform GPS</th>
                    <th className="py-3 px-3">Tanggal (Hari)</th>
                    <th className="py-3 px-3 text-right">Trips (Ritase)</th>
                    <th className="py-3 px-3 text-right">Total KM</th>
                    <th className="py-3 px-3">Durasi Per Hari</th>
                    <th className="py-3 px-3 text-right">Rata-Rata Kecepatan / Hari</th>
                    <th className="py-3 px-3 text-right">Kecepatan Maksimal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {fleetEvaluations.flatMap(ev =>
                    (ev.dateSubtotals || []).map(ds => (
                      <tr key={`${ev.plateNumber}-${ds.dateGroup}`} className="hover:bg-slate-800/40">
                        <td className="py-3 px-4 font-bold text-white">
                          {ev.plateNumber}{' '}
                          {ev.initialCode && (
                            <span className="text-[10px] font-mono text-blue-400">[{ev.initialCode}]</span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 text-[10px] font-semibold uppercase">
                            {ev.gpsPlatform === 'wanway' ? 'Wanway' : 'Tracksolid'}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono font-semibold text-slate-200">{ds.dateGroup}</td>
                        <td className="py-3 px-3 font-mono text-right font-bold text-white">
                          {ds.tripCount} Ritase
                        </td>
                        <td className="py-3 px-3 font-mono text-right font-bold text-emerald-400">
                          {ds.totalMileageKm.toFixed(2)} km
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-amber-300">{ds.travelTime}</td>
                        <td className="py-3 px-3 font-mono text-right font-bold text-blue-300">
                          {ds.avgSpeedKmh.toFixed(2)} km/h
                        </td>
                        <td className="py-3 px-3 font-mono text-right font-bold text-rose-300">
                          {ds.maxSpeedKmh.toFixed(2)} km/h
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================================
          TAB 2: UNIFIED ARMADA BERGERAK, BERHENTI & ANALISA KIRIM KE PELANGGAN
         ====================================================================== */}
      {activeTab === 'unified_stops_customer' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          {/* Header & Summary Badges */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-base font-bold text-white">
                Analisa Terpadu: Armada Bergerak, Berhenti & Kirim ke Pelanggan (Jaringan Toko & Mitra)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Mencocokkan setiap titik berhenti armada dengan database Jaringan Toko & Mitra. Jika armada berhenti lama (&ge; 15 menit) tetapi tidak berada di toko pelanggan, sistem memberikan penanda peringatan khusus.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-60">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cari nama toko, kecamatan, lokasi..."
                  value={searchFilter}
                  onChange={e => setSearchFilter(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <select
                value={selectedDateGroup}
                onChange={e => setSelectedDateGroup(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-xs text-slate-300 font-semibold px-3 py-2 rounded-xl focus:outline-none"
              >
                <option value="all">Semua Tanggal ({subtotals.length} Hari)</option>
                {subtotals.map(ds => (
                  <option key={ds.dateGroup} value={ds.dateGroup}>
                    {ds.dateGroup} ({ds.tripCount} Ritase)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Filter Pills for Customer Store vs Long Non-Customer Stop */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div
              onClick={() => setActivityFilter('all')}
              className={`p-3 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                activityFilter === 'all'
                  ? 'bg-blue-600/15 border-blue-500 text-white'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              <div>
                <div className="text-xs font-bold text-white">Semua Aktivitas Bergerak & Berhenti</div>
                <div className="text-[10px] text-slate-400">Seluruh ritase perjalanan armada</div>
              </div>
              <span className="text-lg font-black text-blue-400">{unifiedStats.totalLegs}</span>
            </div>

            <div
              onClick={() => setActivityFilter('customer_stop')}
              className={`p-3 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                activityFilter === 'customer_stop'
                  ? 'bg-emerald-600/15 border-emerald-500 text-white'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              <div>
                <div className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Berhenti di Toko Pelanggan (Mitra)</span>
                </div>
                <div className="text-[10px] text-slate-400">Terverifikasi di Jaringan Toko & Mitra</div>
              </div>
              <span className="text-lg font-black text-emerald-400">{unifiedStats.customerStopsCount}</span>
            </div>

            <div
              onClick={() => setActivityFilter('long_non_customer')}
              className={`p-3 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                activityFilter === 'long_non_customer'
                  ? 'bg-rose-600/20 border-rose-500 text-white'
                  : 'bg-slate-950 border-rose-500/30 text-slate-300 hover:border-rose-500'
              }`}
            >
              <div>
                <div className="text-xs font-bold text-rose-300 flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                  <span>⚠️ Berhenti Lama Bukan di Toko (Non-Mitra)</span>
                </div>
                <div className="text-[10px] text-rose-300/80">Stop &ge; 15 menit di luar toko pelanggan</div>
              </div>
              <span className="text-lg font-black text-rose-400">{unifiedStats.longNonCustomerCount}</span>
            </div>
          </div>

          {/* Unified Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/90 text-[11px] uppercase font-bold text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-3">Ritase & Armada</th>
                  <th className="py-3 px-3">Status Gerak & Berhenti</th>
                  <th className="py-3 px-3">Berhenti Berapa Lama</th>
                  <th className="py-3 px-4">Toko Pelanggan (Jaringan Mitra) / Lokasi Stop</th>
                  <th className="py-3 px-3">Wilayah</th>
                  <th className="py-3 px-4">Rute Perjalanan (Start &rarr; End)</th>
                  <th className="py-3 px-3 text-right">Jarak & Durasi Gerak</th>
                  <th className="py-3 px-3 text-right">Kecepatan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {filteredUnifiedRows.map(item => {
                  const isLongNonCustomer = item.stopCategory === 'long_non_customer';
                  const isCustomer = item.stopCategory === 'customer_store';
                  const isDalamKota = item.regionType === 'dalam_kota';
                  const isLuarKota = item.regionType === 'luar_kota';
                  const isLuarPulau = item.regionType === 'luar_pulau';

                  return (
                    <tr
                      key={item.id}
                      className={`transition ${
                        isLongNonCustomer
                          ? 'bg-rose-950/25 hover:bg-rose-950/40 border-l-4 border-l-rose-500'
                          : 'hover:bg-slate-800/40'
                      }`}
                    >
                      {/* Col 1: Ritase & Armada */}
                      <td className="py-3 px-3">
                        <div className="font-mono font-bold text-white">#{item.legNumber}</div>
                        <div className="text-[10px] font-semibold text-blue-400">{item.fleetPlate}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{item.dateGroup}</div>
                      </td>

                      {/* Col 2: Status Gerak & Berhenti (Distinct Badge for Non-Customer Long Stop!) */}
                      <td className="py-3 px-3">
                        <div className="space-y-1">
                          <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/25 font-semibold text-[10px] inline-flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" /> Bergerak ({item.startTime.slice(0, 5)} - {item.endTime.slice(0, 5)})
                          </span>

                          {isCustomer && (
                            <div>
                              <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold text-[10px] inline-flex items-center gap-1">
                                <Store className="w-3 h-3 text-emerald-400" />
                                Berhenti di Toko Pelanggan
                              </span>
                            </div>
                          )}

                          {isLongNonCustomer && (
                            <div>
                              <span className="px-2 py-1 rounded-lg bg-rose-600 text-white border border-amber-300 font-black text-[10px] inline-flex items-center gap-1 shadow-xs">
                                <AlertTriangle className="w-3 h-3 text-amber-200 shrink-0" />
                                BERHENTI LAMA BUKAN TOKO MITRA
                              </span>
                            </div>
                          )}

                          {item.stopCategory === 'short_transit' && (
                            <div>
                              <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-semibold text-[10px] inline-flex items-center gap-1">
                                <Clock className="w-3 h-3 text-slate-400" />
                                Transit Singkat Non-Toko
                              </span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Col 3: Berhenti Berapa Lama */}
                      <td className="py-3 px-3">
                        {item.stopDurationMinutes > 0 ? (
                          <div className="space-y-0.5">
                            <span
                              className={`px-2.5 py-1 rounded-lg font-mono font-black text-xs inline-flex items-center gap-1.5 border ${
                                isLongNonCustomer
                                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/50'
                                  : isCustomer
                                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                  : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                              }`}
                            >
                              <Clock className="w-3.5 h-3.5" />
                              {item.stopDurationMinutes} Menit
                            </span>
                            <div className="text-[10px] text-slate-400 font-mono">
                              {item.stopStart.slice(0, 5)} s/d {item.stopEnd.slice(0, 5)}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-500 text-[11px]">Langsung Jalan</span>
                        )}
                      </td>

                      {/* Col 4: Toko Pelanggan / Lokasi Non-Mitra */}
                      <td className="py-3 px-4 max-w-xs">
                        {isCustomer ? (
                          <div>
                            <div className="flex items-center gap-1.5">
                              {item.nomorToko !== '-' && (
                                <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-200 font-mono text-[10px] font-bold">
                                  No. {item.nomorToko}
                                </span>
                              )}
                              <span className="font-bold text-white text-xs">{item.namaTokoAtauLokasi}</span>
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              Kec. {item.kecamatan}, Kab. {item.kabupaten}
                            </div>
                          </div>
                        ) : isLongNonCustomer ? (
                          <div>
                            <div className="font-bold text-rose-300 text-xs flex items-center gap-1">
                              <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                              <span>Tidak Terdaftar di Jaringan Toko & Mitra</span>
                            </div>
                            <div className="text-[11px] text-slate-200 font-semibold mt-0.5 truncate" title={item.startLocation}>
                              Lokasi: {item.startLocation}
                            </div>
                            <div className="text-[10px] text-rose-300/80 mt-0.5">
                              Armada berhenti {item.stopDurationMinutes} menit di luar titik pelanggan
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div className="font-semibold text-slate-200 text-xs">{item.namaTokoAtauLokasi}</div>
                            <div className="text-[10px] text-slate-400 truncate max-w-[240px]">
                              {item.startLocation}
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Col 5: Wilayah (Biru / Kuning / Hijau) */}
                      <td className="py-3 px-3">
                        {isDalamKota && (
                          <span className="px-2 py-0.5 rounded-full bg-blue-600/20 text-blue-300 border border-blue-500/40 font-bold text-[10px] inline-flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" /> Dalam Kota
                          </span>
                        )}
                        {isLuarKota && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/50 font-bold text-[10px] inline-flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> Luar Kota
                          </span>
                        )}
                        {isLuarPulau && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold text-[10px] inline-flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Luar Pulau
                          </span>
                        )}
                      </td>

                      {/* Col 6: Rute Perjalanan */}
                      <td className="py-3 px-4 max-w-xs">
                        <div className="text-[11px] text-slate-200 truncate" title={item.startLocation}>
                          <span className="text-slate-500">Dari:</span> {item.startLocation.split(',')[0]}
                        </div>
                        <div className="text-[11px] text-emerald-300 truncate mt-0.5" title={item.endLocation}>
                          <span className="text-slate-500">Ke:</span> {item.endLocation.split(',')[0]}
                        </div>
                      </td>

                      {/* Col 7: Jarak & Durasi Gerak */}
                      <td className="py-3 px-3 text-right font-mono">
                        <div className="font-bold text-emerald-400">{item.mileageKm.toFixed(2)} km</div>
                        <div className="text-[10px] text-slate-400">{item.travelTime}</div>
                      </td>

                      {/* Col 8: Kecepatan */}
                      <td className="py-3 px-3 text-right font-mono">
                        <div className="text-slate-200">Avg: {item.avgSpeedKmh.toFixed(1)}</div>
                        <div className="text-[10px] text-rose-300 font-semibold">
                          Max: {item.maxSpeedKmh.toFixed(1)} km/h
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ======================================================================
          TAB 3: PROFIL KECEPATAN & REKAPITULASI PER HARI (NO FUEL)
         ====================================================================== */}
      {activeTab === 'speed_summary' && (
        <div className="space-y-5">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-base font-bold text-white">
                  Grafik Profil Kecepatan Perjalanan Armada ({activeEvaluation?.plateNumber})
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Perbandingan kecepatan rata-rata dan kecepatan maksimal per ritase perjalanan.
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5 font-bold text-blue-400">
                  <span className="w-3 h-3 rounded-full bg-blue-500" /> Rata-Rata Kecepatan (km/h)
                </span>
                <span className="flex items-center gap-1.5 font-bold text-rose-400">
                  <span className="w-3 h-3 rounded-full bg-rose-500" /> Kecepatan Maksimal (km/h)
                </span>
              </div>
            </div>

            <div className="h-72 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={speedChartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="avgSpeedGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="maxSpeedGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="name" stroke="#64748b" tick={{ fontSize: 10 }} />
                  <YAxis stroke="#64748b" tick={{ fontSize: 10 }} unit=" km/h" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '0.75rem',
                      fontSize: '11px'
                    }}
                    labelStyle={{ color: '#ffffff', fontWeight: 'bold' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="avgSpeed"
                    stroke="#3b82f6"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#avgSpeedGrad)"
                    name="Rata-Rata Kecepatan"
                  />
                  <Area
                    type="monotone"
                    dataKey="maxSpeed"
                    stroke="#f43f5e"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    fillOpacity={1}
                    fill="url(#maxSpeedGrad)"
                    name="Kecepatan Maksimal"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Subtotal Per Hari & Rekapitulasi Baris Bawah Excel (Tanpa Fuel) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
              <h4 className="text-sm font-bold text-slate-300 uppercase tracking-wider">
                Rincian Per Hari (Trips, KM, Durasi Harian & Kecepatan Harian)
              </h4>
              <div className="space-y-2.5">
                {subtotals.map(st => (
                  <div
                    key={st.dateGroup}
                    className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 flex items-center justify-between"
                  >
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-2">
                        <span>Tanggal: {st.dateGroup}</span>
                        <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-mono text-[10px]">
                          {st.tripCount} Trips
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1 flex flex-wrap items-center gap-3">
                        <span>
                          Durasi Hari Ini: <strong className="text-amber-300 font-mono">{st.travelTime}</strong>
                        </span>
                        <span>
                          Rata-Rata Kecepatan: <strong className="text-blue-400">{st.avgSpeedKmh} km/h</strong>
                        </span>
                        <span>
                          Kecepatan Maks: <strong className="text-rose-400">{st.maxSpeedKmh} km/h</strong>
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-black text-emerald-400">{st.totalMileageKm} km</div>
                      <div className="text-[10px] text-slate-500">Total KM Harian</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
              <h4 className="text-sm font-bold text-slate-300 uppercase tracking-wider">
                Rekapitulasi Baris Bawah Excel ({activeEvaluation?.plateNumber})
              </h4>
              <div className="bg-slate-950 rounded-xl border border-slate-800 divide-y divide-slate-800/80 text-xs">
                <div className="flex items-center justify-between p-3">
                  <span className="text-slate-400">Trips (Total Ritase)</span>
                  <span className="font-mono font-bold text-white text-sm">{bottom.trips} Ritase</span>
                </div>
                <div className="flex items-center justify-between p-3">
                  <span className="text-slate-400">Total KM (Total Mileage)</span>
                  <span className="font-mono font-bold text-emerald-400 text-sm">{bottom.totalMileageKm} km</span>
                </div>
                <div className="flex items-center justify-between p-3">
                  <span className="text-slate-400">Total Durasi Perjalanan</span>
                  <span className="font-mono font-bold text-amber-300 text-sm">{bottom.duration}</span>
                </div>
                <div className="flex items-center justify-between p-3">
                  <span className="text-slate-400">Rata-Rata Kecepatan Keseluruhan</span>
                  <span className="font-mono font-bold text-blue-400 text-sm">{bottom.avgSpeedKmh} km/h</span>
                </div>
                <div className="flex items-center justify-between p-3">
                  <span className="text-slate-400">Kecepatan Maksimal Tertinggi</span>
                  <span className="font-mono font-bold text-rose-400 text-sm">{bottom.maxSpeedKmh} km/h</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
