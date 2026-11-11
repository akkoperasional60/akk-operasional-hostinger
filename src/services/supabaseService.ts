import { logisticsStore } from './store';
import { Fleet, Crew, VehicleType, FleetStatus, CrewStatus } from '../types';
import { resolveCanonicalFleetMeta } from '../data/mockData';

/**
 * Backward-compatible service name retained to avoid breaking old imports.
 * Production persistence is now Hostinger MySQL through same-origin Express APIs.
 */
export function sanitizeSupabaseUrl(rawUrl: string | undefined): string {
  return (rawUrl || '').trim().replace(/\/+$/, '');
}

export function getSupabaseClient(): any | null {
  // Deliberately disabled: database credentials and persistence live server-side on Hostinger.
  return null;
}

async function apiJson(url: string, init?: RequestInit): Promise<any> {
  let token = '';
  try {
    token =
      (typeof localStorage !== 'undefined' ? localStorage.getItem('akk_session_token_v1') : null) ||
      (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('akk_session_token_v1') : null) ||
      '';
  } catch {}
  const headers: Record<string, string> = {
    ...(init?.headers ? (init.headers as Record<string, string>) : {})
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
    headers['x-akk-session-token'] = token;
  }
  const response = await fetch(url, {
    credentials: 'same-origin',
    ...init,
    headers
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || `HTTP ${response.status}`);
  return data;
}

export async function testSupabaseConnection(_customUrl?: string, _customKey?: string): Promise<{ success: boolean; message: string }> {
  try {
    const data = await apiJson('/api/db-status');
    return { success: Boolean(data?.success), message: data?.message || 'Hostinger MySQL siap digunakan.' };
  } catch (err: any) {
    return { success: false, message: `Hostinger MySQL belum siap: ${err?.message || err}` };
  }
}

export async function purgeAkkFleetsFromSupabase(): Promise<{ success: boolean; count: number; message: string }> {
  try {
    const current = await fetchFleetsFromSupabase();
    const targets = current.data.filter(f => (f.plateNumber || '').trim().toUpperCase().endsWith('AKK'));
    let count = 0;
    for (const fleet of targets) {
      const result = await deleteFleetInSupabase(fleet.id, fleet.plateNumber);
      if (result.success) count++;
    }
    return { success: true, count, message: `Berhasil menghapus ${count} armada berakhiran AKK dari Hostinger MySQL.` };
  } catch (err: any) {
    return { success: false, count: 0, message: err?.message || 'Gagal menghapus armada.' };
  }
}

export async function persistSchedulesToDatabase(
  schedules: any[],
  weeks?: any[],
  meta?: { month?: string; year?: number; source?: string }
): Promise<{ success: boolean; serverSaved: boolean; supabaseSaved: boolean; count: number; message: string }> {
  const count = Array.isArray(schedules) ? schedules.length : 0;
  try {
    await apiJson('/api/schedules/persist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schedules, weeks, month: meta?.month, year: meta?.year, source: meta?.source || 'upload' })
    });
    return {
      success: true,
      serverSaved: true,
      supabaseSaved: false,
      count,
      message: `✅ ${count} jadwal pengiriman tersimpan permanen di Hostinger MySQL.`
    };
  } catch (err: any) {
    return { success: false, serverSaved: false, supabaseSaved: false, count, message: err?.message || 'Gagal menyimpan jadwal ke Hostinger MySQL.' };
  }
}

export async function fetchPersistedSchedulesFromServer(): Promise<{ exists: boolean; schedules: any[]; weeks: any[]; count: number }> {
  try {
    const data = await apiJson('/api/schedules/persisted');
    return { exists: Boolean(data?.exists), schedules: data?.schedules || [], weeks: data?.weeks || [], count: Number(data?.count || 0) };
  } catch {
    return { exists: false, schedules: [], weeks: [], count: 0 };
  }
}

