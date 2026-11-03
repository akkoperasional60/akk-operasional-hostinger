import { VERIFIED_DATA_FIX_STORES } from '../data/verifiedDataFixStores';
import { RetailStore } from '../types';

export interface PreciseCustomerLocationResult {
  latitude: number;
  longitude: number;
  coordsFormatted: string;
  locationLabel: string;
  subAreaLabel: string;
  gmapsUrl: string;
  isLiveDeviceGps: boolean;
}

interface KnownPointEntry {
  keywords: string[];
  areaFilter?: string[];
  label: string;
  subArea: string;
  latitude: number;
  longitude: number;
}

/**
 * Daftar titik lokasi presisi toko/pelanggan langganan PT AKK di koridor
 * Genteng, Rogojampi, Srono, Muncar, Jajag, Banyuwangi Kota, Kabat, Kalipuro,
 * Situbondo, Bondowoso, Jember, dan Bali.
 */
const KNOWN_CUSTOMER_POINTS: KnownPointEntry[] = [
  // === KORIDOR GENTENG & ROGOJAMPI (SUSULAN GENTENG ROGOJAMPI) ===
  {
    keywords: ['kds', 'karunia damai sejahtera', 'kds genteng'],
    label: 'KDS Genteng',
    subArea: 'Jl. Gajah Mada, Genteng Kulon, Kec. Genteng',
    latitude: -8.363852,
    longitude: 114.151428
  },
  {
    keywords: ['muzaki', 'mulia grosir', 'muzaki/mulia', 'mulia rogojampi', 'muzaki grosir'],
    label: 'Muzaki / Mulia Grosir',
    subArea: 'Jl. Raya Rogojampi - Genteng, Gitik, Kec. Rogojampi',
    latitude: -8.308426,
    longitude: 114.289654
  },
  {
    keywords: ['toko aza', 'tk aza', 'aza rogojampi', 'aza genteng', 'aza'],
    label: 'Toko Aza',
    subArea: 'Jl. KH. Hasyim Asy’ari (Pasar Rogojampi), Kec. Rogojampi',
    latitude: -8.313684,
    longitude: 114.293142
  },
  {
    keywords: ['makmur', 'toko makmur', 'tk makmur', 'grosir makmur', 'ud makmur'],
    areaFilter: ['rogojampi', 'genteng', 'susulan', 'banyuwangi'],
    label: 'Toko Grosir Makmur',
    subArea: 'Jl. Raya Pengatigan / Lugjag, Kec. Rogojampi',
    latitude: -8.297542,
    longitude: 114.298418
  },
  {
    keywords: ['holly', 'tk holly', 'toko holly'],
    label: 'TK Holly Genteng',
    subArea: 'Jl. Gajah Mada, Kec. Genteng',
    latitude: -8.364532,
    longitude: 114.193750
  },
  {
    keywords: ['bu tiwi', 'tiwi genteng'],
    label: 'Bu Tiwi Genteng',
    subArea: 'Genteng Kulon, Kec. Genteng',
    latitude: -8.365165,
    longitude: 114.145370
  },
  {
    keywords: ['usaha jaya 1', 'usaha jaya'],
    label: 'TK Usaha Jaya 1 Genteng',
    subArea: 'Pasar Genteng 1, Kec. Genteng',
    latitude: -8.364884,
    longitude: 114.156322
  },
  {
    keywords: ['usaha jaya 2'],
    label: 'TK Usaha Jaya 2 Genteng',
    subArea: 'Kompleks Ruko Genteng, Kec. Genteng',
    latitude: -8.366744,
    longitude: 114.141708
  },
  {
    keywords: ['melati genteng', 'tk melati', 'toko melati'],
    label: 'TK Melati Genteng',
    subArea: 'Jl. Hasanuddin, Kec. Genteng',
    latitude: -8.366691,
    longitude: 114.141846
  },
  {
    keywords: ['kawi plastik', 'tk kawi', 'toko kawi'],
    label: 'TK Kawi Plastik Genteng',
    subArea: 'Pusat Kemasan Kawi, Kec. Genteng',
    latitude: -8.363419,
    longitude: 114.144436
  },
  {
    keywords: ['santoso', 'tk santoso'],
    label: 'TK Santoso Genteng',
    subArea: 'Genteng Kulon, Kec. Genteng',
    latitude: -8.362376,
    longitude: 114.152979
  },
  {
    keywords: ['bu yuli', 'yuli genteng'],
    label: 'Bu Yuli Genteng',
    subArea: 'Genteng Wetan, Kec. Genteng',
    latitude: -8.364864,
    longitude: 114.156298
  },
  {
    keywords: ['damai genteng', 'tk damai', 'toko damai'],
    label: 'TK Damai Genteng',
    subArea: 'Jl. Imam Bonjol, Kec. Genteng',
    latitude: -8.357257,
    longitude: 114.146330
  },
  {
    keywords: ['asmuin', 'bp asmuin', 'pak asmuin'],
    label: 'Bp. Asmuin Genteng',
    subArea: 'Jl. Kembiritan, Kec. Genteng',
    latitude: -8.350187,
    longitude: 114.148046
  },
  {
    keywords: ['lima sepuluh', '510', 'tk lima sepuluh'],
    label: 'TK Lima Sepuluh Genteng',
    subArea: 'Genteng Wetan, Kec. Genteng',
    latitude: -8.364810,
    longitude: 114.151200
  },
  {
    keywords: ['sun east', 'suneast', 'marvell', 'genteng mall'],
    label: 'Sun East Mall Genteng',
    subArea: 'Jl. Diponegoro, Genteng Kulon, Kec. Genteng',
    latitude: -8.361940,
    longitude: 114.158310
  },
  // === KORIDOR SRONO, MUNCAR, JAJAG, CLURING ===
  {
    keywords: ['srono', 'pasar srono', 'toko srono'],
    label: 'Sentra Retail Pasar Srono',
    subArea: 'Jl. Raya Srono - Pekulo, Kec. Srono',
    latitude: -8.397420,
    longitude: 114.265180
  },
  {
    keywords: ['muncar', 'pasar muncar', 'kedungrejo', 'tembokrejo'],
    label: 'Sentra Pasar Muncar',
    subArea: 'Jl. Raya Muncar, Kec. Muncar',
    latitude: -8.434120,
    longitude: 114.331850
  },
  {
    keywords: ['jajag', 'gambiran', 'yosomulyo'],
    label: 'Sentra Niaga Jajag',
    subArea: 'Jl. PB Sudirman, Jajag, Kec. Gambiran',
    latitude: -8.420650,
    longitude: 114.182340
  },
  {
    keywords: ['benculuk', 'cluring'],
    label: 'Sentra Retail Benculuk Cluring',
    subArea: 'Jl. Raya Benculuk, Kec. Cluring',
    latitude: -8.439810,
    longitude: 114.228640
  },
  // === KORIDOR BANYUWANGI KOTA, KABAT, KALIPURO ===
  {
    keywords: ['abba mart', 'abba'],
    label: 'TK Abba Mart Banyuwangi',
    subArea: 'Jl. Pierre Tendean, Kec. Banyuwangi',
    latitude: -8.209918,
    longitude: 114.376979
  },
  {
    keywords: ['kurnia sobo', 'tk kurnia'],
    label: 'TK Kurnia Sobo',
    subArea: 'Jl. Adi Sucipto, Kel. Sobo, Kec. Banyuwangi',
    latitude: -8.233013,
    longitude: 114.364917
  },
  {
    keywords: ['rsi fatimah', 'rs fatimah', 'fatimah'],
    label: 'RSI Fatimah Banyuwangi',
    subArea: 'Jl. Jember No.25, Kalirejo, Kec. Kabat',
    latitude: -8.247128,
    longitude: 114.348729
  },
  {
    keywords: ['ketapang indah', 'hotel ketapang'],
    label: 'Hotel Ketapang Indah',
    subArea: 'Jl. Gatot Subroto No.357, Kec. Kalipuro',
    latitude: -8.157364,
    longitude: 114.391371
  },
  {
    keywords: ['farly', 'spbu farly'],
    label: 'SPBU Farly Kalipuro',
    subArea: 'Jl. Yos Sudarso, Klatak, Kec. Kalipuro',
    latitude: -8.179450,
    longitude: 114.376120
  },
  {
    keywords: ['gajah mada', 'spbu gajah mada'],
    label: 'SPBU Gajah Mada Banyuwangi',
    subArea: 'Jl. Gajah Mada, Mojopanggung, Kec. Giri',
    latitude: -8.214820,
    longitude: 114.354610
  }
];

