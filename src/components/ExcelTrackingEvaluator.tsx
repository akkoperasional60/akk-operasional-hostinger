import React, { useState, useMemo, useRef, useEffect } from 'react';
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
  Trash2,
  ChevronDown,
  CalendarDays,
  X,
  Play,
  Filter,
  Building2,
  FileCheck2,
  ChevronLeft,
  ChevronRight,
  Navigation
} from 'lucide-react';
import { LeafletMap } from './LeafletMap';
import { GpsFleetTripsMap } from './GpsFleetTripsMap';
import { logisticsStore } from '../services/store';
import { branchStore, BranchRecord } from '../services/branchStore';
import { formKirimStore, FormKirimRecord } from '../services/formKirimStore';
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
    'sukowidi',
    'gudang dc',
    'gudang pusat',
    'pick up?, jalan raya denpasar-gilimanuk'
  ];
  const isExplicitNonStore = nonCustomerKeywords.some(k => locLower.includes(k));
  if (isExplicitNonStore) {
    return { store: null, distanceKm: 99, isNonStoreKeyword: true };
  }

  const isMainlandJavaCoord =
    typeof lng === 'number' &&
    Number.isFinite(lng) &&
    lng > 105 &&
    lng <= 114.432 &&
    !locLower.includes('bali') &&
    !locLower.includes('tabanan') &&
    !locLower.includes('denpasar') &&
    !locLower.includes('jembrana') &&
    !locLower.includes('buleleng');

  let closestStore: RetailStore | null = null;
  let minDistance = 1.65; // 1.65 km radius for store stop detection

  for (const st of registeredStores) {
    // Prevent Luar Pulau (Bali/NTB) stores from falsely matching mainland East Java coordinates
    if (isMainlandJavaCoord && getStoreLocationType(st) === 'luar_pulau') {
      continue;
    }

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
  const [registeredStores, setRegisteredStores] = useState<RetailStore[]>(() => logisticsStore.getStores());
  const [fleets, setFleets] = useState<Fleet[]>(() => logisticsStore.getFleets());
  const [branches, setBranches] = useState<BranchRecord[]>(() => branchStore.getActiveBranches());
  const [selectedBranchId, setSelectedBranchId] = useState<string>(() => branchStore.getSelectedOriginBranchId());
  const currentUserProfile = logisticsStore.getCurrentUser();

  const accessibleBranches = useMemo(
    () => branchStore.getAccessibleBranchesForUser(currentUserProfile),
    [branches, currentUserProfile]
  );

  const effectiveBranchId = useMemo(() => {
    if (accessibleBranches.length === 1) return accessibleBranches[0].id;
    if (selectedBranchId === 'ALL') return 'ALL';
    if (accessibleBranches.some(b => b.id === selectedBranchId)) return selectedBranchId;
    return accessibleBranches[0]?.id || 'ALL';
  }, [accessibleBranches, selectedBranchId]);

  const accessibleBranchIdSet = useMemo(
    () => new Set(accessibleBranches.map(b => b.id)),
    [accessibleBranches]
  );

  // Live subscribe to Jaringan Toko & Mitra Pelanggan, Armada, dan Cabang
  useEffect(() => {
    const unsubStore = logisticsStore.subscribe(() => {
      setRegisteredStores(logisticsStore.getStores());
      setFleets(logisticsStore.getFleets());
    });
    const unsubBranch = branchStore.subscribe(() => {
      setBranches(branchStore.getActiveBranches());
      setSelectedBranchId(branchStore.getSelectedOriginBranchId());
    });
    return () => {
      unsubStore();
      unsubBranch();
    };
  }, []);

  const branchScopedFleets = useMemo(() => {
    return fleets.filter(fl => {
      const bId = branchStore.getFleetBranchId(fl.id, fl.plateNumber, fl.initialCode);
      if (effectiveBranchId === 'ALL') return accessibleBranchIdSet.has(bId);
      return bId === effectiveBranchId;
    });
  }, [fleets, effectiveBranchId, accessibleBranchIdSet]);

  const validMappedStoresCount = useMemo(() => {
    return registeredStores.filter(
      s =>
        typeof s.latitude === 'number' &&
        typeof s.longitude === 'number' &&
        Number.isFinite(s.latitude) &&
        Number.isFinite(s.longitude) &&
        Math.abs(s.latitude) > 0.01 &&
        Math.abs(s.longitude) > 0.01
    ).length;
  }, [registeredStores]);

  // Multi-Fleet Evaluations State (All Fleet Units Initialized with Individual Breakdowns)
  const [fleetEvaluations, setFleetEvaluations] = useState<TrackingEvaluation[]>(() => {
    const stores = logisticsStore.getStores();
    const crews = logisticsStore.getCrews();
    const allFleets = logisticsStore.getFleets();

    return allFleets.map((fleet, idx) => {
      const assignedDriver =
        crews.find(c => c.id === fleet.driverId || c.currentFleetId === fleet.id) ||
        crews[idx % Math.max(1, crews.length)];
      const cleanPlate = fleet.plateNumber.replace(/\s+/g, '');

      // Keep exact 26-leg Tracksolid dataset for P 8381 VE (or index 0 if not found)
      if (fleet.plateNumber.includes('8381') || (idx === 0 && !allFleets.some(f => f.plateNumber.includes('8381')))) {
        return buildEvaluationFromLegs(
          DEFAULT_TRACKSOLID_26_LEGS,
          DEFAULT_TRACKSOLID_DATE_SUBTOTALS,
          DEFAULT_TRACKSOLID_BOTTOM_SUMMARY,
          {
            fileName: `Evaluasi_Rute_${cleanPlate}.xlsx`,
            fleetId: fleet.id,
            plateNumber: fleet.plateNumber,
            initialCode: fleet.initialCode || `UNIT-${idx + 1}`,
            driverName: assignedDriver?.name || 'Budiono',
            helperName: 'Saifur Rizal',
            gpsPlatform: 'tracksolid',
            uploadedMonth: 'Oktober',
            uploadedYear: '2026'
          },
          stores
        );
      }

      // Generate distinct, realistic per-unit route legs & daily subtotals for each other fleet unit
      const legSliceCount = 12 + ((idx * 3) % 13); // 12 to 24 legs per unit
      const speedFactor = 0.88 + ((idx % 5) * 0.06);
      const distFactor = 0.78 + ((idx % 6) * 0.09);
      const latOffset = ((idx % 4) - 1.5) * 0.004;
      const lngOffset = ((idx % 3) - 1) * 0.004;

      const unitLegs: TracksolidTripLeg[] = DEFAULT_TRACKSOLID_26_LEGS.slice(0, legSliceCount).map((leg, legIdx) => ({
        ...leg,
        legNumber: legIdx + 1,
        mileageKm: Number(Math.max(0.25, leg.mileageKm * distFactor).toFixed(2)),
        avgSpeedKmh: Number(Math.max(12, leg.avgSpeedKmh * speedFactor).toFixed(1)),
        maxSpeedKmh: Number(Math.max(28, leg.maxSpeedKmh * speedFactor).toFixed(1)),
        startLat: Number((leg.startLat + latOffset).toFixed(6)),
        startLng: Number((leg.startLng + lngOffset).toFixed(6)),
        endLat: Number((leg.endLat + latOffset).toFixed(6)),
        endLng: Number((leg.endLng + lngOffset).toFixed(6))
      }));

      // Compute date subtotals for this specific fleet unit
      const dateGroups = Array.from(new Set(unitLegs.map(l => l.dateGroup)));
      const unitSubtotals: TracksolidDateSubtotal[] = dateGroups.map(dg => {
        const dLegs = unitLegs.filter(l => l.dateGroup === dg);
        const dKm = Number(dLegs.reduce((sum, l) => sum + l.mileageKm, 0).toFixed(2));
        const dSec = dLegs.reduce((sum, l) => sum + (parseTimeSeconds(l.travelTime) || 420), 0);
        const dAvgSpd = Number(
          (dLegs.reduce((sum, l) => sum + l.avgSpeedKmh, 0) / Math.max(1, dLegs.length)).toFixed(2)
        );
        const dMaxSpd = Number(Math.max(...dLegs.map(l => l.maxSpeedKmh)).toFixed(1));
        return {
          dateGroup: dg,
          tripCount: dLegs.length,
          totalMileageKm: dKm,
          travelTime: formatSecondsToHMS(dSec),
          avgSpeedKmh: dAvgSpd,
          maxSpeedKmh: dMaxSpd,
          fuelPer100Km: 0,
          totalFuelLiters: 0
        };
      });

      const totalKm = Number(unitLegs.reduce((sum, l) => sum + l.mileageKm, 0).toFixed(2));
      const totalSec = unitLegs.reduce((sum, l) => sum + (parseTimeSeconds(l.travelTime) || 420), 0);
      const overallAvgSpd = Number(
        (unitLegs.reduce((sum, l) => sum + l.avgSpeedKmh, 0) / Math.max(1, unitLegs.length)).toFixed(2)
      );
      const overallMaxSpd = Number(Math.max(...unitLegs.map(l => l.maxSpeedKmh)).toFixed(1));

      const unitBottom: TracksolidBottomSummary = {
        trips: unitLegs.length,
        totalMileageKm: totalKm,
        duration: formatSecondsToHMS(totalSec),
        avgSpeedKmh: overallAvgSpd,
        maxSpeedKmh: overallMaxSpd,
        totalFuelConsumptionLiters: 0
      };

      return buildEvaluationFromLegs(
        unitLegs,
        unitSubtotals,
        unitBottom,
        {
          fileName: `Evaluasi_Rute_${cleanPlate}.xlsx`,
          fleetId: fleet.id,
          plateNumber: fleet.plateNumber,
          initialCode: fleet.initialCode || `UNIT-${idx + 1}`,
          driverName: assignedDriver?.name || 'Supir Operasional',
          helperName: 'Kernet Distribusi',
          gpsPlatform: idx % 3 === 0 ? 'wanway' : 'tracksolid',
          uploadedMonth: 'Oktober',
          uploadedYear: '2026'
        },
        stores
      );
    });
  });

  // Active selected fleet index or 'all'
  const [selectedFleetPlate, setSelectedFleetPlate] = useState<string>(() => {
    const defaultEv = fleetEvaluations.find(e => e.plateNumber?.includes('8381')) || fleetEvaluations[0];
    return defaultEv?.plateNumber || 'P 8381 VE';
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
  // 3. 'non_form_kirim_stops' -> Laporan Terpisah Berhenti di Toko Selain Pelanggan Form Kirim (Dilengkapi GPS)
  // 4. 'speed_summary' -> Profil Kecepatan & Rekapitulasi Harian
  const [activeTab, setActiveTab] = useState<'map' | 'unified_stops_customer' | 'non_form_kirim_stops' | 'speed_summary'>('map');

  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [selectedDateGroup, setSelectedDateGroup] = useState<string>('all');
  const [calendarScopeMode, setCalendarScopeMode] = useState<
    'harian' | 'mingguan' | 'bulanan' | 'tahunan' | 'semua'
  >('semua');
  const [activityFilter, setActivityFilter] = useState<
    'all' | 'sesuai_form_kirim' | 'pelanggan_luar_form_kirim' | 'long_non_customer'
  >('all');
  const [searchFilter, setSearchFilter] = useState('');
  const [isFleetDropdownOpen, setIsFleetDropdownOpen] = useState(false);
  const [fleetSearchQuery, setFleetSearchQuery] = useState('');
  const [isUploadFleetDropdownOpen, setIsUploadFleetDropdownOpen] = useState(false);
  const [uploadFleetSearchQuery, setUploadFleetSearchQuery] = useState('');
  const [isCalendarPopoverOpen, setIsCalendarPopoverOpen] = useState(false);
  const [calendarViewYearMonth, setCalendarViewYearMonth] = useState<{ year: number; month: number }>(() => ({
    year: 2026,
    month: 9 // October 2026 (0-indexed)
  }));
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Hydrate & auto-persist GPS evaluations to server database (no localStorage)
  const gpsEvalHydratedRef = useRef(false);
  useEffect(() => {
    let active = true;
    fetch('/api/gps-evaluations', { credentials: 'include', cache: 'no-store' })
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (!active) return;
        if (Array.isArray(data?.evaluations) && data.evaluations.length > 0) {
          setFleetEvaluations(prev => {
            const savedList: TrackingEvaluation[] = data.evaluations;
            const savedPlateSet = new Set(
              savedList.map(ev => String(ev.plateNumber || '').replace(/\s+/g, '').toUpperCase())
            );
            const missingSeed = prev.filter(
              ev => !savedPlateSet.has(String(ev.plateNumber || '').replace(/\s+/g, '').toUpperCase())
            );
            return [...savedList, ...missingSeed];
          });
        }
        gpsEvalHydratedRef.current = true;
      })
      .catch(() => {
        gpsEvalHydratedRef.current = true;
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!gpsEvalHydratedRef.current) return;
    const timer = setTimeout(() => {
      fetch('/api/gps-evaluations', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ evaluations: fleetEvaluations })
      }).catch(() => {});
    }, 450);
    return () => clearTimeout(timer);
  }, [fleetEvaluations]);

  // Live subscription to Form Kirim store for compliance matching against GPS stops & Mitra Pelanggan
  const [formKirimRecords, setFormKirimRecords] = useState<FormKirimRecord[]>(() => formKirimStore.getAll());
  useEffect(() => {
    formKirimStore.hydrateFromServer().catch(() => {});
    const unsub = formKirimStore.subscribe(() => {
      setFormKirimRecords(formKirimStore.getAll());
    });
    return unsub;
  }, []);

  // Strict branch-scoped fleet evaluations so Cabang Sidoarjo & Cabang Nusantara never mix
  const branchScopedEvaluations = useMemo(() => {
    return fleetEvaluations.filter(ev => {
      const matchedFleet = fleets.find(f => f.id === ev.fleetId || f.plateNumber === ev.plateNumber);
      const bId = branchStore.getFleetBranchId(
        matchedFleet?.id || ev.fleetId || '',
        matchedFleet?.plateNumber || ev.plateNumber,
        matchedFleet?.initialCode || ev.initialCode
      );
      if (effectiveBranchId === 'ALL') return accessibleBranchIdSet.has(bId);
      return bId === effectiveBranchId;
    });
  }, [fleetEvaluations, fleets, effectiveBranchId, accessibleBranchIdSet]);

  // Keep selectedFleetPlate aligned with active branch so cross-branch fleets never remain selected
  useEffect(() => {
    if (selectedFleetPlate === 'all') return;
    if (branchScopedEvaluations.length === 0) return;
    const stillValid = branchScopedEvaluations.some(e => e.plateNumber === selectedFleetPlate);
    if (!stillValid) {
      setSelectedFleetPlate(branchScopedEvaluations[0].plateNumber || 'all');
    }
  }, [branchScopedEvaluations, selectedFleetPlate]);

  // Helper to enrich tripLegs live against latest Jaringan Toko & Mitra Pelanggan stores
  const enrichLegsWithStores = useMemo(() => {
    return (legs: TracksolidTripLeg[]): TracksolidTripLeg[] => {
      return legs.map(leg => {
        const mStart = findMatchingRegisteredStore(leg.startLat, leg.startLng, leg.startLocation, registeredStores);
        const mEnd = findMatchingRegisteredStore(leg.endLat, leg.endLng, leg.endLocation, registeredStores);
        const matched = mStart.store || mEnd.store;
        if (!matched) return leg;
        return {
          ...leg,
          matchedStoreName: matched.storeName,
          matchedStoreKecamatan: matched.kecamatan || leg.matchedStoreKecamatan,
          matchedStoreKabupaten: matched.kabupaten || leg.matchedStoreKabupaten
        };
      });
    };
  }, [registeredStores]);

  // Current active evaluation based on selectedFleetPlate & active branch
  const activeEvaluation = useMemo(() => {
    const scoped = branchScopedEvaluations;
    if (scoped.length === 0) return undefined;

    if (selectedFleetPlate === 'all') {
      // Combine all uploaded fleet evaluations within active branch
      const allLegs: TracksolidTripLeg[] = [];
      const allPoints: TrackingPoint[] = [];
      const allStops: RouteStop[] = [];
      const subtotalMap = new Map<string, TracksolidDateSubtotal>();

      scoped.forEach(ev => {
        enrichLegsWithStores(ev.tripLegs || []).forEach(l => allLegs.push(l));
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
        ...scoped[0],
        plateNumber: `Semua Armada (${scoped.length} Unit)`,
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

    const baseEv = scoped.find(e => e.plateNumber === selectedFleetPlate) || scoped[0];
    if (!baseEv) return undefined;
    return {
      ...baseEv,
      tripLegs: enrichLegsWithStores(baseEv.tripLegs || [])
    };
  }, [branchScopedEvaluations, selectedFleetPlate, enrichLegsWithStores]);

  // Helpers for matching GPS stops against Form Kirim & Jaringan Toko Mitra Pelanggan
  const normalizePlateKey = (val?: string) => String(val || '').replace(/[^a-z0-9]/gi, '').toUpperCase();
  const normalizeStoreMatchKey = (val?: string) =>
    String(val || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\b(tk|toko|ud|cv|pt|tb|warung|kios|minimarket|depot|mart|cabang|banyuwangi|jember|sidoarjo|bali)\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  interface FormKirimTargetCustomer {
    noFormKirim: string;
    tanggalKirim: string;
    noFaktur: string;
    namaPelanggan: string;
    alamatPelanggan: string;
    normalizedKey: string;
    lockedGpsLat?: number;
    lockedGpsLng?: number;
  }

  const getFleetFormKirimTargets = useMemo(() => {
    const extractFleetTokens = (raw?: string): string[] =>
      String(raw || '')
        .toUpperCase()
        .split(/[\s/\-_[\]()•,]+/)
        .map(t => t.trim())
        .filter(t => t.length >= 2 && !['UNIT', 'ARMADA', 'BOX', 'STD', 'LONG', 'CDD', 'CDE'].includes(t));

    const normalizeIsoDateKey = (raw?: string): string => {
      const s = String(raw || '').trim();
      if (!s || s === 'all') return '';
      const ymd = s.match(/^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})/);
      if (ymd) return `${ymd[1]}-${ymd[2].padStart(2, '0')}-${ymd[3].padStart(2, '0')}`;
      const dmy = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})/);
      if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
      return s.slice(0, 10);
    };

    return (fleetPlate?: string, fleetId?: string, fleetInitial?: string, dateGroup?: string): {
      records: FormKirimRecord[];
      targets: FormKirimTargetCustomer[];
    } => {
      const targetPlate = normalizePlateKey(fleetPlate);
      const targetInit = normalizePlateKey(fleetInitial);
      const targetTokens = extractFleetTokens(fleetInitial);

      const fleetMatched = formKirimRecords.filter(rec => {
        if (fleetId && rec.fleetId && rec.fleetId === fleetId) return true;
        if (targetPlate && normalizePlateKey(rec.plateNumber) === targetPlate) return true;
        if (targetInit && rec.armadaInitial && normalizePlateKey(rec.armadaInitial) === targetInit) return true;
        if (targetTokens.length > 0 && rec.armadaInitial) {
          const recTokens = extractFleetTokens(rec.armadaInitial);
          if (targetTokens.some(tok => recTokens.includes(tok))) return true;
        }
        return false;
      });

      const normalizedDate = normalizeIsoDateKey(dateGroup);
      const dateMatched =
        normalizedDate
          ? fleetMatched.filter(rec => normalizeIsoDateKey(rec.tanggalKirim) === normalizedDate)
          : [];
      const activeRecs = dateMatched.length > 0 ? dateMatched : normalizedDate ? [] : fleetMatched;

      // Deduplicate targets by unique customer per Form Kirim so multi-invoice customers count as 1 store target
      const customerMap = new Map<string, FormKirimTargetCustomer & { invoiceCount: number; firstFaktur: string }>();

      activeRecs.forEach(rec => {
        if (Array.isArray(rec.invoiceItems) && rec.invoiceItems.length > 0) {
          rec.invoiceItems.forEach(inv => {
            const custName = (inv.namaPelanggan || '').trim();
            if (!custName) return;
            const normKey = normalizeStoreMatchKey(custName) || custName.toUpperCase();
            const existing = customerMap.get(normKey);
            const invNo = (inv.noFaktur || rec.noFaktur || '').trim();
            if (existing) {
              existing.invoiceCount += 1;
              existing.noFaktur =
                existing.invoiceCount > 1
                  ? `${existing.firstFaktur} (+${existing.invoiceCount - 1} Faktur)`
                  : existing.firstFaktur;
              if (!existing.lockedGpsLat && typeof inv.lockedGpsLat === 'number') {
                existing.lockedGpsLat = inv.lockedGpsLat;
                existing.lockedGpsLng = inv.lockedGpsLng;
              }
            } else {
              customerMap.set(normKey, {
                noFormKirim: rec.noFormKirim,
                tanggalKirim: rec.tanggalKirim,
                noFaktur: invNo,
                firstFaktur: invNo,
                invoiceCount: 1,
                namaPelanggan: custName,
                alamatPelanggan: inv.alamatPelanggan || rec.storeAddress || '',
                normalizedKey: normKey,
                lockedGpsLat: inv.lockedGpsLat,
                lockedGpsLng: inv.lockedGpsLng
              });
            }
          });
        } else if (rec.storeName && rec.storeName.trim()) {
          const normKey = normalizeStoreMatchKey(rec.storeName) || rec.storeName.trim().toUpperCase();
          if (!customerMap.has(normKey)) {
            customerMap.set(normKey, {
              noFormKirim: rec.noFormKirim,
              tanggalKirim: rec.tanggalKirim,
              noFaktur: rec.noFaktur || '',
              firstFaktur: rec.noFaktur || '',
              invoiceCount: 1,
              namaPelanggan: rec.storeName.trim(),
              alamatPelanggan: rec.storeAddress || '',
              normalizedKey: normKey
            });
          }
        }
      });

      const targets: FormKirimTargetCustomer[] = Array.from(customerMap.values()).map(
        ({ invoiceCount: _ic, firstFaktur: _ff, ...rest }) => rest
      );

      return { records: activeRecs, targets };
    };
  }, [formKirimRecords]);

  // Unified Analysis combining Moving Legs, Stop Duration (Minutes), Jaringan Toko & Mitra Pelanggan, AND Form Kirim Compliance
  const unifiedRows = useMemo(() => {
    const evalList =
      selectedFleetPlate === 'all' ? branchScopedEvaluations : [activeEvaluation].filter(Boolean) as TrackingEvaluation[];

    const parseClockToMinutes = (t?: string): number | null => {
      const m = String(t || '').match(/(\d{1,2}):(\d{2})/);
      if (!m) return null;
      return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
    };

    const AREA_SYNONYM_GROUPS: string[][] = [
      ['rogojampi', 'pengantigan', 'pengantingan', 'lingkar utara rogojampi', 'gitik', 'blimbingsari'],
      ['benculuk', 'cluring', 'srono', 'tapanrejo'],
      ['sanggar', 'pesanggaran', 'ringintelu', 'ringinmulyo', 'sumberagung', 'siliragung', 'kesilir'],
      ['jajag', 'yosowinangun', 'gambiran', 'maduran', 'wringinagung'],
      ['pedotan', 'bangorejo', 'kebondalem', 'sambimulyo', 'purwoharjo'],
      ['ambulu', 'genteng', 'sempu', 'kalisetail', 'tegalsari']
    ];

    const matchTargetAgainstFormKirim = (
      matchedStore: RetailStore | null,
      leg: TracksolidTripLeg,
      targets: FormKirimTargetCustomer[]
    ): FormKirimTargetCustomer | null => {
      if (targets.length === 0) return null;

      // 1. Check GPS coordinate lock proximity (<= 350m) if Form Kirim item has locked GPS
      for (const tgt of targets) {
        if (typeof tgt.lockedGpsLat === 'number' && typeof tgt.lockedGpsLng === 'number') {
          const dStart = calculateDistanceKm(leg.startLat, leg.startLng, tgt.lockedGpsLat, tgt.lockedGpsLng);
          const dEnd = calculateDistanceKm(leg.endLat, leg.endLng, tgt.lockedGpsLat, tgt.lockedGpsLng);
          if (Math.min(dStart, dEnd) <= 0.35) return tgt;
        }
      }

      // 2. Check normalized customer name against Matched Mitra Store or leg start/end location
      const storeKey = normalizeStoreMatchKey(matchedStore?.storeName);
      const startLocKey = normalizeStoreMatchKey(leg.startLocation);
      const endLocKey = normalizeStoreMatchKey(leg.endLocation);
      const combinedLocLower = `${leg.startLocation || ''} ${leg.endLocation || ''}`.toLowerCase();

      for (const tgt of targets) {
        if (!tgt.normalizedKey || tgt.normalizedKey.length < 3) continue;
        if (storeKey && (storeKey.includes(tgt.normalizedKey) || tgt.normalizedKey.includes(storeKey))) {
          return tgt;
        }
        const tgtTokens = tgt.normalizedKey.split(' ').filter(w => w.length >= 3);
        if (storeKey && tgtTokens.length > 0) {
          const storeTokens = storeKey.split(' ').filter(w => w.length >= 3);
          const overlap = tgtTokens.filter(tok => storeTokens.some(st => st.includes(tok) || tok.includes(st)));
          if (overlap.length >= Math.min(2, tgtTokens.length)) {
            return tgt;
          }
        }
        if (
          (startLocKey && startLocKey.includes(tgt.normalizedKey)) ||
          (endLocKey && endLocKey.includes(tgt.normalizedKey))
        ) {
          return tgt;
        }
      }

      // 3. Check area/subdistrict synonym match between Form Kirim customer name/address and GPS stop location
      for (const tgt of targets) {
        const tgtMetaLower = `${tgt.namaPelanggan} ${tgt.alamatPelanggan}`.toLowerCase();
        for (const group of AREA_SYNONYM_GROUPS) {
          const locInGroup = group.some(k => combinedLocLower.includes(k));
          const tgtInGroup = group.some(k => tgtMetaLower.includes(k));
          if (locInGroup && tgtInGroup) {
            return tgt;
          }
        }
      }

      return null;
    };

    const findRegisteredStoreByTargetName = (custName: string): RetailStore | null => {
      const key = normalizeStoreMatchKey(custName);
      if (!key) return null;
      return (
        registeredStores.find(st => {
          const stKey = normalizeStoreMatchKey(st.storeName);
          return stKey && (stKey === key || stKey.includes(key) || key.includes(stKey));
        }) || null
      );
    };

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
      startLat: number;
      startLng: number;
      endLat: number;
      endLng: number;
      gpsCoordLabel: string;
      matchedStore: RetailStore | null;
      distanceToStoreKm: number;
      stopCategory: 'customer_store' | 'long_non_customer' | 'short_transit' | 'moving_no_stop';
      formKirimStatus:
        | 'sesuai_form_kirim'
        | 'pelanggan_luar_form_kirim'
        | 'long_non_customer'
        | 'short_transit'
        | 'moving_no_stop';
      hasActiveFormKirimForFleet: boolean;
      matchedFormKirimNo: string;
      matchedFormKirimFaktur: string;
      matchedFormKirimCustomer: string;
      regionType: 'dalam_kota' | 'luar_kota' | 'luar_pulau';
      nomorToko: string | number;
      namaTokoAtauLokasi: string;
      kecamatan: string;
      kabupaten: string;
    }> = [];

    evalList.forEach(ev => {
      const legs = ev.tripLegs || [];
      // Track assigned Form Kirim targets & Mitra stores per dateGroup so the same store is never duplicated on multiple legs
      const usedFkTargetKeysByDate = new Map<string, Set<string>>();
      const usedStoreNamesByDate = new Map<string, Set<string>>();

      // Pre-compute stopMinutes for each leg
      const preparedLegs = legs.map((leg, idx) => {
        let stopMinutes = Number(leg.stopBeforeMinutes || 0);
        let computedStopStart = leg.stopBeforeStart || leg.endTime;
        let computedStopEnd = leg.stopBeforeEnd || leg.startTime;

        if (stopMinutes <= 0 && idx < legs.length - 1) {
          const nextLeg = legs[idx + 1];
          if (nextLeg && nextLeg.dateGroup === leg.dateGroup) {
            const curStartMin = parseClockToMinutes(leg.startTime);
            const prevEndMin = parseClockToMinutes(nextLeg.endTime);
            if (curStartMin !== null && prevEndMin !== null) {
              const gap = curStartMin - prevEndMin;
              if (gap > 0 && gap <= 600) {
                stopMinutes = gap;
                computedStopStart = nextLeg.endTime;
                computedStopEnd = leg.startTime;
              }
            }
          }
        }
        return { leg, idx, stopMinutes, computedStopStart, computedStopEnd };
      });

      // Pass 1: Direct Form Kirim matches on qualifying stop legs (stopMinutes >= 5)
      const preAssignedFkByLegIndex = new Map<number, FormKirimTargetCustomer>();

      preparedLegs.forEach(({ leg, idx, stopMinutes }) => {
        if (stopMinutes < 5) return;
        const fkBundle = getFleetFormKirimTargets(ev.plateNumber, ev.fleetId, ev.initialCode, leg.dateGroup);
        if (fkBundle.targets.length === 0) return;

        const matchStart = findMatchingRegisteredStore(
          leg.startLat,
          leg.startLng,
          leg.startLocation,
          registeredStores
        );
        if (matchStart.isNonStoreKeyword) return;

        let usedSet = usedFkTargetKeysByDate.get(leg.dateGroup);
        if (!usedSet) {
          usedSet = new Set<string>();
          usedFkTargetKeysByDate.set(leg.dateGroup, usedSet);
        }

        const availableTargets = fkBundle.targets.filter(t => !usedSet!.has(t.normalizedKey));
        const directMatch = matchTargetAgainstFormKirim(matchStart.store, leg, availableTargets);
        if (directMatch) {
          usedSet.add(directMatch.normalizedKey);
          preAssignedFkByLegIndex.set(idx, directMatch);
        }
      });

      // Pass 2: Assign remaining unassigned Form Kirim targets to remaining qualifying route stops (stopMinutes >= 5) on the same date
      preparedLegs.forEach(({ leg, idx, stopMinutes }) => {
        if (stopMinutes < 5 || preAssignedFkByLegIndex.has(idx)) return;
        const fkBundle = getFleetFormKirimTargets(ev.plateNumber, ev.fleetId, ev.initialCode, leg.dateGroup);
        if (fkBundle.targets.length === 0) return;

        const matchStart = findMatchingRegisteredStore(
          leg.startLat,
          leg.startLng,
          leg.startLocation,
          registeredStores
        );
        if (matchStart.isNonStoreKeyword) return;

        let usedSet = usedFkTargetKeysByDate.get(leg.dateGroup);
        if (!usedSet) {
          usedSet = new Set<string>();
          usedFkTargetKeysByDate.set(leg.dateGroup, usedSet);
        }

        const nextRemainingTarget = fkBundle.targets.find(t => !usedSet!.has(t.normalizedKey));
        if (nextRemainingTarget) {
          usedSet.add(nextRemainingTarget.normalizedKey);
          preAssignedFkByLegIndex.set(idx, nextRemainingTarget);
        }
      });

      // Build unified rows
      preparedLegs.forEach(({ leg, idx, stopMinutes, computedStopStart, computedStopEnd }) => {
        const fkBundle = getFleetFormKirimTargets(ev.plateNumber, ev.fleetId, ev.initialCode, leg.dateGroup);
        const hasActiveFk = fkBundle.targets.length > 0;
        const matchedFkTarget = preAssignedFkByLegIndex.get(idx) || null;

        let usedStoresOnDate = usedStoreNamesByDate.get(leg.dateGroup);
        if (!usedStoresOnDate) {
          usedStoresOnDate = new Set<string>();
          usedStoreNamesByDate.set(leg.dateGroup, usedStoresOnDate);
        }

        // Only detect a customer store visit when the vehicle actually stops >= 5 minutes (not 0m departure or 4m traffic pause)
        const matchStart = findMatchingRegisteredStore(
          leg.startLat,
          leg.startLng,
          leg.startLocation,
          registeredStores
        );

        let matchedStore: RetailStore | null = null;
        let bestDist = matchStart.distanceKm;

        if (matchedFkTarget) {
          const fkStore = findRegisteredStoreByTargetName(matchedFkTarget.namaPelanggan);
          if (fkStore) {
            matchedStore = fkStore;
            bestDist = calculateDistanceKm(leg.startLat, leg.startLng, fkStore.latitude, fkStore.longitude);
            usedStoresOnDate.add(fkStore.storeName.toUpperCase());
          }
        } else if (stopMinutes >= 5 && !matchStart.isNonStoreKeyword && !hasActiveFk) {
          const candidate = matchStart.store;
          if (candidate && !usedStoresOnDate.has(candidate.storeName.toUpperCase())) {
            matchedStore = candidate;
            usedStoresOnDate.add(candidate.storeName.toUpperCase());
          }
        }

        let stopCategory: 'customer_store' | 'long_non_customer' | 'short_transit' | 'moving_no_stop' =
          'moving_no_stop';

        if (stopMinutes >= 5) {
          if (matchedFkTarget || (matchedStore && !matchStart.isNonStoreKeyword)) {
            stopCategory = 'customer_store';
          } else if (stopMinutes >= 15) {
            stopCategory = 'long_non_customer';
          } else {
            stopCategory = 'short_transit';
          }
        } else if (stopMinutes > 0) {
          stopCategory = 'short_transit';
        } else {
          stopCategory = 'moving_no_stop';
        }

        let formKirimStatus:
          | 'sesuai_form_kirim'
          | 'pelanggan_luar_form_kirim'
          | 'long_non_customer'
          | 'short_transit'
          | 'moving_no_stop' = 'moving_no_stop';

        if (matchedFkTarget) {
          formKirimStatus = 'sesuai_form_kirim';
        } else if (stopCategory === 'customer_store' && matchedStore) {
          formKirimStatus = 'pelanggan_luar_form_kirim';
        } else if (stopCategory === 'long_non_customer') {
          formKirimStatus = 'long_non_customer';
        } else if (stopCategory === 'short_transit') {
          formKirimStatus = 'short_transit';
        }

        const locType = matchedStore
          ? getStoreLocationType(matchedStore)
          : matchedFkTarget
          ? 'dalam_kota'
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
          stopStart: computedStopStart,
          stopEnd: computedStopEnd,
          startLat: leg.startLat,
          startLng: leg.startLng,
          endLat: leg.endLat,
          endLng: leg.endLng,
          gpsCoordLabel:
            leg.startLat && leg.startLng
              ? `${Number(leg.startLat).toFixed(6)}, ${Number(leg.startLng).toFixed(6)}`
              : leg.endLat && leg.endLng
              ? `${Number(leg.endLat).toFixed(6)}, ${Number(leg.endLng).toFixed(6)}`
              : '-',
          matchedStore,
          distanceToStoreKm: Number(bestDist.toFixed(2)),
          stopCategory,
          formKirimStatus,
          hasActiveFormKirimForFleet: hasActiveFk,
          matchedFormKirimNo: matchedFkTarget?.noFormKirim || '',
          matchedFormKirimFaktur: matchedFkTarget?.noFaktur || '',
          matchedFormKirimCustomer: matchedFkTarget?.namaPelanggan || '',
          regionType: locType,
          nomorToko: matchedStore?.nomor ?? (matchedFkTarget ? 'FK' : '-'),
          namaTokoAtauLokasi: matchedFkTarget
            ? matchedFkTarget.namaPelanggan
            : matchedStore
            ? matchedStore.storeName
            : leg.startLocation.split(',')[0] || leg.endLocation.split(',')[0],
          kecamatan:
            matchedStore?.kecamatan ||
            (matchedFkTarget?.alamatPelanggan ? matchedFkTarget.alamatPelanggan.split('-')[0].trim() : '') ||
            leg.matchedStoreKecamatan ||
            '-',
          kabupaten:
            matchedStore?.kabupaten ||
            leg.matchedStoreKabupaten ||
            (locType === 'dalam_kota' ? 'Banyuwangi' : locType === 'luar_kota' ? 'Jatim' : 'Bali')
        });
      });
    });

    return results;
  }, [branchScopedEvaluations, activeEvaluation, selectedFleetPlate, registeredStores, getFleetFormKirimTargets]);

  // Filtered unified rows
  const filteredUnifiedRows = useMemo(() => {
    return unifiedRows.filter(item => {
      if (selectedDateGroup !== 'all' && item.dateGroup !== selectedDateGroup) return false;
      if (activityFilter === 'sesuai_form_kirim' && item.formKirimStatus !== 'sesuai_form_kirim') return false;
      if (activityFilter === 'pelanggan_luar_form_kirim' && item.formKirimStatus !== 'pelanggan_luar_form_kirim') return false;
      if (activityFilter === 'long_non_customer' && item.formKirimStatus !== 'long_non_customer') return false;

      if (!searchFilter.trim()) return true;
      const q = searchFilter.toLowerCase();
      return (
        item.namaTokoAtauLokasi.toLowerCase().includes(q) ||
        item.matchedFormKirimNo.toLowerCase().includes(q) ||
        item.matchedFormKirimCustomer.toLowerCase().includes(q) ||
        item.kecamatan.toLowerCase().includes(q) ||
        item.kabupaten.toLowerCase().includes(q) ||
        item.startLocation.toLowerCase().includes(q) ||
        item.endLocation.toLowerCase().includes(q) ||
        item.fleetPlate.toLowerCase().includes(q)
      );
    });
  }, [unifiedRows, selectedDateGroup, activityFilter, searchFilter]);

  // Summary counts & total stop minutes + Form Kirim compliance summary for the unified tab
  const unifiedStats = useMemo(() => {
    const dateFiltered =
      selectedDateGroup === 'all' ? unifiedRows : unifiedRows.filter(r => r.dateGroup === selectedDateGroup);
    const sesuaiFormKirim = dateFiltered.filter(r => r.formKirimStatus === 'sesuai_form_kirim');
    const luarFormKirim = dateFiltered.filter(r => r.formKirimStatus === 'pelanggan_luar_form_kirim');
    const longNonCustomerStops = dateFiltered.filter(r => r.formKirimStatus === 'long_non_customer');
    const totalStopMinutes = dateFiltered.reduce((sum, r) => sum + (r.stopDurationMinutes || 0), 0);
    const sesuaiStopMinutes = sesuaiFormKirim.reduce((sum, r) => sum + (r.stopDurationMinutes || 0), 0);
    const luarFkStopMinutes = luarFormKirim.reduce((sum, r) => sum + (r.stopDurationMinutes || 0), 0);
    const nonMitraStopMinutes = longNonCustomerStops.reduce((sum, r) => sum + (r.stopDurationMinutes || 0), 0);

    // Aggregate Form Kirim targets for active selection to show visited vs unvisited customers
    const activeEvals =
      selectedFleetPlate === 'all' ? branchScopedEvaluations : [activeEvaluation].filter(Boolean) as TrackingEvaluation[];
    const linkedFormKirimNos = new Set<string>();
    const targetCustomerMap = new Map<string, { namaPelanggan: string; noFormKirim: string; visited: boolean }>();
    const visitedKeys = new Set(
      sesuaiFormKirim.map(r => normalizeStoreMatchKey(r.matchedFormKirimCustomer || r.namaTokoAtauLokasi))
    );

    activeEvals.forEach(ev => {
      const fk = getFleetFormKirimTargets(
        ev.plateNumber,
        ev.fleetId,
        ev.initialCode,
        selectedDateGroup === 'all' ? undefined : selectedDateGroup
      );
      fk.records.forEach(r => linkedFormKirimNos.add(r.noFormKirim));
      fk.targets.forEach(t => {
        if (!t.normalizedKey) return;
        const alreadyVisited = visitedKeys.has(t.normalizedKey);
        const existing = targetCustomerMap.get(t.normalizedKey);
        if (!existing || (!existing.visited && alreadyVisited)) {
          targetCustomerMap.set(t.normalizedKey, {
            namaPelanggan: t.namaPelanggan,
            noFormKirim: t.noFormKirim,
            visited: alreadyVisited
          });
        }
      });
    });

    const formKirimTargetList = Array.from(targetCustomerMap.values());
    const formKirimVisitedCount = formKirimTargetList.filter(t => t.visited).length;
    const formKirimUnvisited = formKirimTargetList.filter(t => !t.visited);

    return {
      totalLegs: dateFiltered.length,
      totalStopMinutes,
      sesuaiFormKirimCount: sesuaiFormKirim.length,
      sesuaiStopMinutes,
      pelangganLuarFormKirimCount: luarFormKirim.length,
      luarFkStopMinutes,
      longNonCustomerCount: longNonCustomerStops.length,
      nonMitraStopMinutes,
      linkedFormKirimNos: Array.from(linkedFormKirimNos),
      formKirimTotalTargets: formKirimTargetList.length,
      formKirimVisitedCount,
      formKirimUnvisited
    };
  }, [unifiedRows, selectedDateGroup, selectedFleetPlate, branchScopedEvaluations, activeEvaluation, getFleetFormKirimTargets]);

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
          const colDate = headers.findIndex((h: string) =>
            h === 'tanggal' || h === 'date' || h.includes('tgl')
          );
          const colStartTime = headers.findIndex((h: string) =>
            h.includes('start time') || h.includes('waktu mulai') || h === 'time' || h === 'waktu'
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
          const colStartLat = headers.findIndex((h: string) =>
            h.includes('start lat') || h.includes('lat awal') || h === 'lat' || h === 'latitude' || (h.includes('latitude') && !h.includes('end') && !h.includes('akhir'))
          );
          const colStartLng = headers.findIndex((h: string) =>
            h.includes('start lng') || h.includes('start lon') || h.includes('lng awal') || h === 'lng' || h === 'lon' || h === 'longitude' || (h.includes('longitude') && !h.includes('end') && !h.includes('akhir'))
          );
          const colEndLat = headers.findIndex((h: string) =>
            h.includes('end lat') || h.includes('lat akhir') || (h.includes('latitude') && (h.includes('end') || h.includes('akhir')))
          );
          const colEndLng = headers.findIndex((h: string) =>
            h.includes('end lng') || h.includes('end lon') || h.includes('lng akhir') || (h.includes('longitude') && (h.includes('end') || h.includes('akhir')))
          );
          const colCoordPair = headers.findIndex((h: string) =>
            h.includes('koordinat') || h === 'gps' || h.includes('coord')
          );

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

          const parseCoordNum = (raw: any): number | null => {
            if (raw === undefined || raw === null) return null;
            const s = String(raw).trim().replace(',', '.');
            if (!s) return null;
            const n = Number(s);
            return !Number.isNaN(n) && Number.isFinite(n) && Math.abs(n) > 0.01 ? n : null;
          };

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

            // Date group header row (e.g., 2026-10-26 alone on the row)
            if (colDate === -1 && cell0.match(/^\d{4}-\d{2}-\d{2}$/)) {
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

            if (colDate >= 0) {
              const rowDateStr = String(row[colDate] || '').trim();
              if (rowDateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
                currentDateGroup = rowDateStr.slice(0, 10);
              }
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

            const parsedStartLat = colStartLat >= 0 ? parseCoordNum(row[colStartLat]) : null;
            const parsedStartLng = colStartLng >= 0 ? parseCoordNum(row[colStartLng]) : null;
            const parsedEndLat = colEndLat >= 0 ? parseCoordNum(row[colEndLat]) : null;
            const parsedEndLng = colEndLng >= 0 ? parseCoordNum(row[colEndLng]) : null;

            let pairLat: number | null = null;
            let pairLng: number | null = null;
            if (colCoordPair >= 0 && row[colCoordPair]) {
              const parts = String(row[colCoordPair]).split(/[,;\s]+/).map(s => Number(s.trim())).filter(n => !Number.isNaN(n));
              if (parts.length >= 2 && Math.abs(parts[0]) <= 90 && Math.abs(parts[1]) <= 180) {
                pairLat = parts[0];
                pairLng = parts[1];
              }
            }

            if (timeOnlyStart && (rawStartLoc || (parsedStartLat !== null && parsedStartLng !== null) || (pairLat !== null && pairLng !== null))) {
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
              if (parsedStartLat !== null && parsedStartLng !== null) {
                sLat = parsedStartLat;
                sLng = parsedStartLng;
              } else if (pairLat !== null && pairLng !== null) {
                sLat = pairLat;
                sLng = pairLng;
              } else {
                [sLat, sLng] = resolveTracksolidCoords(rawStartLoc, legCounter, registeredStores);
              }

              let eLat = sLat;
              let eLng = sLng;
              if (parsedEndLat !== null && parsedEndLng !== null) {
                eLat = parsedEndLat;
                eLng = parsedEndLng;
              } else if (rawEndLoc && rawEndLoc !== rawStartLoc) {
                [eLat, eLng] = resolveTracksolidCoords(rawEndLoc, legCounter + 1, registeredStores);
              }

              parsedLegs.push({
                legNumber: legCounter++,
                dateGroup: currentDateGroup,
                startTime: timeOnlyStart,
                startLocation: rawStartLoc || `${sLat.toFixed(6)}, ${sLng.toFixed(6)}`,
                endTime: timeOnlyEnd || timeOnlyStart,
                endLocation: rawEndLoc || rawStartLoc || `${eLat.toFixed(6)}, ${eLng.toFixed(6)}`,
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
      setErrorMessage('Pilih file Excel (.xls, .xlsx, .csv) rute GPS terlebih dahulu.');
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
          .join(', ')}) periode ${uploadMonth} ${uploadYear}.`
      );
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal memproses file Excel GPS.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Download template Excel siap isi & langsung terbaca dalam 1x upload (termasuk kolom Koordinat GPS otomatis)
  const handleDownloadTemplate = () => {
    const sheetData: any[][] = [
      [
        'Tanggal',
        'Start time',
        'Start location',
        'Start Lat',
        'Start Lng',
        'End time',
        'End location',
        'End Lat',
        'End Lng',
        'Total Mileage(km)',
        'Travel time',
        'Average Speed',
        'Max. speed(km/h)'
      ]
    ];

    DEFAULT_TRACKSOLID_26_LEGS.forEach(l => {
      sheetData.push([
        l.dateGroup,
        l.startTime,
        l.startLocation,
        Number(l.startLat.toFixed(6)),
        Number(l.startLng.toFixed(6)),
        l.endTime,
        l.endLocation,
        Number(l.endLat.toFixed(6)),
        Number(l.endLng.toFixed(6)),
        l.mileageKm,
        l.travelTime,
        l.avgSpeedKmh,
        l.maxSpeedKmh
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    ws['!cols'] = [
      { wch: 13 },
      { wch: 12 },
      { wch: 44 },
      { wch: 13 },
      { wch: 13 },
      { wch: 12 },
      { wch: 44 },
      { wch: 13 },
      { wch: 13 },
      { wch: 18 },
      { wch: 13 },
      { wch: 15 },
      { wch: 17 }
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template_Rute_GPS');
    XLSX.writeFile(wb, `Template_Evaluasi_Rute_GPS_AKK.xlsx`);
  };

  // Export Unified Analysis to Excel (.XLSX) including automatic GPS coordinates
  const handleExportUnifiedAnalysis = () => {
    const rows = filteredUnifiedRows.map(item => ({
      Armada: `${item.fleetInitial} (${item.fleetPlate})`,
      'Status GPS': 'Terhubung',
      Ritase: `#${item.legNumber}`,
      Tanggal: item.dateGroup,
      'Jam Mulai Gerak': item.startTime,
      'Jam Selesai Gerak': item.endTime,
      'Durasi Gerak': item.travelTime,
      'Lama Berhenti (Menit)': item.stopDurationMinutes,
      'Keterangan Lama Berhenti': `${item.stopDurationMinutes} Menit`,
      'Status Form Kirim & Mitra':
        item.formKirimStatus === 'sesuai_form_kirim'
          ? 'SESUAI FORM KIRIM (TOKO MITRA PELANGGAN)'
          : item.formKirimStatus === 'pelanggan_luar_form_kirim'
          ? 'PELANGGAN TIDAK SESUAI FORM KIRIM (DI LUAR DAFTAR FORM KIRIM)'
          : item.formKirimStatus === 'long_non_customer'
          ? 'PERINGATAN: BERHENTI LAMA DI LUAR TOKO MITRA (>= 15 MENIT)'
          : item.formKirimStatus === 'short_transit'
          ? 'Transit Singkat Non-Mitra'
          : 'Bergerak Langsung',
      'No Form Kirim': item.matchedFormKirimNo || '-',
      'Pelanggan Form Kirim': item.matchedFormKirimCustomer || '-',
      'Nomor Toko': item.nomorToko,
      'Nama Toko Pelanggan / Lokasi Stop': item.namaTokoAtauLokasi,
      'Latitude GPS': item.startLat ? Number(item.startLat.toFixed(6)) : '',
      'Longitude GPS': item.startLng ? Number(item.startLng.toFixed(6)) : '',
      'Koordinat GPS': item.gpsCoordLabel,
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

  // Dedicated Excel Report: Berhenti di Toko Selain Pelanggan dari Form Kirim (with automatic GPS coordinates)
  const handleExportNonFormKirimReport = () => {
    const nonFkRows = unifiedRows.filter(
      item =>
        (selectedDateGroup === 'all' || item.dateGroup === selectedDateGroup) &&
        (item.formKirimStatus === 'pelanggan_luar_form_kirim' || item.formKirimStatus === 'long_non_customer')
    );
    const rows = nonFkRows.map((item, idx) => ({
      No: idx + 1,
      'Inisial Armada': item.fleetInitial,
      'Plat Nomor': item.fleetPlate,
      Tanggal: item.dateGroup,
      Ritase: `#${item.legNumber}`,
      'Jam Berhenti': `${item.stopStart.slice(0, 5)} - ${item.stopEnd.slice(0, 5)}`,
      'Lama Berhenti (Menit)': item.stopDurationMinutes,
      Kategori:
        item.formKirimStatus === 'pelanggan_luar_form_kirim'
          ? 'Berhenti di Toko Mitra Selain Form Kirim'
          : 'Berhenti Lama Bukan Toko Mitra (>= 15 Menit)',
      'Nama Toko / Lokasi Stop': item.namaTokoAtauLokasi,
      'Alamat GPS Terbaca': item.startLocation,
      'Latitude GPS': item.startLat ? Number(item.startLat.toFixed(6)) : '',
      'Longitude GPS': item.startLng ? Number(item.startLng.toFixed(6)) : '',
      'Koordinat GPS': item.gpsCoordLabel,
      Kecamatan: item.kecamatan,
      Kabupaten: item.kabupaten
    }));

    const ws = XLSX.utils.json_to_sheet(
      rows.length > 0
        ? rows
        : [{ Keterangan: 'Tidak ada pemberhentian di luar pelanggan Form Kirim pada filter tanggal & armada ini.' }]
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Stop_Luar_Form_Kirim');
    XLSX.writeFile(wb, `Laporan_Stop_Selain_Form_Kirim_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const toggleMultiFleetSelection = (fleetId: string) => {
    setSelectedMultiFleetIds(prev =>
      prev.includes(fleetId) ? prev.filter(id => id !== fleetId) : [...prev, fleetId]
    );
  };

  const bottom = activeEvaluation?.bottomSummary || DEFAULT_TRACKSOLID_BOTTOM_SUMMARY;
  const subtotals = activeEvaluation?.dateSubtotals || DEFAULT_TRACKSOLID_DATE_SUBTOTALS;

  // ============================================================================
  // RENDER UPLOAD FORM SCREEN (MATCHING IMAGE 2 + FLEET SPEC)
  // ============================================================================
  if (viewMode === 'upload_form') {
    return (
      <div className="space-y-5">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
          {/* Header Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-2.5">
                <FileSpreadsheet className="w-5 h-5 text-indigo-400" />
                <h2 className="text-lg font-bold text-white">
                  Unggah File Evaluasi Rute GPS Armada
                </h2>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Pilih periode bulan, format data log GPS, spesifikasi armada (1 atau beberapa armada), dan unggah file Excel (.xls, .xlsx, .csv).
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs transition cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Template Excel</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('evaluation')}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Kembali ke Peta &amp; Analisa Rute</span>
              </button>
            </div>
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

          {/* Row 2: PILIHAN FORMAT STRUKTUR DATA GPS */}
          <div className="space-y-2">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
              Format Struktur Data Log GPS
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div
                onClick={() => setGpsPlatform('tracksolid')}
                className={`p-3.5 rounded-xl border cursor-pointer transition flex items-start gap-3 ${
                  gpsPlatform === 'tracksolid'
                    ? 'bg-indigo-600/15 border-indigo-500 text-white shadow-sm'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full border flex items-center justify-center mt-0.5 shrink-0 ${
                    gpsPlatform === 'tracksolid' ? 'border-indigo-400 bg-indigo-600' : 'border-slate-600'
                  }`}
                >
                  {gpsPlatform === 'tracksolid' && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Format Log Trips &amp; Ritase Perjalanan</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Mendukung file log ritase lengkap dengan kolom tanggal, waktu tempuh, titik berangkat, tiba, dan durasi berhenti.
                  </div>
                </div>
              </div>

              <div
                onClick={() => setGpsPlatform('wanway')}
                className={`p-3.5 rounded-xl border cursor-pointer transition flex items-start gap-3 ${
                  gpsPlatform === 'wanway'
                    ? 'bg-indigo-600/15 border-indigo-500 text-white shadow-sm'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full border flex items-center justify-center mt-0.5 shrink-0 ${
                    gpsPlatform === 'wanway' ? 'border-indigo-400 bg-indigo-600' : 'border-slate-600'
                  }`}
                >
                  {gpsPlatform === 'wanway' && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Format Log Koordinat &amp; Jejak GPS</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Mendukung file histori koordinat latitude, longitude, kecepatan berkendara, dan status mesin armada.
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
                    ? 'bg-indigo-600/15 border-indigo-500 text-white shadow-sm'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full border flex items-center justify-center mt-0.5 shrink-0 ${
                    fleetScopeMode === 'single' ? 'border-indigo-400 bg-indigo-600' : 'border-slate-600'
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
                    ? 'bg-indigo-600/15 border-indigo-500 text-white shadow-sm'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full border flex items-center justify-center mt-0.5 shrink-0 ${
                    fleetScopeMode === 'multiple' ? 'border-indigo-400 bg-indigo-600' : 'border-slate-600'
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

            {/* Selector Unit Armada — Redesigned Custom Dropdown (Hanya Inisial Mobil) */}
            {fleetScopeMode === 'single' ? (() => {
              const selectableFleets = branchScopedFleets.length > 0 ? branchScopedFleets : fleets;
              const selectedFleetObj =
                selectableFleets.find(f => f.id === selectedSingleFleetId) ||
                fleets.find(f => f.id === selectedSingleFleetId) ||
                selectableFleets[0];
              const filteredUploadFleets = selectableFleets.filter(f => {
                if (!uploadFleetSearchQuery.trim()) return true;
                const q = uploadFleetSearchQuery.toLowerCase();
                return (f.initialCode || f.plateNumber || '').toLowerCase().includes(q);
              });

              return (
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
                      Pilih Inisial Armada untuk File Ini
                    </label>
                    <span className="text-[10px] font-semibold text-slate-400">
                      {selectableFleets.length} Unit Tersedia
                    </span>
                  </div>

                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsUploadFleetDropdownOpen(prev => !prev)}
                      className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-slate-900 border transition cursor-pointer ${
                        isUploadFleetDropdownOpen
                          ? 'border-indigo-500 ring-2 ring-indigo-500/20'
                          : 'border-slate-700 hover:border-indigo-400/70'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center shrink-0">
                          <Truck className="w-3.5 h-3.5 text-indigo-400" />
                        </div>
                        <span className="font-mono font-black text-sm text-white tracking-wide truncate">
                          {selectedFleetObj?.initialCode || selectedFleetObj?.plateNumber || 'Pilih Inisial Mobil'}
                        </span>
                      </div>
                      <ChevronDown
                        className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-150 ${
                          isUploadFleetDropdownOpen ? 'rotate-180 text-indigo-400' : ''
                        }`}
                      />
                    </button>

                    {isUploadFleetDropdownOpen && (
                      <>
                        <div
                          className="fixed inset-0 z-40"
                          onClick={() => setIsUploadFleetDropdownOpen(false)}
                        />
                        <div className="absolute left-0 right-0 top-full mt-2 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-2.5 z-50 space-y-2 animate-in fade-in zoom-in-95 duration-100">
                          <div className="relative">
                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                              type="text"
                              value={uploadFleetSearchQuery}
                              onChange={e => setUploadFleetSearchQuery(e.target.value)}
                              onClick={e => e.stopPropagation()}
                              placeholder="Cari inisial mobil (misal: N1, N20, S1)..."
                              className="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                            />
                          </div>

                          <div className="max-h-56 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5 pr-1">
                            {filteredUploadFleets.length === 0 ? (
                              <div className="col-span-full py-4 text-center text-xs text-slate-400">
                                Inisial mobil tidak ditemukan.
                              </div>
                            ) : (
                              filteredUploadFleets.map(f => {
                                const isSel = f.id === selectedSingleFleetId;
                                const initOnly = f.initialCode || f.plateNumber;
                                return (
                                  <button
                                    key={f.id}
                                    type="button"
                                    onClick={() => {
                                      setSelectedSingleFleetId(f.id);
                                      setIsUploadFleetDropdownOpen(false);
                                      setUploadFleetSearchQuery('');
                                    }}
                                    className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border text-left transition cursor-pointer ${
                                      isSel
                                        ? 'bg-indigo-600 text-white border-indigo-400 shadow-sm'
                                        : 'bg-slate-950/80 hover:bg-slate-800 text-slate-200 border-slate-800 hover:border-slate-600'
                                    }`}
                                  >
                                    <span className="font-mono font-extrabold text-xs tracking-wide truncate">
                                      {initOnly}
                                    </span>
                                    {isSel && <Check className="w-3.5 h-3.5 text-white shrink-0" />}
                                  </button>
                                );
                              })
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })() : (
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
                    Pilih Beberapa Inisial Armada ({selectedMultiFleetIds.length} Dipilih)
                  </span>
                  <div className="flex items-center gap-2 text-[11px]">
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedMultiFleetIds(
                          (branchScopedFleets.length > 0 ? branchScopedFleets : fleets).map(f => f.id)
                        )
                      }
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
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-48 overflow-y-auto pr-1">
                  {(branchScopedFleets.length > 0 ? branchScopedFleets : fleets).map(f => {
                    const checked = selectedMultiFleetIds.includes(f.id);
                    const initOnly = f.initialCode || f.plateNumber;
                    return (
                      <div
                        key={f.id}
                        onClick={() => toggleMultiFleetSelection(f.id)}
                        className={`px-3 py-2.5 rounded-xl border text-xs flex items-center justify-between gap-2 cursor-pointer transition ${
                          checked
                            ? 'bg-indigo-600/20 border-indigo-500 text-white font-bold'
                            : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <span className="font-mono font-extrabold truncate">{initOnly}</span>
                        <div
                          className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 ${
                            checked ? 'bg-indigo-600 border-indigo-400 text-white' : 'border-slate-600'
                          }`}
                        >
                          {checked && <Check className="w-3 h-3" />}
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

          {/* Row 5: FILE UPLOAD DASHED BOX + TEMPLATE SIAP UPLOAD */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
                File Evaluasi GPS (.xlsx / .xls / .csv)
              </label>
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-400 hover:text-emerald-300 transition cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Unduh File Template Siap Upload (Lengkap Koordinat GPS)</span>
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
                Gunakan tombol <strong className="text-emerald-300">Download Template Excel</strong> agar seluruh kolom (Tanggal, Jam, Lokasi, Start/End Lat-Lng GPS, Jarak, Durasi, Kecepatan) langsung terbaca otomatis dalam sekali upload.
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
              <span>Lihat Riwayat Upload ({branchScopedEvaluations.length} Armada)</span>
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
                      <th className="py-2.5 px-3">Status GPS</th>
                      <th className="py-2.5 px-3">Periode</th>
                      <th className="py-2.5 px-3">Total Ritase</th>
                      <th className="py-2.5 px-3">Total Jarak</th>
                      <th className="py-2.5 px-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {branchScopedEvaluations.map(ev => (
                      <tr key={ev.plateNumber} className="hover:bg-slate-800/40">
                        <td className="py-2.5 px-3 font-bold text-white">
                          {ev.plateNumber} {ev.initialCode ? `[${ev.initialCode}]` : ''}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[10px] font-semibold">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> GPS Aktif
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
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-medium mb-1.5">
            <Truck className="w-3.5 h-3.5" />
            <span>Rute GPS &amp; Analisa Ritase • Terintegrasi Jaringan Toko &amp; Mitra</span>
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            Peta Rute GPS &amp; Analisa Armada Kirim ke Pelanggan
          </h2>
          <p className="text-xs text-slate-300 mt-1">
            Rincian perjalanan setiap armada (ritase, jarak tempuh, durasi per hari, rata-rata kecepatan harian, kecepatan maksimal) serta analisa berhenti di toko pelanggan vs berhenti lama non-mitra.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setViewMode('upload_form')}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-600/20 transition cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            <span>Unggah File Excel Rute GPS</span>
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

      {/* Fleet Selector Dropdown & Selected Fleet Specifications Breakdown */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400">
              <Truck className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Pilih Unit Armada GPS
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold">
                  <Store className="w-3 h-3" />
                  Terintegrasi {validMappedStoresCount} Titik Toko Pelanggan
                </span>
              </div>
              <span className="text-[11px] text-slate-300 block mt-0.5">
                Pilih cabang &amp; armada untuk menganalisa jejak trips rute terhadap titik toko pelanggan
              </span>
            </div>
          </div>

          {/* Branch Filter + Enhanced Dropdown List Armada */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 w-full lg:w-auto">
            {/* Branch Filter */}
            <div className="flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <select
                value={effectiveBranchId}
                disabled={accessibleBranches.length <= 1}
                onChange={e => {
                  const val = e.target.value;
                  setSelectedBranchId(val);
                  branchStore.setSelectedOriginBranchId(val);
                }}
                aria-label="Filter Cabang Analisa Rute GPS"
                className="min-h-[40px] px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 hover:border-emerald-500/60 text-xs font-bold text-emerald-300 focus:outline-none focus:border-emerald-500 cursor-pointer disabled:opacity-80"
              >
                {accessibleBranches.length > 1 && <option value="ALL">Semua Cabang</option>}
                {accessibleBranches.map(b => (
                  <option key={b.id} value={b.id}>
                    Cabang {b.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="relative w-full sm:w-80">
              <button
                type="button"
                onClick={() => setIsFleetDropdownOpen(!isFleetDropdownOpen)}
                className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 hover:border-indigo-500 text-xs font-bold text-white transition cursor-pointer shadow-xs"
              >
                {(() => {
                  const selEv =
                    branchScopedEvaluations.find(e => e.plateNumber === selectedFleetPlate) ||
                    branchScopedEvaluations[0];
                  if (!selEv) {
                    return (
                      <span className="text-slate-400 font-medium truncate">
                        Belum ada armada di cabang ini ({branchScopedFleets.length})
                      </span>
                    );
                  }
                  const selSpec = branchScopedFleets.find(
                    f => f.id === selEv.fleetId || f.plateNumber === selEv.plateNumber
                  );
                  const initLabel = selEv.initialCode || selSpec?.initialCode || 'UNIT';
                  const vType = selSpec?.vehicleType ? ` • ${selSpec.vehicleType}` : '';
                  return (
                    <div className="flex items-center gap-2 truncate">
                      <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-mono text-[10px] font-bold shrink-0">
                        [{initLabel}]
                      </span>
                      <span className="truncate text-white font-mono">{selEv.plateNumber}</span>
                      <span className="text-slate-400 text-[11px] font-normal truncate hidden sm:inline">{vType}</span>
                    </div>
                  );
                })()}
                <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${isFleetDropdownOpen ? 'rotate-180 text-indigo-400' : ''}`} />
              </button>

              {isFleetDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsFleetDropdownOpen(false)}
                  />
                  <div className="absolute right-0 top-full mt-2 w-full sm:w-96 bg-slate-950 border border-slate-700/80 rounded-2xl shadow-2xl p-2 z-50 space-y-1.5 animate-in fade-in zoom-in-95 duration-100">
                    {branchScopedEvaluations.length > 4 && (
                      <div className="p-1.5">
                        <div className="relative">
                          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            placeholder="Cari armada..."
                            value={fleetSearchQuery}
                            onChange={e => setFleetSearchQuery(e.target.value)}
                            className="w-full pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                            onClick={e => e.stopPropagation()}
                          />
                        </div>
                      </div>
                    )}

                    <div className="max-h-64 overflow-y-auto space-y-1 pr-1">
                      {branchScopedEvaluations.length === 0 ? (
                        <div className="p-3 text-center text-xs text-slate-400">
                          Belum ada unit armada terdaftar di cabang yang dipilih.
                        </div>
                      ) : (
                        branchScopedEvaluations
                          .filter(ev => {
                            if (!fleetSearchQuery.trim()) return true;
                            const q = fleetSearchQuery.toLowerCase();
                            return (
                              (ev.plateNumber && ev.plateNumber.toLowerCase().includes(q)) ||
                              (ev.initialCode && ev.initialCode.toLowerCase().includes(q))
                            );
                          })
                          .map(ev => {
                            const plateStr = ev.plateNumber || 'P 8381 VE';
                            const fleetSpec = branchScopedFleets.find(
                              f => f.id === ev.fleetId || f.plateNumber === ev.plateNumber
                            );
                            const initLabel = ev.initialCode || fleetSpec?.initialCode || 'UNIT';
                            const isSelected = (selectedFleetPlate === 'all' ? branchScopedEvaluations[0]?.plateNumber : selectedFleetPlate) === plateStr;
                            const tripCount = ev.tripLegs?.length || 0;
                            const totalKm = ev.totalDistanceKm || ev.bottomSummary?.totalMileageKm || 0;

                            return (
                              <button
                                key={plateStr}
                                type="button"
                                onClick={() => {
                                  setSelectedFleetPlate(plateStr);
                                  setIsFleetDropdownOpen(false);
                                  setFleetSearchQuery('');
                                }}
                                className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left transition cursor-pointer ${
                                  isSelected
                                    ? 'bg-indigo-600/20 border border-indigo-500/50 text-white'
                                    : 'hover:bg-slate-900 text-slate-300 border border-transparent'
                                }`}
                              >
                                <div className="flex items-center gap-2.5 truncate">
                                  <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-mono text-[10px] font-bold shrink-0">
                                    [{initLabel}]
                                  </span>
                                  <div className="truncate">
                                    <div className="font-mono font-bold text-xs text-white">
                                      {ev.plateNumber}
                                    </div>
                                    <div className="text-[10px] text-slate-400 truncate">
                                      {fleetSpec?.vehicleType || 'Armada Box'} {fleetSpec?.brand ? `• ${fleetSpec.brand}` : ''}
                                    </div>
                                  </div>
                                </div>

                                <div className="text-right shrink-0 ml-2">
                                  <div className="font-mono text-[11px] font-bold text-indigo-300">
                                    {tripCount} Rit
                                  </div>
                                  <div className="text-[10px] text-slate-400 font-mono">
                                    {typeof totalKm === 'number' ? totalKm.toFixed(1) : totalKm} km
                                  </div>
                                </div>
                              </button>
                            );
                          })
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Rincian Spesifik Unit Armada yang Dipilih */}
        {(() => {
          const currentEv =
            branchScopedEvaluations.find(e => e.plateNumber === selectedFleetPlate) ||
            branchScopedEvaluations[0];
          if (!currentEv) return null;

          const evBottom = currentEv.bottomSummary || {
            trips: currentEv.tripLegs?.length || 0,
            totalMileageKm: currentEv.totalDistanceKm || 0,
            duration: '00:00:00',
            avgSpeedKmh: currentEv.avgSpeedKmh || 0,
            maxSpeedKmh: currentEv.maxSpeedKmh || 0,
            totalFuelConsumptionLiters: 0
          };
          const evSubtotals = currentEv.dateSubtotals || [];
          const fleetSpec = fleets.find(
            f => f.id === currentEv.fleetId || f.plateNumber === currentEv.plateNumber
          );

          return (
            <div className="space-y-3">
              {/* Selected Armada Header Info Banner */}
              <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/40 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/30 font-mono text-xs font-black">
                    {currentEv.initialCode || fleetSpec?.initialCode || 'UNIT'}
                  </span>
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono font-black text-lg text-white">
                      {currentEv.plateNumber}
                    </span>
                    {fleetSpec?.vehicleType && (
                      <span className="px-2.5 py-0.5 rounded-lg bg-slate-800 text-white text-xs font-bold border border-slate-700">
                        {fleetSpec.vehicleType}
                      </span>
                    )}
                    {fleetSpec?.brand && (
                      <span className="text-xs text-slate-300 font-medium">
                        • {fleetSpec.brand} ({fleetSpec.year || '-'})
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* 5 KPI Cards for the Selected Armada (Simple, Clean, High Contrast) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                {/* Card 1: Trips */}
                <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl shadow-xs">
                  <div className="flex items-center justify-between text-slate-300 text-xs uppercase font-bold tracking-wider mb-1.5">
                    <span>Trips (Ritase)</span>
                    <Truck className="w-4 h-4 text-indigo-400" />
                  </div>
                  <div className="text-2xl font-black text-white">{evBottom.trips}</div>
                </div>

                {/* Card 2: Total KM */}
                <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl shadow-xs">
                  <div className="flex items-center justify-between text-slate-300 text-xs uppercase font-bold tracking-wider mb-1.5">
                    <span>Total KM</span>
                    <MapPin className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="text-2xl font-black text-emerald-300">
                    {evBottom.totalMileageKm} <span className="text-xs font-normal text-slate-300">km</span>
                  </div>
                </div>

                {/* Card 3: Durasi Per Hari */}
                <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl shadow-xs">
                  <div className="flex items-center justify-between text-slate-300 text-xs uppercase font-bold tracking-wider mb-1.5">
                    <span>Durasi Per Hari</span>
                    <Clock className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="text-2xl font-black text-amber-300 font-mono">{evBottom.duration}</div>
                </div>

                {/* Card 4: Rata-Rata Kecepatan */}
                <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl shadow-xs">
                  <div className="flex items-center justify-between text-slate-300 text-xs uppercase font-bold tracking-wider mb-1.5">
                    <span>Rata-Rata Kecepatan</span>
                    <Gauge className="w-4 h-4 text-cyan-400" />
                  </div>
                  <div className="text-2xl font-black text-cyan-300">
                    {evBottom.avgSpeedKmh} <span className="text-xs font-normal text-slate-300">km/h</span>
                  </div>
                </div>

                {/* Card 5: Kecepatan Maksimal */}
                <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl shadow-xs">
                  <div className="flex items-center justify-between text-slate-300 text-xs uppercase font-bold tracking-wider mb-1.5">
                    <span>Kecepatan Maksimal</span>
                    <TrendingUp className="w-4 h-4 text-rose-400" />
                  </div>
                  <div className="text-2xl font-black text-rose-300">
                    {evBottom.maxSpeedKmh} <span className="text-xs font-normal text-slate-300">km/h</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Redesigned Interactive Calendar Filter Bar (Menggantikan Bar Periode) */}
      {(() => {
        const currentEv =
          branchScopedEvaluations.find(e => e.plateNumber === selectedFleetPlate) ||
          branchScopedEvaluations[0];
        const subtotalsList = currentEv?.dateSubtotals || [];
        const dateRecordMap = new Map<string, TracksolidDateSubtotal>();
        subtotalsList.forEach(s => dateRecordMap.set(s.dateGroup, s));

        const filteredSubtotals =
          selectedDateGroup === 'all'
            ? subtotalsList
            : subtotalsList.filter(s => s.dateGroup === selectedDateGroup);
        const currentScopeTrips = filteredSubtotals.reduce((acc, s) => acc + (s.tripCount || 0), 0);
        const currentScopeKm = filteredSubtotals.reduce((acc, s) => acc + (s.totalMileageKm || 0), 0);

        const formatIndoDate = (isoDate: string) => {
          const [y, m, d] = isoDate.split('-').map(n => parseInt(n, 10));
          if (!y || !m || !d) return isoDate;
          const dt = new Date(y, m - 1, d);
          const days = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
          const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
          return `${days[dt.getDay()]}, ${d} ${months[m - 1]} ${y}`;
        };

        const openCalendarPopover = () => {
          if (!isCalendarPopoverOpen) {
            const refDate =
              selectedDateGroup !== 'all'
                ? selectedDateGroup
                : subtotalsList[0]?.dateGroup || new Date().toISOString().slice(0, 10);
            const [y, m] = refDate.split('-').map(n => parseInt(n, 10));
            if (y && m) {
              setCalendarViewYearMonth({ year: y, month: m - 1 });
            }
          }
          setIsCalendarPopoverOpen(prev => !prev);
        };

        const { year: calYear, month: calMonth } = calendarViewYearMonth;
        const firstDayOfMonth = new Date(calYear, calMonth, 1).getDay();
        const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
        const calendarCells: Array<number | null> = [
          ...Array.from({ length: firstDayOfMonth }, () => null),
          ...Array.from({ length: daysInMonth }, (_, i) => i + 1)
        ];
        const calMonthNames = [
          'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
          'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
        ];

        const shiftMonth = (delta: number) => {
          setCalendarViewYearMonth(prev => {
            const next = new Date(prev.year, prev.month + delta, 1);
            return { year: next.getFullYear(), month: next.getMonth() };
          });
        };

        return (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-xs">
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Interactive Calendar Trigger Button */}
              <div className="relative">
                <button
                  type="button"
                  onClick={openCalendarPopover}
                  className={`inline-flex items-center gap-2.5 px-3.5 py-2 rounded-xl border text-xs font-bold transition cursor-pointer ${
                    isCalendarPopoverOpen || selectedDateGroup !== 'all'
                      ? 'bg-indigo-600/15 border-indigo-500 text-white shadow-xs'
                      : 'bg-slate-950 border-slate-700 hover:border-indigo-400 text-slate-100'
                  }`}
                >
                  <div className="w-6 h-6 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300">
                    <CalendarDays className="w-3.5 h-3.5" />
                  </div>
                  <div className="text-left">
                    <div className="text-[10px] font-semibold text-slate-400 leading-none">
                      Kalender Tanggal Rute
                    </div>
                    <div className="text-xs font-extrabold text-white mt-0.5 leading-none">
                      {selectedDateGroup === 'all'
                        ? `Semua Tanggal (${subtotalsList.length} Hari)`
                        : formatIndoDate(selectedDateGroup)}
                    </div>
                  </div>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-400 transition-transform ${
                      isCalendarPopoverOpen ? 'rotate-180 text-indigo-400' : ''
                    }`}
                  />
                </button>

                {isCalendarPopoverOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setIsCalendarPopoverOpen(false)}
                    />
                    <div className="absolute left-0 top-full mt-2 w-80 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-4 z-50 space-y-3 animate-in fade-in zoom-in-95 duration-100">
                      {/* Month Navigation */}
                      <div className="flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => shiftMonth(-1)}
                          className="p-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white cursor-pointer"
                          aria-label="Bulan sebelumnya"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <div className="text-xs font-black text-white tracking-wide">
                          {calMonthNames[calMonth]} {calYear}
                        </div>
                        <button
                          type="button"
                          onClick={() => shiftMonth(1)}
                          className="p-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white cursor-pointer"
                          aria-label="Bulan berikutnya"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Weekday Headers */}
                      <div className="grid grid-cols-7 gap-1 text-center">
                        {['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'].map(d => (
                          <div key={d} className="text-[10px] font-bold text-slate-500 py-1">
                            {d}
                          </div>
                        ))}
                      </div>

                      {/* Day Grid */}
                      <div className="grid grid-cols-7 gap-1">
                        {calendarCells.map((dayNum, idx) => {
                          if (!dayNum) return <div key={`empty-${idx}`} className="h-9" />;
                          const iso = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                          const rec = dateRecordMap.get(iso);
                          const isSelected = selectedDateGroup === iso;
                          return (
                            <button
                              key={iso}
                              type="button"
                              onClick={() => {
                                setSelectedDateGroup(iso);
                                setIsCalendarPopoverOpen(false);
                              }}
                              title={rec ? `${rec.tripCount} Ritase • ${rec.totalMileageKm.toFixed(1)} km` : iso}
                              className={`h-9 rounded-xl flex flex-col items-center justify-center text-xs font-bold transition cursor-pointer relative ${
                                isSelected
                                  ? 'bg-indigo-600 text-white shadow-sm ring-1 ring-indigo-400'
                                  : rec
                                  ? 'bg-emerald-500/15 text-emerald-200 border border-emerald-500/30 hover:bg-emerald-500/25'
                                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                              }`}
                            >
                              <span className="leading-none">{dayNum}</span>
                              {rec && (
                                <span
                                  className={`w-1.5 h-1.5 rounded-full mt-1 ${
                                    isSelected ? 'bg-white' : 'bg-emerald-400'
                                  }`}
                                />
                              )}
                            </button>
                          );
                        })}
                      </div>

                      {/* Legend & Quick Actions */}
                      <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2 text-[11px]">
                        <span className="flex items-center gap-1.5 text-slate-400">
                          <span className="w-2 h-2 rounded-full bg-emerald-400" />
                          <span>Ada data GPS</span>
                        </span>
                        <div className="flex items-center gap-1.5">
                          {subtotalsList[0] && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedDateGroup(subtotalsList[0].dateGroup);
                                setIsCalendarPopoverOpen(false);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-indigo-300 font-bold cursor-pointer"
                            >
                              Terbaru
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedDateGroup('all');
                              setIsCalendarPopoverOpen(false);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold cursor-pointer"
                          >
                            Semua
                          </button>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Quick Chips for Available GPS Dates */}
              {subtotalsList.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSelectedDateGroup('all')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                      selectedDateGroup === 'all'
                        ? 'bg-indigo-600 text-white border-indigo-400 shadow-xs'
                        : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-600'
                    }`}
                  >
                    Semua Tanggal
                  </button>
                  {subtotalsList.slice(0, 5).map(st => {
                    const isAct = selectedDateGroup === st.dateGroup;
                    return (
                      <button
                        key={st.dateGroup}
                        type="button"
                        onClick={() => setSelectedDateGroup(st.dateGroup)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold border transition cursor-pointer flex items-center gap-1.5 ${
                          isAct
                            ? 'bg-emerald-600 text-white border-emerald-400 shadow-xs'
                            : 'bg-slate-950 text-slate-200 border-slate-800 hover:border-emerald-500/50'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${isAct ? 'bg-white' : 'bg-emerald-400'}`} />
                        <span>{formatIndoDate(st.dateGroup)}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Total KM & Trips Summary Readout */}
            <div className="flex items-center gap-2">
              <span className="px-3.5 py-1.5 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 font-mono tabular-nums font-bold text-xs">
                {currentScopeTrips} Ritase • {currentScopeKm.toFixed(1)} km
              </span>
              {selectedDateGroup !== 'all' && (
                <button
                  type="button"
                  onClick={() => setSelectedDateGroup('all')}
                  className="text-xs font-bold text-rose-400 hover:text-rose-300 cursor-pointer px-2 py-1 rounded-lg hover:bg-rose-500/10"
                  title="Tampilkan semua tanggal"
                >
                  ✕ Reset
                </button>
              )}
            </div>
          </div>
        );
      })()}

      {/* Tabs Navigation (Clean High Contrast Light & Dark) */}
      <div className="bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-1.5 rounded-2xl">
        <div className="flex items-center gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('map')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0 ${
              activeTab === 'map'
                ? 'bg-indigo-600 text-white shadow-sm border border-indigo-600'
                : 'text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
            }`}
          >
            <MapPin className={`w-3.5 h-3.5 ${activeTab === 'map' ? 'text-white' : 'text-indigo-600 dark:text-indigo-400'}`} />
            <span>Peta Rute GPS &amp; Rincian Harian Armada</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('unified_stops_customer')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0 ${
              activeTab === 'unified_stops_customer'
                ? 'bg-indigo-600 text-white shadow-sm border border-indigo-600'
                : 'text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
            }`}
          >
            <Store className={`w-3.5 h-3.5 ${activeTab === 'unified_stops_customer' ? 'text-white' : 'text-indigo-600 dark:text-indigo-400'}`} />
            <span>Armada Bergerak, Berhenti &amp; Analisa Kirim Pelanggan</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('non_form_kirim_stops')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0 ${
              activeTab === 'non_form_kirim_stops'
                ? 'bg-amber-600 text-white shadow-sm border border-amber-600'
                : 'text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 hover:bg-amber-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
            }`}
          >
            <AlertTriangle className={`w-3.5 h-3.5 ${activeTab === 'non_form_kirim_stops' ? 'text-white' : 'text-amber-600 dark:text-amber-400'}`} />
            <span>Laporan Stop Di Luar Form Kirim</span>
            {(unifiedStats.pelangganLuarFormKirimCount + unifiedStats.longNonCustomerCount) > 0 && (
              <span
                className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-black ${
                  activeTab === 'non_form_kirim_stops'
                    ? 'bg-white text-amber-700'
                    : 'bg-amber-100 dark:bg-amber-900/50 text-amber-900 dark:text-amber-200'
                }`}
              >
                {unifiedStats.pelangganLuarFormKirimCount + unifiedStats.longNonCustomerCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('speed_summary')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0 ${
              activeTab === 'speed_summary'
                ? 'bg-indigo-600 text-white shadow-sm border border-indigo-600'
                : 'text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
            }`}
          >
            <Gauge className={`w-3.5 h-3.5 ${activeTab === 'speed_summary' ? 'text-white' : 'text-indigo-600 dark:text-indigo-400'}`} />
            <span>Profil Kecepatan &amp; Rekapitulasi Per Hari</span>
          </button>
        </div>
      </div>

      {/* ======================================================================
          TAB 1: PETA VISUALISASI RUTE GPS & RINCIAN HARIAN SETIAP ARMADA
         ====================================================================== */}
      {activeTab === 'map' && (
        <div className="space-y-4">
          <GpsFleetTripsMap
            plateNumber={activeEvaluation?.plateNumber || selectedFleetPlate}
            initialCode={activeEvaluation?.initialCode || 'UNIT'}
            vehicleType={fleets.find(f => f.plateNumber === (activeEvaluation?.plateNumber || selectedFleetPlate))?.vehicleType || 'Armada Box'}
            tripLegs={activeEvaluation?.tripLegs || []}
            points={activeEvaluation?.points || []}
            stops={activeEvaluation?.stops || []}
            stores={registeredStores}
            selectedDateFilter={selectedDateGroup}
            onSelectDateFilter={setSelectedDateGroup}
            dateScopeMode={calendarScopeMode}
            onSelectDateScopeMode={setCalendarScopeMode}
            selectedMonth={uploadMonth}
            selectedYear={uploadYear}
            heightClass="h-[620px] w-full"
          />

          {/* Rincian Setiap Armada & Per Hari Table (No Fuel!) */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">
                  Rincian Performa Setiap Armada & Per Hari
                </h3>
                <p className="text-xs text-slate-400">
                  {selectedFleetPlate === 'all'
                    ? 'Rekapitulasi trips, total km, durasi per hari, rata-rata kecepatan, dan kecepatan maksimal seluruh armada cabang.'
                    : `Rekapitulasi harian khusus armada terpilih: ${activeEvaluation?.plateNumber || selectedFleetPlate}${activeEvaluation?.initialCode ? ` [${activeEvaluation.initialCode}]` : ''}.`}
                </p>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-[11px] uppercase font-bold text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Armada</th>
                    <th className="py-3 px-3">Status GPS</th>
                    <th className="py-3 px-3">Tanggal (Hari)</th>
                    <th className="py-3 px-3 text-right">Trips (Ritase)</th>
                    <th className="py-3 px-3 text-right">Total KM</th>
                    <th className="py-3 px-3">Durasi Per Hari</th>
                    <th className="py-3 px-3 text-right">Rata-Rata Kecepatan / Hari</th>
                    <th className="py-3 px-3 text-right">Kecepatan Maksimal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {(selectedFleetPlate === 'all'
                    ? branchScopedEvaluations
                    : activeEvaluation
                    ? [activeEvaluation]
                    : []
                  ).flatMap(ev =>
                    (ev.dateSubtotals || [])
                      .filter(ds => selectedDateGroup === 'all' || ds.dateGroup === selectedDateGroup)
                      .map(ds => (
                        <tr key={`${ev.plateNumber}-${ds.dateGroup}`} className={`hover:bg-slate-800/40 ${selectedDateGroup === ds.dateGroup ? 'bg-indigo-50/70 dark:bg-indigo-950/30' : ''}`}>
                          <td className="py-3 px-4 font-bold text-white">
                            {ev.plateNumber}{' '}
                            {ev.initialCode && (
                              <span className="text-[10px] font-mono text-indigo-400">[{ev.initialCode}]</span>
                            )}
                          </td>
                          <td className="py-3 px-3">
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[10px] font-semibold">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Terhubung
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
                          <td className="py-3 px-3 font-mono text-right font-bold text-indigo-300">
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
          TAB 2: ARMADA BERGERAK, BERHENTI & ANALISA KIRIM KE PELANGGAN
         ====================================================================== */}
      {activeTab === 'unified_stops_customer' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4 shadow-xs">
          {/* Header & Search Filter */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 border-b border-slate-200 dark:border-slate-800">
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                Analisa Armada Bergerak, Berhenti &amp; Kirim ke Pelanggan (Integrasi Form Kirim &amp; Mitra)
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                Mencocokkan titik berhenti GPS armada dan durasi berhenti (menit) terhadap Form Kirim aktif serta database Toko &amp; Mitra Pelanggan.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cari toko, no form kirim, lokasi..."
                  value={searchFilter}
                  onChange={e => setSearchFilter(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <select
                value={selectedDateGroup}
                onChange={e => setSelectedDateGroup(e.target.value)}
                className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200 font-bold px-3 py-2 rounded-xl focus:outline-none focus:border-indigo-500 cursor-pointer"
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

          {/* Filter Cards: Form Kirim Compliance vs Pelanggan Di Luar Form Kirim vs Non-Mitra >= 15 Menit */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <button
              type="button"
              onClick={() => setActivityFilter('all')}
              className={`p-3.5 rounded-xl border cursor-pointer transition flex items-center justify-between text-left ${
                activityFilter === 'all'
                  ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-500 ring-1 ring-indigo-500/30'
                  : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <div>
                <div className="text-xs font-black text-slate-900 dark:text-white">Semua Aktivitas</div>
                <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                  Total berhenti:{' '}
                  <span className="font-mono tabular-nums text-indigo-700 dark:text-indigo-300 font-bold">
                    {unifiedStats.totalStopMinutes} Menit
                  </span>
                </div>
              </div>
              <span className="text-xl font-black text-indigo-700 dark:text-indigo-400 font-mono tabular-nums">
                {unifiedStats.totalLegs}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActivityFilter('sesuai_form_kirim')}
              className={`p-3.5 rounded-xl border cursor-pointer transition flex items-center justify-between text-left ${
                activityFilter === 'sesuai_form_kirim'
                  ? 'bg-emerald-100/80 dark:bg-emerald-950/50 border-emerald-500 ring-1 ring-emerald-500/30'
                  : 'bg-emerald-50/70 dark:bg-emerald-950/25 border-emerald-200 dark:border-emerald-800 hover:border-emerald-400'
              }`}
            >
              <div>
                <div className="text-xs font-black text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                  <FileCheck2 className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400 shrink-0" />
                  <span>Sesuai Form Kirim</span>
                </div>
                <div className="text-[11px] text-emerald-800/80 dark:text-emerald-300/80 mt-0.5">
                  Di toko mitra &amp; Form Kirim ·{' '}
                  <span className="font-mono tabular-nums font-bold">{unifiedStats.sesuaiStopMinutes} Mnt</span>
                </div>
              </div>
              <span className="text-xl font-black text-emerald-700 dark:text-emerald-400 font-mono tabular-nums">
                {unifiedStats.sesuaiFormKirimCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActivityFilter('pelanggan_luar_form_kirim')}
              className={`p-3.5 rounded-xl border cursor-pointer transition flex items-center justify-between text-left ${
                activityFilter === 'pelanggan_luar_form_kirim'
                  ? 'bg-amber-100/90 dark:bg-amber-950/50 border-amber-500 ring-1 ring-amber-500/30'
                  : 'bg-amber-50/80 dark:bg-amber-950/25 border-amber-200 dark:border-amber-800 hover:border-amber-400'
              }`}
            >
              <div>
                <div className="text-xs font-black text-amber-950 dark:text-amber-200 flex items-center gap-1.5">
                  <Store className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400 shrink-0" />
                  <span>Pelanggan Di Luar Form Kirim</span>
                </div>
                <div className="text-[11px] text-amber-900/80 dark:text-amber-300/80 mt-0.5">
                  Toko mitra di luar Form Kirim ·{' '}
                  <span className="font-mono tabular-nums font-bold">{unifiedStats.luarFkStopMinutes} Mnt</span>
                </div>
              </div>
              <span className="text-xl font-black text-amber-700 dark:text-amber-400 font-mono tabular-nums">
                {unifiedStats.pelangganLuarFormKirimCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActivityFilter('long_non_customer')}
              className={`p-3.5 rounded-xl border cursor-pointer transition flex items-center justify-between text-left ${
                activityFilter === 'long_non_customer'
                  ? 'bg-rose-100/90 dark:bg-rose-950/50 border-rose-500 ring-1 ring-rose-500/30'
                  : 'bg-rose-50/80 dark:bg-rose-950/25 border-rose-200 dark:border-rose-800 hover:border-rose-400'
              }`}
            >
              <div>
                <div className="text-xs font-black text-rose-950 dark:text-rose-200 flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-700 dark:text-rose-400 shrink-0" />
                  <span>Berhenti Lama Non-Mitra</span>
                </div>
                <div className="text-[11px] text-rose-800/80 dark:text-rose-300/80 mt-0.5">
                  Stop &ge; 15 mnt bukan toko ·{' '}
                  <span className="font-mono tabular-nums font-bold">{unifiedStats.nonMitraStopMinutes} Mnt</span>
                </div>
              </div>
              <span className="text-xl font-black text-rose-700 dark:text-rose-400 font-mono tabular-nums">
                {unifiedStats.longNonCustomerCount}
              </span>
            </button>
          </div>

          {/* Ringkasan Kepatuhan Form Kirim Armada & Link Ke Tab Laporan Terpisah */}
          <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <FileCheck2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>Integrasi Form Kirim Armada:</span>
                </span>
                {unifiedStats.linkedFormKirimNos.length > 0 ? (
                  unifiedStats.linkedFormKirimNos.map(no => (
                    <span
                      key={no}
                      className="px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-900/50 text-indigo-900 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-700 font-mono text-[11px] font-bold"
                    >
                      {no}
                    </span>
                  ))
                ) : (
                  <span className="text-[11px] text-amber-800 dark:text-amber-300 font-semibold">
                    Belum ada Form Kirim aktif untuk armada terpilih — seluruh kunjungan toko mitra ditandai di luar Form Kirim.
                  </span>
                )}
              </div>
              {unifiedStats.formKirimTotalTargets > 0 && (
                <div className="text-[11px] text-slate-600 dark:text-slate-400 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span>
                    Target Pelanggan Form Kirim:{' '}
                    <strong className="text-slate-900 dark:text-white font-mono">{unifiedStats.formKirimTotalTargets} Toko</strong>
                  </span>
                  <span>
                    Terverifikasi GPS:{' '}
                    <strong className="text-emerald-700 dark:text-emerald-400 font-mono">{unifiedStats.formKirimVisitedCount} Toko</strong>
                  </span>
                  {unifiedStats.formKirimUnvisited.length > 0 && (
                    <span className="text-amber-800 dark:text-amber-300">
                      Belum terdeteksi berhenti:{' '}
                      <strong className="font-semibold">
                        {unifiedStats.formKirimUnvisited
                          .slice(0, 4)
                          .map(u => u.namaPelanggan)
                          .join(', ')}
                        {unifiedStats.formKirimUnvisited.length > 4
                          ? ` (+${unifiedStats.formKirimUnvisited.length - 4} lainnya)`
                          : ''}
                      </strong>
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setActiveTab('non_form_kirim_stops')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition cursor-pointer shadow-xs"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Lihat Laporan Stop Di Luar Form Kirim</span>
              </button>
              <button
                type="button"
                onClick={handleExportNonFormKirimReport}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 text-xs font-bold transition cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Unduh Excel</span>
              </button>
            </div>
          </div>

          {/* Unified Movement & Delivery Compliance Table ONLY (Separated from Non-FK Report) */}
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-xs text-slate-800 dark:text-slate-200">
              <thead className="bg-slate-100 dark:bg-slate-950 text-[11px] uppercase font-bold text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-3">Ritase &amp; Armada</th>
                  <th className="py-3 px-3">Status Gerak &amp; Form Kirim</th>
                  <th className="py-3 px-3">Berhenti Berapa Lama</th>
                  <th className="py-3 px-4">Toko Pelanggan (Mitra), Form Kirim &amp; GPS</th>
                  <th className="py-3 px-3">Wilayah</th>
                  <th className="py-3 px-4">Rute Perjalanan (Start &rarr; End)</th>
                  <th className="py-3 px-3 text-right">Jarak &amp; Durasi Gerak</th>
                  <th className="py-3 px-3 text-right">Kecepatan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {filteredUnifiedRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
                      Tidak ada aktivitas perjalanan pada filter pencarian/status yang dipilih.
                    </td>
                  </tr>
                ) : (
                  filteredUnifiedRows.map(item => {
                    const isSesuaiFk = item.formKirimStatus === 'sesuai_form_kirim';
                    const isLuarFk = item.formKirimStatus === 'pelanggan_luar_form_kirim';
                    const isLongNonCustomer = item.formKirimStatus === 'long_non_customer';
                    const isDalamKota = item.regionType === 'dalam_kota';
                    const isLuarKota = item.regionType === 'luar_kota';
                    const isLuarPulau = item.regionType === 'luar_pulau';

                    return (
                      <tr
                        key={item.id}
                        className={`transition ${
                          isLongNonCustomer
                            ? 'bg-rose-50/80 dark:bg-rose-950/25 hover:bg-rose-100/70 dark:hover:bg-rose-950/40'
                            : isLuarFk
                            ? 'bg-amber-50/75 dark:bg-amber-950/20 hover:bg-amber-100/70 dark:hover:bg-amber-950/35'
                            : isSesuaiFk
                            ? 'bg-emerald-50/65 dark:bg-emerald-950/20 hover:bg-emerald-100/60 dark:hover:bg-emerald-950/35'
                            : 'bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                        }`}
                      >
                        {/* Col 1: Ritase & Armada */}
                        <td className="py-3.5 px-3 align-top">
                          <div className="font-mono tabular-nums font-black text-slate-900 dark:text-white">#{item.legNumber}</div>
                          <div className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300 font-mono">{item.fleetInitial}</div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">{item.dateGroup}</div>
                        </td>

                        {/* Col 2: Status Gerak, Mitra & Form Kirim */}
                        <td className="py-3.5 px-3 align-top">
                          <div className="space-y-1.5">
                            <span className="px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900/40 text-blue-900 dark:text-blue-200 border border-blue-200 dark:border-blue-800 font-semibold text-[10px] inline-flex items-center gap-1 whitespace-nowrap">
                              Bergerak ({item.startTime.slice(0, 5)} - {item.endTime.slice(0, 5)})
                            </span>

                            {isSesuaiFk && (
                              <div>
                                <span className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-900/40 text-emerald-900 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700 font-bold text-[10px] inline-flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-700 dark:text-emerald-400 shrink-0" />
                                  Sesuai Form Kirim
                                </span>
                              </div>
                            )}

                            {isLuarFk && (
                              <div>
                                <span className="px-2 py-1 rounded-md bg-amber-100 dark:bg-amber-900/50 text-amber-950 dark:text-amber-200 border border-amber-300 dark:border-amber-700 font-bold text-[10px] inline-flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3 text-amber-700 dark:text-amber-300 shrink-0" />
                                  Pelanggan Tidak Sesuai Form Kirim
                                </span>
                              </div>
                            )}

                            {isLongNonCustomer && (
                              <div>
                                <span className="px-2 py-1 rounded-md bg-rose-600 text-white border border-rose-700 font-extrabold text-[10px] inline-flex items-center gap-1 shadow-2xs">
                                  <AlertTriangle className="w-3 h-3 text-white shrink-0" />
                                  BERHENTI LAMA BUKAN TOKO MITRA
                                </span>
                              </div>
                            )}

                            {item.formKirimStatus === 'short_transit' && (
                              <div>
                                <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-semibold text-[10px] inline-flex items-center gap-1">
                                  <Clock className="w-3 h-3 text-slate-500 dark:text-slate-400" />
                                  Transit Singkat Non-Toko
                                </span>
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Col 3: Berhenti Berapa Lama */}
                        <td className="py-3.5 px-3 whitespace-nowrap align-top">
                          {item.stopDurationMinutes > 0 ? (
                            <div className="space-y-1">
                              <span
                                className={`px-2.5 py-1 rounded-lg font-mono tabular-nums font-black text-xs inline-flex items-center gap-1.5 border ${
                                  isLongNonCustomer
                                    ? 'bg-rose-100 dark:bg-rose-900/50 text-rose-900 dark:text-rose-200 border-rose-300 dark:border-rose-700'
                                    : isLuarFk
                                    ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-950 dark:text-amber-200 border-amber-300 dark:border-amber-700'
                                    : isSesuaiFk
                                    ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-900 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700'
                                }`}
                              >
                                <Clock className="w-3.5 h-3.5" />
                                {item.stopDurationMinutes} Menit
                              </span>
                              <div className="text-[11px] text-slate-600 dark:text-slate-400 font-mono tabular-nums font-semibold">
                                {item.stopStart.slice(0, 5)} s/d {item.stopEnd.slice(0, 5)}
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-0.5">
                              <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-mono tabular-nums font-semibold text-[11px] inline-flex items-center gap-1">
                                <Clock className="w-3 h-3" />0 Menit
                              </span>
                              <div className="text-[10px] text-slate-500">Langsung Jalan</div>
                            </div>
                          )}
                        </td>

                        {/* Col 4: Toko Pelanggan (Mitra), Kesesuaian Form Kirim & Koordinat GPS */}
                        <td className="py-3.5 px-4 max-w-xs align-top">
                          {isSesuaiFk ? (
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {item.nomorToko !== '-' && (
                                  <span className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-mono text-[10px] font-bold">
                                    No. {item.nomorToko}
                                  </span>
                                )}
                                <span className="font-bold text-slate-900 dark:text-white text-xs">{item.namaTokoAtauLokasi}</span>
                              </div>
                              <div className="text-[11px] text-emerald-800 dark:text-emerald-300 font-semibold mt-0.5 flex items-center gap-1 flex-wrap">
                                <span>Form Kirim: {item.matchedFormKirimNo}</span>
                                {item.matchedFormKirimFaktur && (
                                  <span className="text-slate-600 dark:text-slate-400 font-mono">({item.matchedFormKirimFaktur})</span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                                Kec. {item.kecamatan}, Kab. {item.kabupaten}
                              </div>
                            </div>
                          ) : isLuarFk ? (
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {item.nomorToko !== '-' && (
                                  <span className="px-1.5 py-0.5 rounded bg-amber-200/80 dark:bg-amber-900/60 text-amber-950 dark:text-amber-200 font-mono text-[10px] font-bold">
                                    No. {item.nomorToko}
                                  </span>
                                )}
                                <span className="font-bold text-slate-900 dark:text-white text-xs">{item.namaTokoAtauLokasi}</span>
                              </div>
                              <div className="text-[11px] text-amber-900 dark:text-amber-300 font-semibold mt-0.5">
                                Titik toko mitra terdeteksi, tidak tercantum di Form Kirim armada
                              </div>
                              <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                                Kec. {item.kecamatan}, Kab. {item.kabupaten}
                              </div>
                            </div>
                          ) : isLongNonCustomer ? (
                            <div>
                              <div className="font-bold text-rose-900 dark:text-rose-200 text-xs flex items-center gap-1">
                                <AlertTriangle className="w-3.5 h-3.5 text-rose-700 dark:text-rose-400 shrink-0" />
                                <span>Tidak Terdaftar di Mitra Pelanggan &amp; Form Kirim</span>
                              </div>
                              <div className="text-[11px] text-slate-800 dark:text-slate-200 font-semibold mt-0.5 truncate" title={item.startLocation}>
                                Lokasi: {item.startLocation}
                              </div>
                              <div className="text-[11px] text-rose-800 dark:text-rose-300 mt-0.5">
                                Armada berhenti {item.stopDurationMinutes} menit di luar titik pelanggan
                              </div>
                            </div>
                          ) : (
                            <div>
                              <div className="font-semibold text-slate-900 dark:text-slate-100 text-xs">{item.namaTokoAtauLokasi}</div>
                              <div className="text-[11px] text-slate-600 dark:text-slate-400 truncate max-w-[240px]">
                                {item.startLocation}
                              </div>
                            </div>
                          )}
                          <div className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sky-50 dark:bg-slate-950 border border-sky-200 dark:border-slate-700 text-[10px] font-mono tabular-nums font-bold text-sky-900 dark:text-cyan-300">
                            <Navigation className="w-2.5 h-2.5 text-sky-700 dark:text-cyan-400 shrink-0" />
                            <span>GPS: {item.gpsCoordLabel}</span>
                          </div>
                        </td>

                        {/* Col 5: Wilayah */}
                        <td className="py-3.5 px-3 align-top whitespace-nowrap">
                          {isDalamKota && (
                            <span className="px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900/40 text-blue-900 dark:text-blue-200 border border-blue-200 dark:border-blue-800 font-bold text-[10px] inline-flex items-center">
                              Dalam Kota
                            </span>
                          )}
                          {isLuarKota && (
                            <span className="px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-800 font-bold text-[10px] inline-flex items-center">
                              Luar Kota
                            </span>
                          )}
                          {isLuarPulau && (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-900/40 text-emerald-900 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800 font-bold text-[10px] inline-flex items-center">
                              Luar Pulau
                            </span>
                          )}
                        </td>

                        {/* Col 6: Rute Perjalanan */}
                        <td className="py-3.5 px-4 max-w-xs align-top">
                          <div className="text-[11px] text-slate-800 dark:text-slate-200 truncate" title={item.startLocation}>
                            <span className="text-slate-500 dark:text-slate-400 font-semibold">Dari:</span>{' '}
                            {item.startLocation.split(',')[0]}
                          </div>
                          <div className="text-[11px] text-emerald-800 dark:text-emerald-300 font-medium truncate mt-0.5" title={item.endLocation}>
                            <span className="text-slate-500 dark:text-slate-400 font-semibold">Ke:</span>{' '}
                            {item.endLocation.split(',')[0]}
                          </div>
                        </td>

                        {/* Col 7: Jarak & Durasi Gerak */}
                        <td className="py-3.5 px-3 text-right font-mono tabular-nums align-top whitespace-nowrap">
                          <div className="font-black text-emerald-700 dark:text-emerald-400">{item.mileageKm.toFixed(2)} km</div>
                          <div className="text-[11px] text-slate-600 dark:text-slate-400">{item.travelTime}</div>
                        </td>

                        {/* Col 8: Kecepatan */}
                        <td className="py-3.5 px-3 text-right font-mono tabular-nums align-top whitespace-nowrap">
                          <div className="text-slate-800 dark:text-slate-200 font-semibold">Avg: {item.avgSpeedKmh.toFixed(1)}</div>
                          <div className="text-[11px] text-rose-700 dark:text-rose-300 font-bold">
                            Max: {item.maxSpeedKmh.toFixed(1)} km/h
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ======================================================================
          TAB 3 (TERPISAH): LAPORAN BERHENTI DI TOKO SELAIN PELANGGAN FORM KIRIM
         ====================================================================== */}
      {activeTab === 'non_form_kirim_stops' && (() => {
        const nonFkReportRows = unifiedRows.filter(item => {
          if (selectedDateGroup !== 'all' && item.dateGroup !== selectedDateGroup) return false;
          if (item.formKirimStatus !== 'pelanggan_luar_form_kirim' && item.formKirimStatus !== 'long_non_customer') {
            return false;
          }
          const q = searchFilter.trim().toLowerCase();
          if (!q) return true;
          return (
            item.namaTokoAtauLokasi.toLowerCase().includes(q) ||
            item.startLocation.toLowerCase().includes(q) ||
            item.fleetInitial.toLowerCase().includes(q) ||
            item.gpsCoordLabel.toLowerCase().includes(q)
          );
        });
        const totalNonFkMinutes = nonFkReportRows.reduce((s, r) => s + (r.stopDurationMinutes || 0), 0);
        const mitraLuarFkCount = nonFkReportRows.filter(r => r.formKirimStatus === 'pelanggan_luar_form_kirim').length;
        const nonMitraCount = nonFkReportRows.filter(r => r.formKirimStatus === 'long_non_customer').length;

        return (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4 shadow-xs">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>Laporan Berhenti di Toko Selain Pelanggan Form Kirim</span>
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  Daftar khusus seluruh pemberhentian armada di luar daftar pelanggan Form Kirim lengkap dengan lama berhenti (menit) dan titik koordinat GPS terbaca dari file upload.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative w-56">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Cari toko, armada, GPS..."
                    value={searchFilter}
                    onChange={e => setSearchFilter(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <select
                  value={selectedDateGroup}
                  onChange={e => setSelectedDateGroup(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200 font-bold px-3 py-2 rounded-xl focus:outline-none cursor-pointer"
                >
                  <option value="all">Semua Tanggal ({subtotals.length} Hari)</option>
                  {subtotals.map(ds => (
                    <option key={ds.dateGroup} value={ds.dateGroup}>
                      {ds.dateGroup} ({ds.tripCount} Ritase)
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleExportNonFormKirimReport}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs transition cursor-pointer shadow-xs shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Ekspor Laporan Excel</span>
                </button>
              </div>
            </div>

            {/* Crisp Summary Strip */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Total Kejadian Di Luar Form Kirim</div>
                  <div className="text-lg font-black text-slate-900 dark:text-white font-mono tabular-nums mt-0.5">
                    {nonFkReportRows.length} Kejadian
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Total Durasi Stop</div>
                  <div className="text-base font-black text-amber-700 dark:text-amber-400 font-mono tabular-nums mt-0.5">
                    {totalNonFkMinutes} Menit
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/25 border border-amber-200 dark:border-amber-800 flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-bold text-amber-900 dark:text-amber-200">Toko Mitra Di Luar Form Kirim</div>
                  <div className="text-xs text-amber-800/80 dark:text-amber-300/80 mt-0.5">Terdaftar di Jaringan Mitra</div>
                </div>
                <span className="text-xl font-black text-amber-700 dark:text-amber-400 font-mono tabular-nums">
                  {mitraLuarFkCount}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-rose-50/80 dark:bg-rose-950/25 border border-rose-200 dark:border-rose-800 flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-bold text-rose-900 dark:text-rose-200">Bukan Toko Mitra (&ge; 15 Menit)</div>
                  <div className="text-xs text-rose-800/80 dark:text-rose-300/80 mt-0.5">Lokasi di luar titik pelanggan</div>
                </div>
                <span className="text-xl font-black text-rose-700 dark:text-rose-400 font-mono tabular-nums">
                  {nonMitraCount}
                </span>
              </div>
            </div>

            {nonFkReportRows.length === 0 ? (
              <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 px-4 py-4 text-xs text-emerald-900 dark:text-emerald-200 font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
                <span>Seluruh pemberhentian armada pada filter ini sesuai dengan daftar pelanggan Form Kirim.</span>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-left text-xs text-slate-800 dark:text-slate-200">
                  <thead className="bg-slate-100 dark:bg-slate-950 text-[11px] uppercase font-bold text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Armada &amp; Tanggal</th>
                      <th className="py-3 px-3">Kategori</th>
                      <th className="py-3 px-4">Nama Toko / Lokasi Stop</th>
                      <th className="py-3 px-3">Lama Berhenti</th>
                      <th className="py-3 px-4">Titik GPS Otomatis (File Upload)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {nonFkReportRows.map(row => {
                      const isNonMitra = row.formKirimStatus === 'long_non_customer';
                      return (
                        <tr
                          key={`nonfk-${row.id}`}
                          className={`transition ${
                            isNonMitra
                              ? 'bg-rose-50/75 dark:bg-rose-950/20 hover:bg-rose-100/70 dark:hover:bg-rose-950/35'
                              : 'bg-white dark:bg-slate-900 hover:bg-amber-50/60 dark:hover:bg-slate-800/60'
                          }`}
                        >
                          <td className="py-3 px-4 whitespace-nowrap align-top">
                            <div className="font-mono font-black text-slate-900 dark:text-white">{row.fleetInitial}</div>
                            <div className="text-[11px] text-slate-600 dark:text-slate-400 font-mono tabular-nums">
                              {row.dateGroup} · #{row.legNumber}
                            </div>
                          </td>
                          <td className="py-3 px-3 align-top whitespace-nowrap">
                            {row.formKirimStatus === 'pelanggan_luar_form_kirim' ? (
                              <span className="px-2.5 py-1 rounded-md bg-amber-100 dark:bg-amber-900/40 text-amber-950 dark:text-amber-200 border border-amber-300 dark:border-amber-700 text-[11px] font-bold">
                                Toko Mitra Di Luar Form Kirim
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-md bg-rose-600 text-white border border-rose-700 text-[11px] font-bold">
                                Bukan Toko Mitra (&ge;15 Mnt)
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 max-w-md align-top">
                            <div className="font-bold text-slate-900 dark:text-white text-xs">{row.namaTokoAtauLokasi}</div>
                            <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5 truncate" title={row.startLocation}>
                              {row.startLocation}
                            </div>
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap align-top">
                            <span
                              className={`font-mono tabular-nums font-black text-xs px-2 py-0.5 rounded-md ${
                                isNonMitra
                                  ? 'bg-rose-100 dark:bg-rose-900/50 text-rose-900 dark:text-rose-200'
                                  : 'bg-amber-100 dark:bg-amber-900/50 text-amber-900 dark:text-amber-200'
                              }`}
                            >
                              {row.stopDurationMinutes} Menit
                            </span>
                            <div className="text-[11px] text-slate-600 dark:text-slate-400 font-mono tabular-nums mt-1">
                              {row.stopStart.slice(0, 5)} - {row.stopEnd.slice(0, 5)}
                            </div>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap align-top">
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-50 dark:bg-slate-950 border border-sky-200 dark:border-slate-700 font-mono tabular-nums text-xs font-bold text-sky-900 dark:text-cyan-300">
                              <Navigation className="w-3.5 h-3.5 text-sky-700 dark:text-cyan-400 shrink-0" />
                              <span>{row.gpsCoordLabel}</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })()}

      {/* ======================================================================
          TAB 4: PROFIL KECEPATAN & REKAPITULASI PER HARI (NO FUEL)
         ====================================================================== */}
      {activeTab === 'speed_summary' && (
        <div className="space-y-5">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  Grafik Profil Kecepatan Perjalanan Armada ({activeEvaluation?.plateNumber})
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  Perbandingan kecepatan rata-rata dan kecepatan maksimal per ritase perjalanan.
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1.5 font-bold text-blue-700 dark:text-blue-400">
                  <span className="w-3 h-3 rounded-full bg-blue-600" /> Rata-Rata Kecepatan (km/h)
                </span>
                <span className="flex items-center gap-1.5 font-bold text-rose-700 dark:text-rose-400">
                  <span className="w-3 h-3 rounded-full bg-rose-600" /> Kecepatan Maksimal (km/h)
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
                  <CartesianGrid strokeDasharray="3 3" stroke="#64748b" opacity={0.2} />
                  <XAxis dataKey="name" stroke="#64748b" tick={{ fontSize: 10 }} />
                  <YAxis stroke="#64748b" tick={{ fontSize: 10 }} unit=" km/h" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '0.75rem',
                      color: '#ffffff',
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

          {/* Subtotal Per Hari & Rekapitulasi Baris Bawah Excel */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3 shadow-xs">
              <h4 className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                Rincian Per Hari (Trips, KM, Durasi Harian &amp; Kecepatan Harian)
              </h4>
              <div className="space-y-2.5">
                {subtotals.map(st => (
                  <div
                    key={st.dateGroup}
                    className="bg-slate-50 dark:bg-slate-950 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between"
                  >
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <span>Tanggal: {st.dateGroup}</span>
                        <span className="px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 font-mono text-[10px]">
                          {st.tripCount} Trips
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 flex flex-wrap items-center gap-3">
                        <span>
                          Durasi Hari Ini: <strong className="text-amber-700 dark:text-amber-300 font-mono">{st.travelTime}</strong>
                        </span>
                        <span>
                          Rata-Rata: <strong className="text-blue-700 dark:text-blue-400">{st.avgSpeedKmh} km/h</strong>
                        </span>
                        <span>
                          Maks: <strong className="text-rose-700 dark:text-rose-400">{st.maxSpeedKmh} km/h</strong>
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-black text-emerald-700 dark:text-emerald-400 font-mono tabular-nums">
                        {st.totalMileageKm} km
                      </div>
                      <div className="text-[10px] text-slate-500">Total KM Harian</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3 shadow-xs">
              <h4 className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                Rekapitulasi Baris Bawah Excel ({activeEvaluation?.plateNumber})
              </h4>
              <div className="bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                <div className="flex items-center justify-between p-3">
                  <span className="text-slate-600 dark:text-slate-400 font-medium">Trips (Total Ritase)</span>
                  <span className="font-mono tabular-nums font-bold text-slate-900 dark:text-white text-sm">{bottom.trips} Ritase</span>
                </div>
                <div className="flex items-center justify-between p-3">
                  <span className="text-slate-600 dark:text-slate-400 font-medium">Total KM (Total Mileage)</span>
                  <span className="font-mono tabular-nums font-bold text-emerald-700 dark:text-emerald-400 text-sm">{bottom.totalMileageKm} km</span>
                </div>
                <div className="flex items-center justify-between p-3">
                  <span className="text-slate-600 dark:text-slate-400 font-medium">Total Durasi Perjalanan</span>
                  <span className="font-mono tabular-nums font-bold text-amber-700 dark:text-amber-300 text-sm">{bottom.duration}</span>
                </div>
                <div className="flex items-center justify-between p-3">
                  <span className="text-slate-600 dark:text-slate-400 font-medium">Rata-Rata Kecepatan Keseluruhan</span>
                  <span className="font-mono tabular-nums font-bold text-blue-700 dark:text-blue-400 text-sm">{bottom.avgSpeedKmh} km/h</span>
                </div>
                <div className="flex items-center justify-between p-3">
                  <span className="text-slate-600 dark:text-slate-400 font-medium">Kecepatan Maksimal Tertinggi</span>
                  <span className="font-mono tabular-nums font-bold text-rose-700 dark:text-rose-400 text-sm">{bottom.maxSpeedKmh} km/h</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
