export interface PreciseCustomerLocationResult {
  latitude: number;
  longitude: number;
  coordsFormatted: string;
  locationLabel: string;
  subAreaLabel: string;
  gmapsUrl: string;
  isLiveDeviceGps: boolean;
}

/**
 * Production-safe GPS resolver.
 * It NEVER invents, hashes, jitters, interpolates, or substitutes customer/master coordinates
 * as if they were live device GPS. It preserves the actual raw coordinates supplied by the
 * device/report. The legacy DC fallback is kept only when no numeric coordinate exists so
 * existing UI contracts remain numeric; it is explicitly marked as non-live.
 */
export function isStaticFallbackCoordinate(lat?: number | null, lng?: number | null): boolean {
  if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng)) return true;
  const nearDefaultBwi = Math.abs(lat - (-8.2190)) < 0.0008 && Math.abs(lng - 114.3680) < 0.0008;
  const nearWarehouse = Math.abs(lat - (-8.1906)) < 0.0008 && Math.abs(lng - 114.3708) < 0.0008;
  return nearDefaultBwi || nearWarehouse;
}

export function resolvePreciseCustomerGps(params: {
  customerName?: string;
  areaName?: string;
  rawLat?: number | null;
  rawLng?: number | null;
  rawGmapsUrl?: string | null;
  isDuplicateCoordInGroup?: boolean;
}): PreciseCustomerLocationResult {
  const hasRaw =
    typeof params.rawLat === 'number' && Number.isFinite(params.rawLat) &&
    typeof params.rawLng === 'number' && Number.isFinite(params.rawLng);
  const latitude = hasRaw ? Number(params.rawLat) : -8.2190;
  const longitude = hasRaw ? Number(params.rawLng) : 114.3680;
  const isLiveDeviceGps = hasRaw && !isStaticFallbackCoordinate(latitude, longitude);
  const coordsFormatted = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
  const locationLabel = (params.customerName || params.areaName || (isLiveDeviceGps ? 'GPS Perangkat' : 'GPS Belum Tersedia')).trim();
  const subAreaLabel = isLiveDeviceGps
    ? ((params.areaName || 'Koordinat GPS perangkat').trim())
    : 'Koordinat fallback aplikasi — bukan titik GPS presisi pelanggan';
  const gmapsUrl = params.rawGmapsUrl && hasRaw
    ? params.rawGmapsUrl
    : `https://www.google.com/maps/search/?api=1&query=${latitude.toFixed(6)},${longitude.toFixed(6)}`;
  return { latitude, longitude, coordsFormatted, locationLabel, subAreaLabel, gmapsUrl, isLiveDeviceGps };
}