export function mapSupabaseRowToFleet(row: any, fallback?: Fleet): Fleet {
  const numberOrFallback = (value: any, fallbackValue?: number): number | undefined => {
    if (value === null || value === undefined || value === '') return fallbackValue;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallbackValue;
  };

  const nonEmptyStr = (...vals: any[]): string | undefined => {
    for (const v of vals) {
      if (typeof v === 'string' && v.trim() !== '') return v.trim();
    }
    return undefined;
  };

  const explicitStrOrFallback = (primary: any, secondary: any, fb?: string, canon?: string): string | undefined => {
    if (primary !== undefined && primary !== null) return String(primary).trim();
    if (secondary !== undefined && secondary !== null) return String(secondary).trim();
    if (fb !== undefined) return fb;
    return canon;
  };

  const existingInStore = logisticsStore
    .getFleets()
    .find(
      f =>
        f.id === row?.id ||
        (row?.plateNumber && f.plateNumber === row.plateNumber) ||
        (row?.plate_number && f.plateNumber === row.plate_number)
    );

  const effFallback = fallback || existingInStore;
  const canonical =
    resolveCanonicalFleetMeta(row?.plateNumber || row?.plate_number || row?.id || effFallback) ||
    effFallback;

  const boxCap = numberOrFallback(
    row.boxCapacityM3 ?? row.box_capacity_m3,
    effFallback?.boxCapacityM3 ?? canonical?.boxCapacityM3
  );
  const mult = numberOrFallback(
    row.boxInnerMultiplierPercent ?? row.box_inner_multiplier_percent,
    effFallback?.boxInnerMultiplierPercent ?? canonical?.boxInnerMultiplierPercent ?? 90
  );
  const innerCap = numberOrFallback(
    row.boxInnerCapacityM3 ?? row.box_inner_capacity_m3,
    effFallback?.boxInnerCapacityM3 ??
      canonical?.boxInnerCapacityM3 ??
      (boxCap && mult ? Number((boxCap * (mult / 100)).toFixed(2)) : undefined)
  );

  let rawLastMaint = explicitStrOrFallback(
    row.lastMaintenance ?? row.kirExpiryDate,
    row.last_maintenance ?? row.kir_expiry_date,
    effFallback?.lastMaintenance ?? effFallback?.kirExpiryDate,
    canonical?.lastMaintenance ?? canonical?.kirExpiryDate
  );
  if (rawLastMaint && rawLastMaint.includes('T')) {
    rawLastMaint = rawLastMaint.slice(0, 10);
  }

  return {
    ...(canonical || ({} as Fleet)),
    ...(effFallback || ({} as Fleet)),
    id: nonEmptyStr(row.id, effFallback?.id, canonical?.id) || `flt-${Date.now()}`,
    plateNumber: nonEmptyStr(row.plateNumber, row.plate_number, effFallback?.plateNumber, canonical?.plateNumber) || '',
    vehicleType: (nonEmptyStr(row.vehicleType, row.vehicle_type, effFallback?.vehicleType, canonical?.vehicleType) || 'Engkel STD') as VehicleType,
    initialCode: explicitStrOrFallback(row.initialCode, row.initial_code, effFallback?.initialCode, canonical?.initialCode),
    brand: explicitStrOrFallback(row.brand, row.brand_name, effFallback?.brand, canonical?.brand),
    engineCc: explicitStrOrFallback(row.engineCc, row.engine_cc, effFallback?.engineCc, canonical?.engineCc),
    boxCapacityM3: boxCap,
    boxDimensions: explicitStrOrFallback(row.boxDimensions, row.box_dimensions, effFallback?.boxDimensions, canonical?.boxDimensions),
    boxInnerMultiplierPercent: mult,
    boxInnerCapacityM3: innerCap,
    boxInnerDimensions: explicitStrOrFallback(row.boxInnerDimensions, row.box_inner_dimensions, effFallback?.boxInnerDimensions, canonical?.boxInnerDimensions),
    driverId: explicitStrOrFallback(row.driverId, row.driver_id, effFallback?.driverId, canonical?.driverId),
    tonnageCapacity: numberOrFallback(row.tonnageCapacity ?? row.tonnage_capacity, effFallback?.tonnageCapacity ?? canonical?.tonnageCapacity) ?? 0,
    currentTonnage: Number(row.currentTonnage ?? row.current_tonnage ?? effFallback?.currentTonnage ?? canonical?.currentTonnage ?? 0),
    status: (nonEmptyStr(row.status, effFallback?.status, canonical?.status) || 'available') as FleetStatus,
    gpsImei: nonEmptyStr(row.gpsImei, row.gps_imei, effFallback?.gpsImei, canonical?.gpsImei) || '',
    fuelLevelPercent: Number(row.fuelLevelPercent ?? row.fuel_level_percent ?? effFallback?.fuelLevelPercent ?? canonical?.fuelLevelPercent ?? 100),
    odometerKm: numberOrFallback(row.odometerKm ?? row.odometer_km, effFallback?.odometerKm ?? canonical?.odometerKm) ?? 0,
    year: numberOrFallback(row.year, effFallback?.year ?? canonical?.year) ?? new Date().getFullYear(),
    lastMaintenance: rawLastMaint,
    kirDocUrl: explicitStrOrFallback(row.kirDocUrl, row.kir_doc_url, effFallback?.kirDocUrl, canonical?.kirDocUrl),
    kirDocFileName: explicitStrOrFallback(row.kirDocFileName, row.kir_doc_file_name, effFallback?.kirDocFileName, canonical?.kirDocFileName),
    kirDocUploadedAt: explicitStrOrFallback(row.kirDocUploadedAt, row.kir_doc_uploaded_at, effFallback?.kirDocUploadedAt, canonical?.kirDocUploadedAt),
    taxDueDate: explicitStrOrFallback(row.taxDueDate, row.tax_due_date, effFallback?.taxDueDate, canonical?.taxDueDate),
    stnkExpiryDate: explicitStrOrFallback(row.stnkExpiryDate, row.stnk_expiry_date, effFallback?.stnkExpiryDate, canonical?.stnkExpiryDate),
    kirExpiryDate: rawLastMaint
  } as Fleet;
}

