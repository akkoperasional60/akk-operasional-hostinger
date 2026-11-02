import { DriverShiftCheckin, ShiftVerificationMethod } from '../types';
import { driverReportService } from './driverReportService';
import { logisticsStore } from './store';
import { getUserRoleDisplayTitle } from '../utils/rbac';

const SHIFTS_STORAGE_KEY = 'akk_driver_shifts_v2';
const PINS_STORAGE_KEY = 'akk_driver_pins_v2';

class DriverShiftService {
  /**
   * Get all recorded shifts from storage
   */
  public getShifts(): DriverShiftCheckin[] {
    try {
      const raw = localStorage.getItem(SHIFTS_STORAGE_KEY);
      if (!raw) {
        return [];
      }
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  /**
   * Get active shift for specific driver today (status !== 'checked_out')
   */
  public getActiveShift(driverId: string): DriverShiftCheckin | null {
    const today = new Date().toISOString().split('T')[0];
    const shifts = this.getShifts();
    
    const active = shifts.find(
      s => s.driverId === driverId && s.date === today && s.status !== 'checked_out'
    );

    return active || null;
  }

  /**
   * Check if driver already configured a custom PIN
   */
  public hasCustomPin(driverId: string): boolean {
    try {
      const rawPins = localStorage.getItem(PINS_STORAGE_KEY);
      const pins: Record<string, string> = rawPins ? JSON.parse(rawPins) : {};
      return Boolean(pins[driverId] && pins[driverId].trim().length === 4);
    } catch {
      return false;
    }
  }

  /**
   * Get current PIN for driver (returns empty string if not configured yet)
   */
  public getPin(driverId: string): string {
    try {
      const rawPins = localStorage.getItem(PINS_STORAGE_KEY);
      const pins: Record<string, string> = rawPins ? JSON.parse(rawPins) : {};
      return pins[driverId] || '';
    } catch {
      return '';
    }
  }

  /**
   * Verify driver PIN
   */
  public verifyPin(driverId: string, inputPin: string): boolean {
    try {
      const rawPins = localStorage.getItem(PINS_STORAGE_KEY);
      const pins: Record<string, string> = rawPins ? JSON.parse(rawPins) : {};
      const expectedPin = pins[driverId];
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
      const rawPins = localStorage.getItem(PINS_STORAGE_KEY);
      const pins: Record<string, string> = rawPins ? JSON.parse(rawPins) : {};
      pins[driverId] = cleanPin;
      localStorage.setItem(PINS_STORAGE_KEY, JSON.stringify(pins));

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

    const hadPinBefore = this.hasCustomPin(params.driverId);
    if (!this.verifyPin(params.driverId, cleanPin)) {
      return {
        success: false,
        message: 'PIN keamanan tidak sesuai dengan PIN terdaftar akun Anda. Silakan gunakan menu Ubah PIN jika lupa.'
      };
    }

    // Jika pengguna baru belum memiliki PIN, simpan PIN yang baru diverifikasi 2x tersebut
    if (!hadPinBefore) {
      try {
        const rawPins = localStorage.getItem(PINS_STORAGE_KEY);
        const pins: Record<string, string> = rawPins ? JSON.parse(rawPins) : {};
        pins[params.driverId] = cleanPin;
        localStorage.setItem(PINS_STORAGE_KEY, JSON.stringify(pins));
      } catch {}
    }

    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
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

    // Persist to Local Storage
    const shifts = this.getShifts();
    shifts.unshift(newShift);
    localStorage.setItem(SHIFTS_STORAGE_KEY, JSON.stringify(shifts));

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
        localStorage.setItem(SHIFTS_STORAGE_KEY, JSON.stringify(shifts));
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
    const active = shifts.find(s => s.driverId === driverId && s.status !== 'checked_out');

    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const checkoutFormatted = `${hours}:${minutes} WIB`;

    const currentUser = logisticsStore.getCurrentUser();
    const roleLabel = meta?.userRole || (currentUser?.role ? getUserRoleDisplayTitle(currentUser.role) : 'Driver');
    const currentPin = this.getPin(driverId);

    if (!active) {
      // Tetap rekam gabungan ke Laporan Kiriman Kru meskipun sesi sebelumnya di-refresh
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

    active.status = 'checked_out';
    active.checkoutTime = now.toISOString();
    active.checkoutTimeFormatted = checkoutFormatted;
    if (notes) {
      active.notes = (active.notes ? active.notes + ' | ' : '') + `Checkout: ${notes}`;
    }

    localStorage.setItem(SHIFTS_STORAGE_KEY, JSON.stringify(shifts));

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
}

export const driverShiftService = new DriverShiftService();
