import { DriverShiftCheckin, ShiftVerificationMethod } from '../types';
import { driverReportService, getLocalDateStr } from './driverReportService';
import { logisticsStore, safeSetItem } from './store';
import { getUserRoleDisplayTitle } from '../utils/rbac';

const SHIFTS_STORAGE_KEY = 'akk_driver_shifts_v2';
const PINS_STORAGE_KEY = 'akk_driver_pins_v2';

function normalizeIdentityId(rawId?: string): string {
  const clean = String(rawId || '').trim().toLowerCase();
  if (!clean) return '';
  return clean.replace(/^crw-/, '');
}

function normalizePersonName(rawName?: string): string {
  return String(rawName || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function isSameDriverIdentity(
  shiftDriverId?: string,
  shiftDriverName?: string,
  targetDriverId?: string,
  targetDriverName?: string
): boolean {
  const sIdRaw = String(shiftDriverId || '').trim().toLowerCase();
  const tIdRaw = String(targetDriverId || '').trim().toLowerCase();
  if (sIdRaw && tIdRaw && sIdRaw === tIdRaw) return true;

  const sIdNorm = normalizeIdentityId(shiftDriverId);
  const tIdNorm = normalizeIdentityId(targetDriverId);
  if (sIdNorm && tIdNorm && sIdNorm === tIdNorm) return true;

  const currentUser = logisticsStore.getCurrentUser();
  const currentUserIdNorm = normalizeIdentityId(currentUser?.id);
  const currentUserNameNorm = normalizePersonName(currentUser?.fullName);
  const activeCrew = logisticsStore.getActiveDriverCrew();
  const activeCrewIdNorm = normalizeIdentityId(activeCrew?.id);
  const activeCrewNameNorm = normalizePersonName(activeCrew?.name);

  const sNameNorm = normalizePersonName(shiftDriverName);
  const tNameNorm = normalizePersonName(targetDriverName) || activeCrewNameNorm || currentUserNameNorm;

  if (sNameNorm && tNameNorm && sNameNorm === tNameNorm) {
    return true;
  }

  // Match if targetDriverId belongs to the logged-in user and shift matches logged-in user's crew/name
  const targetMatchesCurrentUser =
    (tIdNorm && (tIdNorm === currentUserIdNorm || tIdNorm === activeCrewIdNorm)) ||
    (tNameNorm && (tNameNorm === currentUserNameNorm || tNameNorm === activeCrewNameNorm));

  if (targetMatchesCurrentUser) {
    if (sIdNorm && (sIdNorm === currentUserIdNorm || sIdNorm === activeCrewIdNorm)) return true;
    if (sNameNorm && (sNameNorm === currentUserNameNorm || sNameNorm === activeCrewNameNorm)) return true;
  }

  return false;
}

class DriverShiftService {
  private memoryShifts: DriverShiftCheckin[] | null = null;
  private memoryPins: Record<string, string> | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (evt) => {
        if (evt.key === SHIFTS_STORAGE_KEY) {
          this.memoryShifts = null;
        }
        if (evt.key === PINS_STORAGE_KEY) {
          this.memoryPins = null;
        }
      });
    }
  }

  private persistShifts(shifts: DriverShiftCheckin[]): void {
    const trimmed = shifts.slice(0, 150);
    this.memoryShifts = trimmed;
    const serialized = JSON.stringify(trimmed);
    safeSetItem(SHIFTS_STORAGE_KEY, serialized);
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(SHIFTS_STORAGE_KEY, serialized);
      }
    } catch {}
  }

  private readPinsMap(): Record<string, string> {
    if (this.memoryPins !== null) {
      return this.memoryPins;
    }
    try {
      const raw =
        (typeof localStorage !== 'undefined' ? localStorage.getItem(PINS_STORAGE_KEY) : null) ||
        (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(PINS_STORAGE_KEY) : null);
      const parsed = raw ? JSON.parse(raw) : {};
      const validPins: Record<string, string> = parsed && typeof parsed === 'object' ? parsed : {};
      this.memoryPins = validPins;
      return validPins;
    } catch {
      this.memoryPins = {};
      return {};
    }
  }

  private writePinsMap(pins: Record<string, string>): void {
    this.memoryPins = { ...pins };
    const serialized = JSON.stringify(pins);
    safeSetItem(PINS_STORAGE_KEY, serialized);
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(PINS_STORAGE_KEY, serialized);
      }
    } catch {}
  }

  private resolvePinCandidateKeys(driverId: string, driverName?: string): string[] {
    const keys = new Set<string>();
    const raw = String(driverId || '').trim();
    if (raw) {
      keys.add(raw);
      const norm = normalizeIdentityId(raw);
      if (norm) {
        keys.add(norm);
        keys.add(`crw-${norm}`);
      }
    }
    const currentUser = logisticsStore.getCurrentUser();
    if (currentUser?.id && currentUser.id !== 'guest') {
      keys.add(currentUser.id);
      keys.add(`crw-${currentUser.id}`);
    }
    const nameKey = normalizePersonName(driverName || currentUser?.fullName);
    if (nameKey) {
      keys.add(`name:${nameKey}`);
    }
    return Array.from(keys);
  }

  /**
   * Get all recorded shifts from storage
   */
  public getShifts(): DriverShiftCheckin[] {
    if (this.memoryShifts !== null) {
      return [...this.memoryShifts];
    }
    try {
      const raw =
        (typeof localStorage !== 'undefined' ? localStorage.getItem(SHIFTS_STORAGE_KEY) : null) ||
        (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(SHIFTS_STORAGE_KEY) : null);
      if (!raw) {
        this.memoryShifts = [];
        return [];
      }
      const parsed = JSON.parse(raw);
      this.memoryShifts = Array.isArray(parsed) ? parsed : [];
      return [...this.memoryShifts];
    } catch {
      this.memoryShifts = [];
      return [];
    }
  }

  /**
   * Get active shift for specific driver today (status !== 'checked_out')
   * Resilient against:
   * - Dynamic crew/user ID switches (usr-xxx vs crw-usr-xxx vs crw-01)
   * - UTC vs Local WIB date rollover at 07:00 WIB
   * - WebView storage clears (automatically reconstructs from today's Laporan Kiriman Kru presensi_shift)
   */
  public getActiveShift(driverId: string, driverName?: string): DriverShiftCheckin | null {
    const todayLocal = getLocalDateStr();
    const todayUtc = new Date().toISOString().split('T')[0];
    const shifts = this.getShifts();
    const nowMs = Date.now();

    const active = shifts.find(s => {
      if (!s || s.status === 'checked_out') return false;
      if (!isSameDriverIdentity(s.driverId, s.driverName, driverId, driverName)) return false;

      const shiftLocalDate = s.checkinTime ? getLocalDateStr(new Date(s.checkinTime)) : s.date;
      const isToday =
        s.date === todayLocal ||
        s.date === todayUtc ||
        shiftLocalDate === todayLocal;

      if (isToday) return true;

      // Also keep shift active if checked in within the last 16 hours (e.g. early morning or cross-midnight shift)
      if (s.checkinTime) {
        const checkinMs = new Date(s.checkinTime).getTime();
        if (!isNaN(checkinMs) && nowMs - checkinMs >= 0 && nowMs - checkinMs <= 16 * 3600 * 1000) {
          return true;
        }
      }
      return false;
    });

    if (active) {
      return active;
    }

    // Fallback: Reconstruct active shift from today's Laporan Kiriman Kru ('presensi_shift') if local shift storage was cleared
    try {
      const reports = driverReportService.getReports();
      const matchingReport = reports.find(r => {
        if (r.category !== 'presensi_shift') return false;
        const hasCheckedOut = Boolean(
          r.checkoutTimeFormatted &&
          r.checkoutTimeFormatted.trim() !== '' &&
          r.checkoutTimeFormatted.trim() !== '-'
        );
        if (hasCheckedOut) return false;
        const rDate = r.date || (r.timestamp ? getLocalDateStr(new Date(r.timestamp)) : '');
        if (rDate !== todayLocal && rDate !== todayUtc) return false;
        return isSameDriverIdentity(r.driverId, r.driverName, driverId, driverName);
      });

      if (matchingReport) {
        const recoveredShift: DriverShiftCheckin = {
          id: matchingReport.shiftId || `SHIFT-REC-${matchingReport.id}`,
          driverId: driverId || matchingReport.driverId,
          driverName: driverName || matchingReport.driverName,
          plateNumber: matchingReport.plateNumber || '-',
          vehicleType: '-',
          date: todayLocal,
          checkinTime: matchingReport.timestamp || new Date().toISOString(),
          checkinTimeFormatted: matchingReport.checkinTimeFormatted || '07:00 WIB',
          verificationMethod: 'pin',
          locationName: 'DC PT. Anugrah Kemasan Kreatif - Sukowidi Banyuwangi',
          latitude: matchingReport.latitude || -8.1906,
          longitude: matchingReport.longitude || 114.3708,
          status: 'checked_in',
          shiftName: 'Shift Operasional Harian',
          odometerStartKm: 0,
          notes: matchingReport.notes || 'Presensi masuk resmi via PIN Keamanan',
          synced: true,
          createdAt: matchingReport.timestamp || new Date().toISOString()
        };
        const updatedShifts = [recoveredShift, ...shifts.filter(s => s.id !== recoveredShift.id)];
        this.persistShifts(updatedShifts);
        return recoveredShift;
      }
    } catch {}

    return null;
  }

  /**
   * Check if driver already configured a custom PIN
   */
  public hasCustomPin(driverId: string, driverName?: string): boolean {
    const pin = this.getPin(driverId, driverName);
    return Boolean(pin && pin.trim().length === 4);
  }

  /**
   * Get current PIN for driver (returns empty string if not configured yet)
   */
  public getPin(driverId: string, driverName?: string): string {
    try {
      const pins = this.readPinsMap();
      const candidates = this.resolvePinCandidateKeys(driverId, driverName);
      for (const key of candidates) {
        if (pins[key] && /^\d{4}$/.test(pins[key].trim())) {
          return pins[key].trim();
        }
      }
      return '';
    } catch {
      return '';
    }
  }

  /**
   * Verify driver PIN
   */
  public verifyPin(driverId: string, inputPin: string, driverName?: string): boolean {
    try {
      const expectedPin = this.getPin(driverId, driverName);
      // Jika pengguna baru belum pernah mengatur PIN, izinkan PIN 4 digit yang dikonfirmasi 2x dan simpan sebagai PIN mereka
      if (!expectedPin) {
        return /^\d{4}$/.test(inputPin.trim());
      }
      return inputPin.trim() === expectedPin.trim();
    } catch {
      return false;
    }
  }

  /**
   * Set or update custom PIN for a driver and record to Laporan Kiriman Kru
   */
  public setPin(
    driverId: string,
    newPin: string,
    meta?: {
      driverName?: string;
      userRole?: string;
      plateNumber?: string;
      areaName?: string;
    }
  ): boolean {
    try {
      const cleanPin = newPin.trim();
      if (!/^\d{4}$/.test(cleanPin)) return false;
      const pins = this.readPinsMap();
      const candidateKeys = this.resolvePinCandidateKeys(driverId, meta?.driverName);
      candidateKeys.forEach(k => {
        pins[k] = cleanPin;
      });
      this.writePinsMap(pins);

      const currentUser = logisticsStore.getCurrentUser();
      const roleLabel = meta?.userRole || (currentUser?.role ? getUserRoleDisplayTitle(currentUser.role) : 'Driver');

      driverReportService.recordPinChangeReport({
        driverId,
        driverName: meta?.driverName || currentUser?.fullName || 'Kru Pengemudi',
        userRole: roleLabel,
        plateNumber: meta?.plateNumber || '-',
        areaName: meta?.areaName || 'Otentikasi Keamanan Kru DC',
        newPin: '****'
      });

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check in driver with 2x PIN verification and log entry timestamp to Laporan Kiriman Kru
   */
  public async checkInDriver(params: {
    driverId: string;
    driverName: string;
    userRole?: string;
    fleetId?: string;
    plateNumber?: string;
    vehicleType?: string;
    areaName?: string;
    verificationMethod: ShiftVerificationMethod;
    pin?: string;
    shiftName?: string;
    odometerStartKm?: number;
    notes?: string;
  }): Promise<{ success: boolean; shift?: DriverShiftCheckin; message: string }> {
    const cleanPin = (params.pin || '').trim();
    if (!cleanPin || cleanPin.length !== 4) {
      return {
        success: false,
        message: 'Masukkan 4 digit PIN keamanan yang valid.'
      };
    }

    const hadPinBefore = this.hasCustomPin(params.driverId, params.driverName);
    if (!this.verifyPin(params.driverId, cleanPin, params.driverName)) {
      return {
        success: false,
        message: 'PIN keamanan tidak sesuai dengan PIN terdaftar akun Anda. Silakan gunakan menu Ubah PIN jika lupa.'
      };
    }

    // Jika pengguna baru belum memiliki PIN, simpan PIN yang baru diverifikasi 2x tersebut untuk semua alias ID/nama kru
    if (!hadPinBefore) {
      try {
        const pins = this.readPinsMap();
        const candidateKeys = this.resolvePinCandidateKeys(params.driverId, params.driverName);
        candidateKeys.forEach(k => {
          pins[k] = cleanPin;
        });
        this.writePinsMap(pins);
      } catch {}
    }

    // Jika sudah ada shift aktif hari ini untuk kru yang sama, perbarui dan kembalikan shift aktif tersebut agar tidak duplikat
    const existingActive = this.getActiveShift(params.driverId, params.driverName);
    if (existingActive) {
      const updatedExisting: DriverShiftCheckin = {
        ...existingActive,
        driverId: params.driverId || existingActive.driverId,
        driverName: params.driverName || existingActive.driverName,
        fleetId: params.fleetId || existingActive.fleetId,
        plateNumber: params.plateNumber || existingActive.plateNumber || '-',
        vehicleType: params.vehicleType || existingActive.vehicleType || '-'
      };
      const allShifts = this.getShifts().map(s => (s.id === updatedExisting.id ? updatedExisting : s));
      this.persistShifts(allShifts);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('driver-shift-updated', { detail: updatedExisting }));
      }
      return {
        success: true,
        shift: updatedExisting,
        message: `Presensi masuk aktif! Shift dimulai pukul ${updatedExisting.checkinTimeFormatted}.`
      };
    }

    const now = new Date();
    const dateStr = getLocalDateStr(now);
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const timeFormatted = `${hours}:${minutes} WIB`;

    const currentUser = logisticsStore.getCurrentUser();
    const roleLabel = params.userRole || (currentUser?.role ? getUserRoleDisplayTitle(currentUser.role) : 'Driver');

    const newShift: DriverShiftCheckin = {
      id: `SHIFT-${Date.now()}-${Math.floor(Math.random() * 899 + 100)}`,
      driverId: params.driverId,
      driverName: params.driverName,
      fleetId: params.fleetId,
      plateNumber: params.plateNumber || '-',
      vehicleType: params.vehicleType || '-',
      date: dateStr,
      checkinTime: now.toISOString(),
      checkinTimeFormatted: timeFormatted,
      verificationMethod: 'pin',
      locationName: 'DC PT. Anugrah Kemasan Kreatif - Sukowidi Banyuwangi',
      latitude: -8.1906,
      longitude: 114.3708,
      status: 'checked_in',
      shiftName: params.shiftName || 'Shift Operasional Harian',
      odometerStartKm: 0,
      notes: params.notes || 'Presensi masuk resmi via PIN Keamanan (2x Verifikasi)',
      synced: false,
      createdAt: now.toISOString()
    };

    // Persist to Local Storage & Session Storage
    const shifts = this.getShifts();
    shifts.unshift(newShift);
    this.persistShifts(shifts);

    // Catat langsung ke Sub-Menu Laporan Kiriman Kru
    driverReportService.upsertShiftCheckinCheckoutReport({
      shiftId: newShift.id,
      driverId: params.driverId,
      driverName: params.driverName,
      userRole: roleLabel,
      plateNumber: newShift.plateNumber || '-',
      areaName: params.areaName || 'Presensi Masuk Shift DC',
      checkinTimeFormatted: timeFormatted,
      securityPin: '****'
    });

    // Persist attendance to Hostinger MySQL
    try {
      const response = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          crewId: params.driverId,
          date: dateStr,
          status: 'present',
          reason: `Shift Check-in (PIN 2x) ${timeFormatted}`
        })
      });
      if (response.ok) {
        newShift.synced = true;
        this.persistShifts(shifts);
      }
    } catch (err) {
      console.warn('Hostinger attendance sync error (saved locally):', err);
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('driver-shift-updated', { detail: newShift }));
    }

    return {
      success: true,
      shift: newShift,
      message: `Presensi masuk berhasil! Shift dimulai pukul ${timeFormatted}.`
    };
  }

  /**
   * Check out driver / end shift and merge with Check-In report in Laporan Kiriman Kru
   */
  public async checkOutDriver(
    driverId: string,
    notes?: string,
    meta?: {
      driverName?: string;
      userRole?: string;
      plateNumber?: string;
      areaName?: string;
    }
  ): Promise<{ success: boolean; message: string }> {
    const shifts = this.getShifts();
    const active = shifts.find(
      s => s.status !== 'checked_out' && isSameDriverIdentity(s.driverId, s.driverName, driverId, meta?.driverName)
    );

    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const checkoutFormatted = `${hours}:${minutes} WIB`;

    const currentUser = logisticsStore.getCurrentUser();
    const roleLabel = meta?.userRole || (currentUser?.role ? getUserRoleDisplayTitle(currentUser.role) : 'Driver');

    if (!active) {
      driverReportService.upsertShiftCheckinCheckoutReport({
        shiftId: `SHIFT-${Date.now()}`,
        driverId,
        driverName: meta?.driverName || currentUser?.fullName || 'Kru Pengemudi',
        userRole: roleLabel,
        plateNumber: meta?.plateNumber || '-',
        areaName: meta?.areaName || 'Presensi Shift Operasional DC',
        checkinTimeFormatted: '-',
        checkoutTimeFormatted: checkoutFormatted,
        securityPin: '****'
      });
      return {
        success: true,
        message: `Shift selesai pada pukul ${checkoutFormatted} dan tergabung di Laporan Kiriman Kru.`
      };
    }

    // Tandai seluruh shift aktif milik kru yang sama hari ini sebagai checked_out agar tidak tersisa shift menggantung
    shifts.forEach(s => {
      if (s.status !== 'checked_out' && isSameDriverIdentity(s.driverId, s.driverName, driverId, meta?.driverName)) {
        s.status = 'checked_out';
        s.checkoutTime = now.toISOString();
        s.checkoutTimeFormatted = checkoutFormatted;
        if (notes) {
          s.notes = (s.notes ? s.notes + ' | ' : '') + `Checkout: ${notes}`;
        }
      }
    });

    this.persistShifts(shifts);

    // Gabungkan Check-Out dengan Check-In pada Laporan Kiriman Kru
    driverReportService.upsertShiftCheckinCheckoutReport({
      shiftId: active.id,
      driverId: active.driverId,
      driverName: meta?.driverName || active.driverName,
      userRole: roleLabel,
      plateNumber: meta?.plateNumber || active.plateNumber || '-',
      areaName: meta?.areaName || 'Presensi Shift Operasional DC',
      checkinTimeFormatted: active.checkinTimeFormatted,
      checkoutTimeFormatted: checkoutFormatted,
      securityPin: '****'
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('driver-shift-updated', { detail: active }));
    }

    return {
      success: true,
      message: `Shift selesai pada pukul ${active.checkoutTimeFormatted}. Data Check-In & Check-Out telah digabungkan di Laporan Kiriman Kru!`
    };
  }

  public deleteShift(shiftOrReportId: string, driverName?: string, dateStr?: string): boolean {
    const cleanId = String(shiftOrReportId || '').trim();
    if (!cleanId) return false;
    try {
      const shifts = this.getShifts();
      const filtered = shifts.filter(s => {
        if (s.id === cleanId) return false;
        if (driverName && dateStr && s.driverName.toLowerCase() === driverName.toLowerCase() && s.date === dateStr) {
          return false;
        }
        return true;
      });
      this.persistShifts(filtered);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('driver-shift-updated'));
      }
      return true;
    } catch {
      return false;
    }
  }
}

export const driverShiftService = new DriverShiftService();
