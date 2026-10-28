import { sanitizeCoordinate } from '../components/GoogleSheetsStoreSyncModal';

export interface ParsedCoordinatePair {
  latitude: number;
  longitude: number;
  isValid: boolean;
  rawLat: string;
  rawLng: string;
}

const BANYUWANGI_DISTRICTS = [
  { key: 'genteng', name: 'Genteng', lat: -8.3650, lng: 114.1530 },
  { key: 'banyuwangi', name: 'Kota Banyuwangi', lat: -8.2190, lng: 114.3680 },
  { key: 'rogojampi', name: 'Rogojampi', lat: -8.3050, lng: 114.2980 },
  { key: 'srono', name: 'Srono', lat: -8.3980, lng: 114.2650 },
  { key: 'kalipuro', name: 'Kalipuro', lat: -8.1580, lng: 114.3920 },
  { key: 'ketapang', name: 'Ketapang', lat: -8.1435, lng: 114.3975 },
  { key: 'glagah', name: 'Glagah', lat: -8.2185, lng: 114.3160 },
  { key: 'glenmore', name: 'Glenmore', lat: -8.3080, lng: 114.0520 },
  { key: 'kalibaru', name: 'Kalibaru', lat: -8.2890, lng: 113.9850 },
  { key: 'muncar', name: 'Muncar', lat: -8.4350, lng: 114.3350 },
  { key: 'gambiran', name: 'Gambiran', lat: -8.4020, lng: 114.1480 },
  { key: 'cluring', name: 'Cluring', lat: -8.4280, lng: 114.2250 },
  { key: 'songgon', name: 'Songgon', lat: -8.2650, lng: 114.1850 },
  { key: 'singojuruh', name: 'Singojuruh', lat: -8.3180, lng: 114.2280 },
  { key: 'purwoharjo', name: 'Purwoharjo', lat: -8.5080, lng: 114.2480 },
  { key: 'tegaldlimo', name: 'Tegaldlimo', lat: -8.5410, lng: 114.2950 },
  { key: 'bangorejo', name: 'Bangorejo', lat: -8.4850, lng: 114.1520 },
  { key: 'pesanggaran', name: 'Pesanggaran', lat: -8.5620, lng: 114.0980 },
  { key: 'siliragung', name: 'Siliragung', lat: -8.5150, lng: 114.1120 },
  { key: 'tegalsari', name: 'Tegalsari', lat: -8.4190, lng: 114.1510 },
  { key: 'sempu', name: 'Sempu', lat: -8.3210, lng: 114.1480 },
  { key: 'kabat', name: 'Kabat', lat: -8.2670, lng: 114.3270 },
  { key: 'giri', name: 'Giri', lat: -8.1950, lng: 114.3510 },
  { key: 'wongsorejo', name: 'Wongsorejo', lat: -7.9920, lng: 114.3980 }
];

const LUAR_KOTA_CENTERS = [
  { key: 'jember', lat: -8.1724, lng: 113.6995 },
  { key: 'sumbersari', lat: -8.1690, lng: 113.7150 },
  { key: 'kaliwates', lat: -8.1810, lng: 113.6750 },
  { key: 'patrang', lat: -8.1510, lng: 113.7080 },
  { key: 'ambulu', lat: -8.3460, lng: 113.6060 },
  { key: 'tanggul', lat: -8.1640, lng: 113.4470 },
  { key: 'balung', lat: -8.2730, lng: 113.5340 },
  { key: 'kalisat', lat: -8.1280, lng: 113.8050 },
  { key: 'rambipuji', lat: -8.2030, lng: 113.6150 },
  { key: 'situbondo', lat: -7.7062, lng: 114.0098 },
  { key: 'panji', lat: -7.7150, lng: 114.0350 },
  { key: 'asemrowo', lat: -7.7480, lng: 114.1850 },
  { key: 'asembagus', lat: -7.7520, lng: 114.2150 },
  { key: 'besuki', lat: -7.7340, lng: 113.6890 },
  { key: 'bondowoso', lat: -7.9135, lng: 113.8214 },
  { key: 'lumajang', lat: -8.1335, lng: 113.2248 },
  { key: 'probolinggo', lat: -7.7543, lng: 113.2159 },
  { key: 'pasuruan', lat: -7.6453, lng: 112.9075 },
  { key: 'malang', lat: -7.9666, lng: 112.6326 },
  { key: 'sidoarjo', lat: -7.4478, lng: 112.7183 },
  { key: 'surabaya', lat: -7.2575, lng: 112.7521 }
];