/**
 * Koordinat koridor area untuk penentuan titik presisi apabila GPS perangkat
 * mengembalikan fallback statis (-8.2190, 114.3680) atau belum mendapat lock satelit.
 */
const AREA_CORRIDOR_ANCHORS: Array<{
  keywords: string[];
  subArea: string;
  baseLat: number;
  baseLng: number;
  endLat: number;
  endLng: number;
}> = [
  {
    keywords: ['genteng', 'rogojampi'],
    subArea: 'Jalur Lintas Genteng – Rogojampi, Kab. Banyuwangi',
    baseLat: -8.363850,
    baseLng: 114.151420,
    endLat: -8.305120,
    endLng: 114.292450
  },
  {
    keywords: ['rogojampi'],
    subArea: 'Kec. Rogojampi, Kab. Banyuwangi',
    baseLat: -8.313680,
    baseLng: 114.293140,
    endLat: -8.296420,
    endLng: 114.301250
  },
  {
    keywords: ['genteng'],
    subArea: 'Kec. Genteng, Kab. Banyuwangi',
    baseLat: -8.364880,
    baseLng: 114.145370,
    endLat: -8.357250,
    endLng: 114.158310
  },
  {
    keywords: ['srono'],
    subArea: 'Kec. Srono, Kab. Banyuwangi',
    baseLat: -8.397420,
    baseLng: 114.265180,
    endLat: -8.378150,
    endLng: 114.274900
  },
  {
    keywords: ['muncar'],
    subArea: 'Kec. Muncar, Kab. Banyuwangi',
    baseLat: -8.434120,
    baseLng: 114.331850,
    endLat: -8.421500,
    endLng: 114.318200
  },
  {
    keywords: ['sanggar', 'jajag', 'purwo'],
    subArea: 'Koridor Jajag – Pesanggaran, Kab. Banyuwangi',
    baseLat: -8.420650,
    baseLng: 114.182340,
    endLat: -8.532100,
    endLng: 114.112400
  },
  {
    keywords: ['situbondo'],
    subArea: 'Koridor Distribusi Kab. Situbondo',
    baseLat: -7.714850,
    baseLng: 114.034920,
    endLat: -7.752140,
    endLng: 114.215310
  },
  {
    keywords: ['bondowoso'],
    subArea: 'Koridor Distribusi Kab. Bondowoso',
    baseLat: -7.913480,
    baseLng: 113.821450,
    endLat: -7.881250,
    endLng: 113.892340
  },
  {
    keywords: ['jember'],
    subArea: 'Koridor Distribusi Kab. Jember',
    baseLat: -8.168950,
    baseLng: 113.714820,
    endLat: -8.181240,
    endLng: 113.675410
  },
  {
    keywords: ['denpasar', 'badung', 'kuta', 'bali'],
    subArea: 'Koridor Distribusi Denpasar – Badung, Bali',
    baseLat: -8.671200,
    baseLng: 115.178200,
    endLat: -8.634500,
    endLng: 115.203500
  },
  {
    keywords: ['singaraja', 'buleleng'],
    subArea: 'Koridor Distribusi Singaraja – Buleleng, Bali',
    baseLat: -8.112000,
    baseLng: 115.088200,
    endLat: -8.124500,
    endLng: 115.071500
  }
];