export function mapSupabaseRowToCrew(row: any, fallback?: Crew): Crew {
  return {
    ...(fallback || {} as Crew),
    id: row.id || fallback?.id || `crw-${Date.now()}`,
    name: row.name || fallback?.name || '',
    phone: row.phone || fallback?.phone || '-',
    role: row.role || fallback?.role || 'Driver Utama',
    licenseNumber: row.licenseNumber || row.license_number || fallback?.licenseNumber || '-',
    licenseType: row.licenseType || row.license_type || fallback?.licenseType || 'SIM B2 Umum',
    status: (row.status || fallback?.status || 'available') as CrewStatus,
    tripsCompleted: Number(row.tripsCompleted ?? row.trips_completed ?? fallback?.tripsCompleted ?? 0),
    rating: Number(row.rating ?? fallback?.rating ?? 5)
  } as Crew;
}

export async function fetchFleetsFromSupabase(): Promise<{ success: boolean; data: Fleet[]; error?: string }> {
  try {
    const data = await apiJson('/api/fleets');
    const localFleets = logisticsStore.getFleets();
    return {
      success: true,
      data: (data?.data || []).map((row: any) => {
        const fb = localFleets.find(
          f => f.id === row?.id || (row?.plateNumber && f.plateNumber === row.plateNumber)
        );
        return mapSupabaseRowToFleet(row, fb);
      })
    };
  } catch (err: any) {
    return { success: false, data: logisticsStore.getFleets(), error: err?.message || 'Gagal membaca armada Hostinger MySQL' };
  }
}

export async function createFleetInSupabase(fleet: Fleet): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const data = await apiJson('/api/fleets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(fleet) });
    return { success: true, data: data?.data };
  } catch (err: any) { return { success: false, error: err?.message }; }
}

export async function updateFleetInSupabase(id: string, updates: Partial<Fleet>): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const data = await apiJson(`/api/fleets/${encodeURIComponent(id)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates) });
    return { success: true, data: data?.data };
  } catch (err: any) { return { success: false, error: err?.message }; }
}

export async function deleteFleetInSupabase(id: string, plateNumber?: string): Promise<{ success: boolean; error?: string }> {
  try {
    const query = plateNumber ? `?plateNumber=${encodeURIComponent(plateNumber)}` : '';
    await apiJson(`/api/fleets/${encodeURIComponent(id)}${query}`, { method: 'DELETE' });
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message };
  }
}

export async function fetchCrewsFromSupabase(): Promise<{ success: boolean; data: Crew[]; error?: string }> {
  try {
    const data = await apiJson('/api/crews');
    return { success: true, data: (data?.data || []).map((row: any) => mapSupabaseRowToCrew(row)) };
  } catch (err: any) {
    return { success: false, data: logisticsStore.getCrews(), error: err?.message || 'Gagal membaca kru Hostinger MySQL' };
  }
}

export async function createCrewInSupabase(crew: Crew): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const data = await apiJson('/api/crews', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(crew) });
    return { success: true, data: data?.data };
  } catch (err: any) { return { success: false, error: err?.message }; }
}

export async function updateCrewInSupabase(id: string, updates: Partial<Crew>): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const data = await apiJson(`/api/crews/${encodeURIComponent(id)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates) });
    return { success: true, data: data?.data };
  } catch (err: any) { return { success: false, error: err?.message }; }
}

export async function deleteCrewInSupabase(id: string, _name?: string): Promise<{ success: boolean; error?: string }> {
  try { await apiJson(`/api/crews/${encodeURIComponent(id)}`, { method: 'DELETE' }); return { success: true }; }
  catch (err: any) { return { success: false, error: err?.message }; }
}

export async function syncFleetsAndCrewsWithSupabase(): Promise<{ success: boolean; fleetsCount: number; crewsCount: number; message: string }> {
  const [fleets, crews] = await Promise.all([fetchFleetsFromSupabase(), fetchCrewsFromSupabase()]);
  if (fleets.success) logisticsStore.setFleets(fleets.data);
  if (crews.success) logisticsStore.setCrews(crews.data);
  return {
    success: fleets.success && crews.success,
    fleetsCount: fleets.data.length,
    crewsCount: crews.data.length,
    message: fleets.success && crews.success
      ? `Hostinger MySQL sinkron: ${fleets.data.length} armada & ${crews.data.length} kru.`
      : 'Sebagian data Hostinger MySQL belum dapat disinkronkan.'
  };
}