const LUAR_PULAU_CENTERS = [
  { key: 'gilimanuk', lat: -8.1628, lng: 114.4382 },
  { key: 'melaya', lat: -8.2485, lng: 114.5120 },
  { key: 'negara', lat: -8.3575, lng: 114.6255 },
  { key: 'jembrana', lat: -8.3575, lng: 114.6255 },
  { key: 'pekutatan', lat: -8.4215, lng: 114.8280 },
  { key: 'tabanan', lat: -8.5412, lng: 115.1255 },
  { key: 'kediri', lat: -8.5620, lng: 115.1510 },
  { key: 'mengwi', lat: -8.5480, lng: 115.1720 },
  { key: 'lukluk', lat: -8.5890, lng: 115.1820 },
  { key: 'badung', lat: -8.6500, lng: 115.1667 },
  { key: 'kuta', lat: -8.7233, lng: 115.1723 },
  { key: 'denpasar', lat: -8.6705, lng: 115.2126 },
  { key: 'pemecutan', lat: -8.6615, lng: 115.1950 },
  { key: 'ubung', lat: -8.6345, lng: 115.2035 },
  { key: 'padangsambian', lat: -8.6685, lng: 115.1785 },
  { key: 'gianyar', lat: -8.5445, lng: 115.3250 },
  { key: 'buleleng', lat: -8.1120, lng: 115.0882 },
  { key: 'singaraja', lat: -8.1120, lng: 115.0882 },
  { key: 'mataram', lat: -8.5833, lng: 116.1167 },
  { key: 'lombok', lat: -8.5833, lng: 116.1167 },
  { key: 'bali', lat: -8.6705, lng: 115.2126 }
];