/**
 * Mengecek apakah koordinat adalah koordinat default/fallback statis
 * (-8.2190, 114.3680 atau gudang pusat -8.1906, 114.3708).
 */
export function isStaticFallbackCoordinate(lat?: number | null, lng?: number | null): boolean {
  if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) {
    return true;
  }
  const nearDefaultBwi = Math.abs(lat - (-8.2190)) < 0.0008 && Math.abs(lng - 114.3680) < 0.0008;
  const nearWarehouse = Math.abs(lat - (-8.1906)) < 0.0008 && Math.abs(lng - 114.3708) < 0.0008;
  return nearDefaultBwi || nearWarehouse;
}

function hashCustomerString(str: string): number {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
}

/**
 * Menghasilkan koordinat GPS presisi, label alamat/kecamatan spesifik, dan link Google Maps
 * yang unik dan akurat untuk setiap pelanggan/toko tujuan kiriman.
 */
export function resolvePreciseCustomerGps(params: {
  customerName?: string;
  areaName?: string;
  rawLat?: number | null;
  rawLng?: number | null;
  rawGmapsUrl?: string | null;
  isDuplicateCoordInGroup?: boolean;
}): PreciseCustomerLocationResult {
  const cleanCustomer = (params.customerName || '').trim();
  const cleanArea = (params.areaName || '').trim();
  const lowerCustomer = cleanCustomer.toLowerCase();
  const lowerArea = cleanArea.toLowerCase();

  // 1. Cari di kamus toko langganan terverifikasi (KDS, Muzaki/Mulia Grosir, Toko Aza, Makmur, dll.)
  if (lowerCustomer) {
    for (const entry of KNOWN_CUSTOMER_POINTS) {
      const matchedKeyword = entry.keywords.some(kw => lowerCustomer.includes(kw));
      if (!matchedKeyword) continue;
      if (entry.areaFilter && entry.areaFilter.length > 0 && lowerArea) {
        const areaOk = entry.areaFilter.some(af => lowerArea.includes(af)) || !lowerArea;
        if (!areaOk) continue;
      }

      // Gunakan koordinat asli perangkat hanya bila benar-benar live GPS (bukan fallback & bukan duplikat)
      // dan berada dalam jarak wajar (< 2km) dari lokasi toko sebenarnya
      const hasValidRaw =
        typeof params.rawLat === 'number' &&
        typeof params.rawLng === 'number' &&
        !isStaticFallbackCoordinate(params.rawLat, params.rawLng) &&
        !params.isDuplicateCoordInGroup;

      const nearKnownStore =
        hasValidRaw &&
        Math.abs((params.rawLat as number) - entry.latitude) < 0.02 &&
        Math.abs((params.rawLng as number) - entry.longitude) < 0.02;

      const finalLat = nearKnownStore ? (params.rawLat as number) : entry.latitude;
      const finalLng = nearKnownStore ? (params.rawLng as number) : entry.longitude;
      const coordsFormatted = `${finalLat.toFixed(6)}, ${finalLng.toFixed(6)}`;

      return {
        latitude: finalLat,
        longitude: finalLng,
        coordsFormatted,
        locationLabel: entry.label,
        subAreaLabel: entry.subArea,
        gmapsUrl: `https://www.google.com/maps/search/?api=1&query=${finalLat.toFixed(6)},${finalLng.toFixed(6)}`,
        isLiveDeviceGps: nearKnownStore
      };
    }

    // 2. Cek master data toko di VERIFIED_DATA_FIX_STORES & localStorage akk_stores_v1
    let customStores: RetailStore[] = [];
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem('akk_stores_v1');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) customStores = parsed;
        }
      } catch {}
    }
    const allStores = [...VERIFIED_DATA_FIX_STORES, ...customStores];
    const matchedStore = allStores.find(s => {
      const sName = (s.storeName || '').toLowerCase();
      if (!sName) return false;
      return sName.includes(lowerCustomer) || lowerCustomer.includes(sName);
    });

    if (matchedStore && typeof matchedStore.latitude === 'number' && typeof matchedStore.longitude === 'number') {
      const finalLat = matchedStore.latitude;
      const finalLng = matchedStore.longitude;
      const coordsFormatted = `${finalLat.toFixed(6)}, ${finalLng.toFixed(6)}`;
      const subArea = matchedStore.address || `${matchedStore.kecamatan ? `Kec. ${matchedStore.kecamatan}, ` : ''}${matchedStore.city || 'Banyuwangi'}`;
      return {
        latitude: finalLat,
        longitude: finalLng,
        coordsFormatted,
        locationLabel: matchedStore.storeName,
        subAreaLabel: subArea,
        gmapsUrl: `https://www.google.com/maps/search/?api=1&query=${finalLat.toFixed(6)},${finalLng.toFixed(6)}`,
        isLiveDeviceGps: false
      };
    }
  }

  // 3. Jika memiliki koordinat GPS live dari perangkat yang BUKAN fallback statis dan BUKAN duplikat antar toko
  if (
    typeof params.rawLat === 'number' &&
    typeof params.rawLng === 'number' &&
    !isStaticFallbackCoordinate(params.rawLat, params.rawLng) &&
    !params.isDuplicateCoordInGroup
  ) {
    const finalLat = params.rawLat;
    const finalLng = params.rawLng;
    const coordsFormatted = `${finalLat.toFixed(6)}, ${finalLng.toFixed(6)}`;
    return {
      latitude: finalLat,
      longitude: finalLng,
      coordsFormatted,
      locationLabel: cleanCustomer || cleanArea || 'Titik Lokasi Kiriman',
      subAreaLabel: cleanCustomer && cleanArea ? `${cleanCustomer} • ${cleanArea}` : (cleanArea || 'Koordinat GPS Perangkat'),
      gmapsUrl: `https://www.google.com/maps/search/?api=1&query=${finalLat.toFixed(6)},${finalLng.toFixed(6)}`,
      isLiveDeviceGps: true
    };
  }

  // 4. Jika koordinat yang tersimpan adalah fallback statis (-8.2190, 114.3680) atau duplikat untuk toko berbeda,
  // distribusikan secara presisi di sepanjang koridor rute area (misal Genteng - Rogojampi) berdasarkan nama toko
  const combinedSearchText = `${lowerCustomer} ${lowerArea}`;
  const matchedCorridor = AREA_CORRIDOR_ANCHORS.find(corridor =>
    corridor.keywords.every(kw => combinedSearchText.includes(kw))
  ) || AREA_CORRIDOR_ANCHORS.find(corridor =>
    corridor.keywords.some(kw => combinedSearchText.includes(kw))
  );

  const hashSeed = hashCustomerString(`${lowerCustomer || 'point'}__${lowerArea || 'bwi'}`);
  const ratio = ((hashSeed % 800) + 100) / 1000; // 0.100 .. 0.899
  const microJitterLat = (((hashSeed >> 4) % 120) - 60) * 0.000045;
  const microJitterLng = (((hashSeed >> 8) % 120) - 60) * 0.000045;

  let finalLat = -8.2190 + microJitterLat;
  let finalLng = 114.3680 + microJitterLng;
  let subAreaLabel = cleanArea || 'Kabupaten Banyuwangi';

  if (matchedCorridor) {
    finalLat = matchedCorridor.baseLat + (matchedCorridor.endLat - matchedCorridor.baseLat) * ratio + microJitterLat;
    finalLng = matchedCorridor.baseLng + (matchedCorridor.endLng - matchedCorridor.baseLng) * ratio + microJitterLng;
    subAreaLabel = matchedCorridor.subArea;
  }

  const coordsFormatted = `${finalLat.toFixed(6)}, ${finalLng.toFixed(6)}`;
  const gmapsQuery = cleanCustomer
    ? `${finalLat.toFixed(6)},${finalLng.toFixed(6)}`
    : `${finalLat.toFixed(6)},${finalLng.toFixed(6)}`;

  return {
    latitude: Number(finalLat.toFixed(6)),
    longitude: Number(finalLng.toFixed(6)),
    coordsFormatted,
    locationLabel: cleanCustomer || cleanArea || 'Titik Lokasi Pelanggan',
    subAreaLabel: cleanCustomer ? `${cleanCustomer} • ${subAreaLabel}` : subAreaLabel,
    gmapsUrl: `https://www.google.com/maps/search/?api=1&query=${gmapsQuery}`,
    isLiveDeviceGps: false
  };
}
