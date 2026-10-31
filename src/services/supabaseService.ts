import { logisticsStore } from './store';
import { Fleet, Crew, VehicleType, FleetStatus, CrewStatus } from '../types';

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
  const response = await fetch(url, init);
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
    return Number.isFinite(parsed) ? parsed : fallbackValue;
  };

  return {
    ...(fallback || {} as Fleet),
    id: row.id || fallback?.id || `flt-${Date.now()}`,
    plateNumber: row.plateNumber || row.plate_number || fallback?.plateNumber || '',
    vehicleType: (row.vehicleType || row.vehicle_type || fallback?.vehicleType || 'Engkel STD') as VehicleType,
    initialCode: row.initialCode ?? row.initial_code ?? fallback?.initialCode,
    brand: row.brand ?? row.brand_name ?? fallback?.brand,
    engineCc: row.engineCc ?? row.engine_cc ?? fallback?.engineCc,
    boxCapacityM3: numberOrFallback(row.boxCapacityM3 ?? row.box_capacity_m3, fallback?.boxCapacityM3),
    boxDimensions: row.boxDimensions ?? row.box_dimensions ?? fallback?.boxDimensions,
    boxInnerMultiplierPercent: numberOrFallback(
      row.boxInnerMultiplierPercent ?? row.box_inner_multiplier_percent,
      fallback?.boxInnerMultiplierPercent
    ),
    boxInnerCapacityM3: numberOrFallback(
      row.boxInnerCapacityM3 ?? row.box_inner_capacity_m3,
      fallback?.boxInnerCapacityM3
    ),
    boxInnerDimensions: row.boxInnerDimensions ?? row.box_inner_dimensions ?? fallback?.boxInnerDimensions,
    driverId: row.driverId ?? row.driver_id ?? fallback?.driverId,
    tonnageCapacity: Number(row.tonnageCapacity ?? row.tonnage_capacity ?? fallback?.tonnageCapacity ?? 0),
    currentTonnage: Number(row.currentTonnage ?? row.current_tonnage ?? fallback?.currentTonnage ?? 0),
    status: (row.status || fallback?.status || 'available') as FleetStatus,
    gpsImei: row.gpsImei ?? row.gps_imei ?? fallback?.gpsImei,
    fuelLevelPercent: Number(row.fuelLevelPercent ?? row.fuel_level_percent ?? fallback?.fuelLevelPercent ?? 100),
    odometerKm: Number(row.odometerKm ?? row.odometer_km ?? fallback?.odometerKm ?? 0),
    year: Number(row.year ?? fallback?.year ?? new Date().getFullYear()),
    lastMaintenance: row.lastMaintenance ?? row.last_maintenance ?? fallback?.lastMaintenance,
    kirDocUrl: row.kirDocUrl ?? row.kir_doc_url ?? fallback?.kirDocUrl,
    kirDocFileName: row.kirDocFileName ?? row.kir_doc_file_name ?? fallback?.kirDocFileName,
    kirDocUploadedAt: row.kirDocUploadedAt ?? row.kir_doc_uploaded_at ?? fallback?.kirDocUploadedAt,
    taxDueDate: row.taxDueDate ?? row.tax_due_date ?? fallback?.taxDueDate,
    stnkExpiryDate: row.stnkExpiryDate ?? row.stnk_expiry_date ?? fallback?.stnkExpiryDate,
    kirExpiryDate: row.kirExpiryDate ?? row.kir_expiry_date ?? fallback?.kirExpiryDate
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
    return { success: true, data: (data?.data || []).map((row: any) => mapSupabaseRowToFleet(row)) };
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

export async function deleteFleetInSupabase(id: string, _plateNumber?: string): Promise<{ success: boolean; error?: string }> {
  try { await apiJson(`/api/fleets/${encodeURIComponent(id)}`, { method: 'DELETE' }); return { success: true }; }
  catch (err: any) { return { success: false, error: err?.message }; }
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
