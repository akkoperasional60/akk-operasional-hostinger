import { Fleet, Crew, VehicleType, FleetStatus, CrewStatus } from '../types';

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

/**
 * Validasi Nomor Plat Kendaraan Indonesia:
 * Format umum: 1-2 huruf kode wilayah (P, B, L, N, DK, dll), 1-4 digit angka, 1-3 huruf seri.
 * Contoh valid: 'P 8125 VC', 'B 9503 XYZ', 'DK 1234 AB', 'W 8229 US'.
 */
export const INDONESIAN_PLATE_REGEX = /^[A-Z]{1,2}\s*[0-9]{1,4}\s*[A-Z]{1,3}$/i;

/**
 * Validasi Nomor Telepon Indonesia (HP / WhatsApp):
 * Contoh valid: '081234567890', '+628123456789', '6285234567890'.
 */
export const INDONESIAN_PHONE_REGEX = /^(\+62|62|0)8[1-9][0-9]{6,11}$/;

/**
 * Validasi Data Armada (Fleet)
 */
export function validateFleet(
  fleet: Partial<Fleet>,
  existingFleets: Fleet[] = [],
  isEdit = false,
  currentId?: string
): ValidationResult {
  const errors: Record<string, string> = {};

  // 1. Nomor Polisi (Plat)
  const plate = (fleet.plateNumber || '').trim().toUpperCase();
  if (!plate) {
    errors.plateNumber = 'Nomor polisi (plat nomor) wajib diisi.';
  } else if (plate.endsWith('AKK')) {
    errors.plateNumber = 'Dilarang menggunakan plat berakhiran AKK sesuai regulasi armada resmi.';
  } else if (!INDONESIAN_PLATE_REGEX.test(plate)) {
    errors.plateNumber = 'Format plat tidak valid. Contoh format: P 8125 VC atau B 9503 XYZ.';
  } else {
    // Check uniqueness
    const duplicate = existingFleets.find(
      f => f.plateNumber.trim().toUpperCase() === plate && (!isEdit || f.id !== currentId)
    );
    if (duplicate) {
      errors.plateNumber = `Plat nomor ${plate} sudah terdaftar pada armada lain (${duplicate.initialCode || duplicate.vehicleType}).`;
    }
  }

  // 2. Inisial Kendaraan (Unit Code)
  const initial = (fleet.initialCode || '').trim();
  if (!initial) {
    errors.initialCode = 'Inisial armada wajib diisi (contoh: N1, NP1, DS-1, WB-01).';
  } else if (initial.length < 2) {
    errors.initialCode = 'Inisial armada minimal 2 karakter.';
  }

  // 3. Tipe Kendaraan
  const allowedTypes: VehicleType[] = ['Pick Up Box', 'Engkel STD', 'Engkel Long', 'Double STD'];
  if (!fleet.vehicleType) {
    errors.vehicleType = 'Tipe kendaraan wajib dipilih.';
  } else if (!allowedTypes.includes(fleet.vehicleType)) {
    errors.vehicleType = 'Pilih tipe kendaraan yang valid.';
  }

  // 4. Merk Kendaraan
  if (!fleet.brand || !fleet.brand.trim()) {
    errors.brand = 'Merk kendaraan wajib diisi / dipilih.';
  }

  // 5. Tahun Produksi
  const currentYear = new Date().getFullYear();
  if (fleet.year !== undefined && fleet.year !== null) {
    const yr = Number(fleet.year);
    if (isNaN(yr) || yr < 1990 || yr > currentYear + 1) {
      errors.year = `Tahun produksi harus antara 1990 dan ${currentYear + 1}.`;
    }
  }

  // 6. Kubikasi Box (m3)
  if (fleet.boxCapacityM3 !== undefined && fleet.boxCapacityM3 !== null) {
    const m3 = Number(fleet.boxCapacityM3);
    if (isNaN(m3) || m3 <= 0 || m3 > 150) {
      errors.boxCapacityM3 = 'Kapasitas kubikasi box luar harus berupa angka positif (1 - 150 m³).';
    }
  }

  // 7. IMEI GPS Tracksolid (Opsional)
  if (fleet.gpsImei && fleet.gpsImei.trim() !== '-' && fleet.gpsImei.trim() !== '') {
    const cleanImei = fleet.gpsImei.trim().replace(/\s+/g, '');
    if (!/^\d{8,18}$/.test(cleanImei)) {
      errors.gpsImei = 'Nomor IMEI GPS harus berupa 8-18 digit angka (atau kosongkan / ketik "-" jika Non-GPS).';
    }
  }

function parseFlexibleDate(val: string): Date | null {
  if (!val || typeof val !== 'string') return null;
  const trimmed = val.trim();
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(trimmed)) {
    const [d, m, y] = trimmed.split('/').map(Number);
    const date = new Date(y, m - 1, d);
    return isNaN(date.getTime()) ? null : date;
  }
  if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(trimmed)) {
    const [d, m, y] = trimmed.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return isNaN(date.getTime()) ? null : date;
  }
  const d = new Date(trimmed);
  return isNaN(d.getTime()) ? null : d;
}

  // 8. Tanggal Pajak & STNK
  if (fleet.taxDueDate) {
    const d = parseFlexibleDate(fleet.taxDueDate);
    if (!d) {
      errors.taxDueDate = 'Format tanggal jatuh tempo pajak tidak valid.';
    }
  }

  if (fleet.stnkExpiryDate) {
    const d = parseFlexibleDate(fleet.stnkExpiryDate);
    if (!d) {
      errors.stnkExpiryDate = 'Format tanggal masa berlaku STNK tidak valid.';
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

/**
 * Validasi Data Kru (Crew: Supir & Helper)
 */
export function validateCrew(
  crew: Partial<Crew>,
  existingCrews: Crew[] = [],
  isEdit = false,
  currentId?: string
): ValidationResult {
  const errors: Record<string, string> = {};

  // 1. Nama Lengkap
  const name = (crew.name || '').trim();
  if (!name) {
    errors.name = 'Nama lengkap kru wajib diisi.';
  } else if (name.length < 3) {
    errors.name = 'Nama kru minimal 3 karakter.';
  } else {
    const duplicate = existingCrews.find(
      c => c.name.trim().toLowerCase() === name.toLowerCase() && (!isEdit || c.id !== currentId)
    );
    if (duplicate) {
      errors.name = `Kru dengan nama "${name}" sudah terdaftar dalam sistem.`;
    }
  }

  // 2. Peran Tugas (Role)
  const allowedRoles = ['Driver Utama', 'Driver Cadangan', 'Kernet / Helper'];
  if (!crew.role || !allowedRoles.includes(crew.role)) {
    errors.role = 'Pilih peran tugas yang valid (Driver Utama, Driver Cadangan, atau Kernet / Helper).';
  }

  // 3. Nomor Handphone / WhatsApp (Optional)
  const phone = (crew.phone || '-').trim();

  // 4. Jenis SIM & Nomor SIM (Optional)
  const licenseType = crew.licenseType || '-';
  const licenseNumber = crew.licenseNumber || '-';

  // 5. Status
  const allowedStatuses: CrewStatus[] = ['available', 'on-duty', 'off'];
  if (crew.status && !allowedStatuses.includes(crew.status)) {
    errors.status = 'Status operasional kru tidak valid.';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}