function getDistributedFallback(index: number, raw?: any): { lat: number; lng: number } {
  const combinedHint = [
    raw?.kecamatan,
    raw?.kabupaten,
    raw?.city,
    raw?.address,
    raw?.storeName,
    raw?.island
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  let seed = index + 1;
  const nameOrCode = String(raw?.storeCode || raw?.storeName || index);
  for (let i = 0; i < nameOrCode.length; i++) {
    seed = (seed * 31 + nameOrCode.charCodeAt(i)) & 0xffffff;
  }

  const latOffset = ((Math.sin(seed * 12.9898) * 43758.5453) % 1) * 0.012;
  const lngOffset = ((Math.cos(seed * 78.233) * 43758.5453) % 1) * 0.012;

  for (const item of LUAR_PULAU_CENTERS) {
    if (combinedHint.includes(item.key)) {
      return {
        lat: Number((item.lat + latOffset).toFixed(6)),
        lng: Number((item.lng + lngOffset).toFixed(6))
      };
    }
  }

  for (const item of LUAR_KOTA_CENTERS) {
    if (combinedHint.includes(item.key)) {
      return {
        lat: Number((item.lat + latOffset).toFixed(6)),
        lng: Number((item.lng + lngOffset).toFixed(6))
      };
    }
  }

  for (const item of BANYUWANGI_DISTRICTS) {
    if (combinedHint.includes(item.key)) {
      return {
        lat: Number((item.lat + latOffset).toFixed(6)),
        lng: Number((item.lng + lngOffset).toFixed(6))
      };
    }
  }

  const district = BANYUWANGI_DISTRICTS[Math.abs(seed) % BANYUWANGI_DISTRICTS.length];
  return {
    lat: Number((district.lat + latOffset).toFixed(6)),
    lng: Number((district.lng + lngOffset).toFixed(6))
  };
}

export function extractCoordinatesFromObject(raw: any, fallbackIndex = 0): ParsedCoordinatePair {
  const fallback = getDistributedFallback(fallbackIndex, raw);

  if (!raw || typeof raw !== 'object') {
    return {
      latitude: fallback.lat,
      longitude: fallback.lng,
      isValid: false,
      rawLat: '',
      rawLng: ''
    };
  }

  const latCandidates = [
    raw.latitude,
    raw.Latitude,
    raw.LATITUDE,
    raw.lat,
    raw.Lat,
    raw.LAT,
    raw.rawLat,
    raw.raw_lat,
    raw.koordinat_lat,
    raw.y,
    raw.Y
  ];

  const lngCandidates = [
    raw.longitude,
    raw.Longitude,
    raw.LONGITUDE,
    raw.lng,
    raw.Lng,
    raw.LNG,
    raw.lon,
    raw.Lon,
    raw.long,
    raw.Long,
    raw.rawLng,
    raw.raw_lng,
    raw.koordinat_lng,
    raw.x,
    raw.X
  ];

  let rawLatVal: any = latCandidates.find(v => v !== undefined && v !== null && String(v).trim() !== '');
  let rawLngVal: any = lngCandidates.find(v => v !== undefined && v !== null && String(v).trim() !== '');

  if (rawLatVal === undefined || rawLngVal === undefined) {
    const combinedCandidates = [
      raw.koordinat,
      raw.coordinates,
      raw.coords,
      raw.lat_lng,
      raw.latLng,
      raw.location,
      raw.lokasi,
      raw.point
    ];

    const combinedStr = combinedCandidates.find(v => typeof v === 'string' && v.trim().length > 0);
    if (combinedStr) {
      const parts = combinedStr.split(/[,;\s/|]+/).map((p: string) => p.trim()).filter((p: string) => p.length > 0);
      if (parts.length >= 2) {
        rawLatVal = rawLatVal ?? parts[0];
        rawLngVal = rawLngVal ?? parts[1];
      }
    } else if (Array.isArray(raw.coordinates) && raw.coordinates.length >= 2) {
      rawLatVal = rawLatVal ?? raw.coordinates[0];
      rawLngVal = rawLngVal ?? raw.coordinates[1];
    }
  }

  const strLat = String(rawLatVal ?? '').trim();
  const strLng = String(rawLngVal ?? '').trim();

  const isLatZeroOrEmpty = !strLat || strLat === '0' || strLat === '0.0' || strLat === 'null' || strLat === 'undefined' || strLat === '-' || strLat === 'NaN';
  const isLngZeroOrEmpty = !strLng || strLng === '0' || strLng === '0.0' || strLng === 'null' || strLng === 'undefined' || strLng === '-' || strLng === 'NaN';

  const parsedLat = isLatZeroOrEmpty ? fallback.lat : sanitizeCoordinate(strLat || (typeof rawLatVal === 'number' ? rawLatVal : fallback.lat), false);
  const parsedLng = isLngZeroOrEmpty ? fallback.lng : sanitizeCoordinate(strLng || (typeof rawLngVal === 'number' ? rawLngVal : fallback.lng), true);

  const numLat = Number(parsedLat);
  const numLng = Number(parsedLng);

  const isValidLat = !isLatZeroOrEmpty && !isNaN(numLat) && isFinite(numLat) && numLat !== 0 && numLat >= -12.0 && numLat <= 6.0;
  const isValidLng = !isLngZeroOrEmpty && !isNaN(numLng) && isFinite(numLng) && numLng !== 0 && numLng >= 95.0 && numLng <= 145.0;
  const isValid = isValidLat && isValidLng;

  return {
    latitude: isValid ? Number(numLat.toFixed(6)) : fallback.lat,
    longitude: isValid ? Number(numLng.toFixed(6)) : fallback.lng,
    isValid,
    rawLat: strLat || String(isValid ? numLat : fallback.lat),
    rawLng: strLng || String(isValid ? numLng : fallback.lng)
  };
}

export function normalizeStoreWithCoordinates<T extends Record<string, any>>(store: T, index = 0): T & { latitude: number; longitude: number } {
  const coords = extractCoordinatesFromObject(store, index);
  return {
    ...store,
    latitude: coords.latitude,
    longitude: coords.longitude,
    rawLat: coords.rawLat,
    rawLng: coords.rawLng
  };
}

export type StoreLocationType = 'dalam_kota' | 'luar_kota' | 'luar_pulau';

/**
 * Classifies store into:
 * - 'dalam_kota' (BIRU): Kabupaten Banyuwangi
 * - 'luar_kota' (KUNING): Luar Kota di Pulau Jawa (Jember, Situbondo, Bondowoso, Lumajang, Probolinggo, Surabaya, dll)
 * - 'luar_pulau' (HIJAU): Luar Pulau (Bali: Denpasar, Badung, Tabanan, Jembrana, Buleleng/Singaraja, NTB, Sumatera, dll)
 */
export function getStoreLocationType(store: {
  island?: string;
  city?: string;
  kabupaten?: string;
  kecamatan?: string;
  address?: string;
  storeName?: string;
  latitude?: number;
  longitude?: number;
}): StoreLocationType {
  const kabLower = (store.kabupaten || store.city || '').toLowerCase();
  const kecLower = (store.kecamatan || '').toLowerCase();
  const addrLower = (store.address || '').toLowerCase();
  const nameLower = (store.storeName || '').toLowerCase();
  const islandLower = (store.island || '').toLowerCase();
  const combined = `${kabLower} ${kecLower} ${addrLower} ${nameLower} ${islandLower}`;

  // 1. Explicit Kabupaten / Island checks first (ensures Kabupaten filter & Excel Kabupaten column always match)
  const luarPulauKeywords = [
    'bali',
    'denpasar',
    'badung',
    'tabanan',
    'jembrana',
    'negara',
    'gilimanuk',
    'melaya',
    'buleleng',
    'singaraja',
    'gianyar',
    'klungkung',
    'karangasem',
    'bangli',
    'kuta',
    'mengwi',
    'ubung',
    'pemecutan',
    'padangsambian',
    'lombok',
    'mataram',
    'ntb',
    'nusa tenggara',
    'sumatera',
    'lampung',
    'kalimantan',
    'sulawesi',
    'lesser sunda'
  ];

  if (
    (store.island && store.island !== 'Jawa') ||
    luarPulauKeywords.some(kw => combined.includes(kw))
  ) {
    return 'luar_pulau';
  }

  const luarKotaKeywords = [
    'jember',
    'situbondo',
    'bondowoso',
    'lumajang',
    'probolinggo',
    'pasuruan',
    'malang',
    'surabaya',
    'sidoarjo',
    'gresik',
    'mojokerto',
    'kediri',
    'blitar',
    'tulungagung',
    'madiun',
    'jombang',
    'nganjuk',
    'bangkalan',
    'sampang',
    'pamekasan',
    'sumenep'
  ];

  if (luarKotaKeywords.some(kw => kabLower.includes(kw) || kecLower.includes(kw) || addrLower.includes(kw))) {
    return 'luar_kota';
  }

  if (kabLower.includes('banyuwangi')) {
    return 'dalam_kota';
  }

  // 2. Coordinate check if Kabupaten text wasn't decisive
  const lat = Number(store.latitude);
  const lng = Number(store.longitude);
  const hasValidCoords = !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;

  if (hasValidCoords) {
    // East of Bali Strait (> 114.432) or Sumatera (< 106.0) -> Luar Pulau (Hijau)
    if (lng > 114.432 || lng < 106.0 || lat > -5.9) {
      return 'luar_pulau';
    }
    // Inside Banyuwangi Regency box -> Dalam Kota (Biru)
    const isStrictlyInBanyuwangiCoords = lat <= -7.75 && lat >= -8.85 && lng >= 113.92 && lng <= 114.432;
    if (isStrictlyInBanyuwangiCoords) {
      return 'dalam_kota';
    }
    // Java outside Banyuwangi -> Luar Kota (Kuning)
    return 'luar_kota';
  }

  return 'dalam_kota';
}

export function getStoreRegionColorMeta(locType: StoreLocationType) {
  if (locType === 'dalam_kota') {
    return {
      type: 'dalam_kota' as const,
      label: 'Dalam Kota',
      subLabel: 'Kab. Banyuwangi (Biru)',
      colorName: 'Biru',
      hex: '#2563eb',
      dotClass: 'bg-blue-500',
      pinBgClass: 'bg-blue-600',
      badgeClass: 'bg-blue-500/15 text-blue-300 border-blue-500/40',
      activeFilterClass: 'bg-blue-600 text-white border-blue-500 shadow-sm',
      cardBorderClass: 'border-blue-500/30 bg-blue-950/20'
    };
  }
  if (locType === 'luar_kota') {
    return {
      type: 'luar_kota' as const,
      label: 'Luar Kota',
      subLabel: 'Jember / Situbondo / Jatim (Kuning)',
      colorName: 'Kuning',
      hex: '#eab308',
      dotClass: 'bg-amber-400',
      pinBgClass: 'bg-amber-400 text-slate-950',
      badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
      activeFilterClass: 'bg-amber-400 text-slate-950 border-amber-400 shadow-sm font-bold',
      cardBorderClass: 'border-amber-500/30 bg-amber-950/20'
    };
  }
  return {
    type: 'luar_pulau' as const,
    label: 'Luar Pulau',
    subLabel: 'Bali / Nusa Tenggara / Sumatera (Hijau)',
    colorName: 'Hijau',
    hex: '#10b981',
    dotClass: 'bg-emerald-500',
    pinBgClass: 'bg-emerald-500',
    badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
    activeFilterClass: 'bg-emerald-600 text-white border-emerald-500 shadow-sm',
    cardBorderClass: 'border-emerald-500/30 bg-emerald-950/20'
  };
}

export function getStorePriorityLevel(store: any): 'High' | 'Medium' | 'Low' {
  if (!store) return 'Low';
  if (store.priorityLevel && ['High', 'Medium', 'Low'].includes(store.priorityLevel)) {
    return store.priorityLevel as 'High' | 'Medium' | 'Low';
  }
  const category = store.storeCategory || '';
  if (['Hypermarket', 'Supermarket', 'Distribution Hub', 'Horeca & Corporate'].includes(category)) {
    return 'High';
  }
  if (['Minimarket Cluster', 'Mitra Distributor'].includes(category)) {
    return 'Medium';
  }
  return 'Low';
}
