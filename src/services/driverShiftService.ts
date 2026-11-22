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

function normalizeCompactName(rawName?: string): string {
  return String(rawName || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
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

  if (sNameNorm && tNameNorm && (sNameNorm === tNameNorm || normalizeCompactName(shiftDriverName) === normalizeCompactName(targetDriverName))) {
    return true;
  }

  // Match if targetDriverId belongs to the logged-in user and shift matches logged-in user's crew/name
  const targetMatchesCurrentUser =
    (tIdNorm && (tIdNorm === currentUserIdNorm || tIdNorm === activeCrewIdNorm)) ||
    (tNameNorm && (tNameNorm === currentUserNameNorm || tNameNorm === activeCrewNameNorm));

  if (targetMatchesCurrentUser) {
    if (sIdNorm && (sIdNorm === currentUserIdNorm || sIdNorm === activeCrewIdNorm)) return true;
    if (
      sNameNorm &&
      (sNameNorm === currentUserNameNorm ||
        sNameNorm === activeCrewNameNorm ||
        normalizeCompactName(sNameNorm) === normalizeCompactName(currentUserNameNorm) ||
        normalizeCompactName(sNameNorm) === normalizeCompactName(activeCrewNameNorm))
    ) {
      return true;
    }
  }

  return false;
}

class DriverShiftService {
  private memoryShifts: DriverShiftCheckin[] | null = null;
  private memoryPins: Record<string, string> | null = null;
  private isSyncing = false;

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        const legacyShifts = localStorage.getItem(SHIFTS_STORAGE_KEY);
        if (legacyShifts) {
          const parsed = JSON.parse(legacyShifts);
          if (Array.isArray(parsed)) {
            this.memoryShifts = parsed;
          }
          localStorage.removeItem(SHIFTS_STORAGE_KEY);
        }
        const legacyPins = localStorage.getItem(PINS_STORAGE_KEY);
        if (legacyPins) {
          const parsedPins = JSON.parse(legacyPins);
          if (parsedPins && typeof parsedPins === 'object') {
            this.memoryPins = parsedPins;
          }
          localStorage.removeItem(PINS_STORAGE_KEY);
        }
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.removeItem(SHIFTS_STORAGE_KEY);
          sessionStorage.removeItem(PINS_STORAGE_KEY);
        }
      } catch {}
      void this.syncFromServer();
    }
  }

  private getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    try {
      const token =
        localStorage.getItem('akk_session_token') ||
        localStorage.getItem('session_token') ||
        sessionStorage.getItem('akk_session_token') ||
        '';
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
        headers['x-akk-session-token'] = token;
      }
    } catch {}
    return headers;
  }

  public async syncFromServer(): Promise<void> {
    if (typeof window === 'undefined' || typeof fetch === 'undefined' || this.isSyncing) return;
    this.isSyncing = true;
    try {
      const res = await fetch('/api/driver-shifts', {
        credentials: 'include',
        headers: this.getAuthHeaders()
      });
      if (!res.ok) return;
      const data = await res.json();
      const prevSig = JSON.stringify(
        (this.memoryShifts || []).map(
          s => `${s.id}:${s.status}:${s.checkinRole}:${s.driverName}:${s.pairedDriverName || ''}:${s.helper1Name || ''}:${s.helper2Name || ''}:${s.selectedArea || ''}:${s.plateNumber || ''}:${s.checklistCompletedAt || ''}:${s.gateOutAt || ''}:${s.arrivedAtWarehouseAt || ''}`
        )
      );
      if (Array.isArray(data?.shifts)) {
        const mergedMap = new Map<string, DriverShiftCheckin>();
        for (const s of [...data.shifts, ...(this.memoryShifts || [])]) {
          if (s && s.id && !mergedMap.has(String(s.id))) {
            mergedMap.set(String(s.id), s);
          }
        }
        this.memoryShifts = Array.from(mergedMap.values())
          .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
          .slice(0, 150);
      }
      if (data?.pins && typeof data.pins === 'object') {
        this.memoryPins = { ...(this.memoryPins || {}), ...data.pins };
      }
      const nextSig = JSON.stringify(
        (this.memoryShifts || []).map(
          s => `${s.id}:${s.status}:${s.checkinRole}:${s.driverName}:${s.pairedDriverName || ''}:${s.helper1Name || ''}:${s.helper2Name || ''}:${s.selectedArea || ''}:${s.plateNumber || ''}:${s.checklistCompletedAt || ''}:${s.gateOutAt || ''}:${s.arrivedAtWarehouseAt || ''}`
        )
      );
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('driver-shift-updated', { detail: { changed: prevSig !== nextSig } }));
      }
    } catch {} finally {
      this.isSyncing = false;
    }
  }

  private async persistShiftsToServer(shifts: DriverShiftCheckin[]): Promise<boolean> {
    const trimmed = shifts.slice(0, 150);
    this.memoryShifts = trimmed;
    if (typeof window !== 'undefined' && typeof fetch !== 'undefined') {
      try {
        const res = await fetch('/api/driver-shifts', {
          method: 'POST',
          credentials: 'include',
          headers: this.getAuthHeaders(),
          body: JSON.stringify({ shifts: trimmed })
        });
        return res.ok;
      } catch {
        return false;
      }
    }
    return false;
  }

  private persistShifts(shifts: DriverShiftCheckin[]): void {
    void this.persistShiftsToServer(shifts);
  }

  private readPinsMap(): Record<string, string> {
    if (this.memoryPins !== null) {
      return this.memoryPins;
    }
    this.memoryPins = {};
    return this.memoryPins;
  }

  private writePinsMap(pins: Record<string, string>): void {
    this.memoryPins = { ...pins };
    if (typeof window !== 'undefined' && typeof fetch !== 'undefined') {
      fetch('/api/driver-shifts', {
        method: 'POST',
        credentials: 'include',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ pins: this.memoryPins })
      }).catch(() => {});
    }
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
   * Get all recorded shifts from memory synced with MySQL
   */
  public getShifts(): DriverShiftCheckin[] {
    if (this.memoryShifts !== null) {
      return [...this.memoryShifts];
    }
    this.memoryShifts = [];
    return [];
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
      const isPrimary = isSameDriverIdentity(s.driverId, s.driverName, driverId, driverName);
      const isHelper1 = Boolean(s.helper1Id || s.helper1Name) && isSameDriverIdentity(s.helper1Id, s.helper1Name, driverId, driverName);
      const isHelper2 = Boolean(s.helper2Id || s.helper2Name) && isSameDriverIdentity(s.helper2Id, s.helper2Name, driverId, driverName);
      if (!isPrimary && !isHelper1 && !isHelper2) return false;

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
      const isPrimary = isSameDriverIdentity(active.driverId, active.driverName, driverId, driverName);
      if (!isPrimary) {
        return {
          ...active,
          checkinRole: 'helper',
          pairedDriverId: active.pairedDriverId || active.driverId,
          pairedDriverName: active.pairedDriverName || active.driverName
        };
      }
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
          checkinRole: matchingReport.userRole?.toLowerCase().includes('helper') ? 'helper' : 'driver',
          selectedArea: matchingReport.areaName && !matchingReport.areaName.toLowerCase().includes('presensi')
            ? matchingReport.areaName
            : undefined,
          plateNumber: matchingReport.plateNumber || '-',
          vehicleType: '-',
          date: todayLocal,
          checkinTime: matchingReport.timestamp || new Date().toISOString(),
          checkinTimeFormatted: matchingReport.checkinTimeFormatted || '07:00 WIB',
          verificationMethod: 'pin',
          locationName: matchingReport.areaName || 'DC PT. Anugrah Kemasan Kreatif - Sukowidi Banyuwangi',
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

  public async updateShiftProgress(
    shiftId: string,
    patch: Partial<Pick<DriverShiftCheckin, 'checklistCompletedAt' | 'securityValidatedAt' | 'securityValidatedBy' | 'gateOutAt' | 'arrivedAtWarehouseAt' | 'selectedArea' | 'checkinRole' | 'fleetId' | 'fleetInitialCode' | 'plateNumber' | 'vehicleType' | 'helper1Id' | 'helper1Name' | 'helper2Id' | 'helper2Name'>>
  ): Promise<DriverShiftCheckin | null> {
    const shifts = this.getShifts();
    const idx = shifts.findIndex(s => s.id === shiftId);
    if (idx < 0) return null;
    const baseShift = shifts[idx];
    const updated: DriverShiftCheckin = {
      ...baseShift,
      ...patch,
      synced: true
    };
    const nextShifts = shifts.map((s, i) => {
      if (i === idx) return updated;
      // Propagate security validation / gate-out / area / fleet updates ke shift partner pada shift utama yang sama
      if (
        s.status !== 'checked_out' &&
        s.date === baseShift.date &&
        (s.id.startsWith(`SHIFT-LINK-${baseShift.id}`) || baseShift.id.startsWith(`SHIFT-LINK-${s.id}`))
      ) {
        return {
          ...s,
          ...(patch.securityValidatedAt ? { securityValidatedAt: patch.securityValidatedAt } : {}),
          ...(patch.securityValidatedBy ? { securityValidatedBy: patch.securityValidatedBy } : {}),
          ...(patch.gateOutAt ? { gateOutAt: patch.gateOutAt } : {}),
          ...(patch.checklistCompletedAt ? { checklistCompletedAt: patch.checklistCompletedAt } : {}),
          synced: true
        };
      }
      return s;
    });
    await this.persistShiftsToServer(nextShifts);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('driver-shift-updated', { detail: updated }));
    }
    return updated;
  }

  public findActivePartnerDriverShift(params: {
    date?: string;
    fleetId?: string;
    plateNumber?: string;
    selectedArea?: string;
    helperId?: string;
    helperName?: string;
  }): DriverShiftCheckin | null {
    const todayLocal = params.date || getLocalDateStr();
    const todayUtc = new Date().toISOString().split('T')[0];
    const normPlate = (v?: string) => String(v || '').replace(/\s+/g, '').toLowerCase();
    const normArea = (v?: string) => String(v || '').trim().toLowerCase().replace(/\s+/g, ' ');
    const targetPlate = normPlate(params.plateNumber);
    const targetArea = normArea(params.selectedArea);

    const activeDrivers = this.getShifts().filter(s => {
      if (!s || s.status === 'checked_out') return false;
      if (s.checkinRole === 'helper') return false;
      const shiftLocalDate = s.checkinTime ? getLocalDateStr(new Date(s.checkinTime)) : s.date;
      return s.date === todayLocal || s.date === todayUtc || shiftLocalDate === todayLocal;
    });

    if (activeDrivers.length === 0) return null;

    // 1. Cocok langsung berdasarkan nama/ID Helper yang didaftarkan oleh Driver
    if (params.helperName || params.helperId) {
      const explicitMatch = activeDrivers.find(
        s =>
          (Boolean(s.helper1Name || s.helper1Id) &&
            isSameDriverIdentity(s.helper1Id, s.helper1Name, params.helperId, params.helperName)) ||
          (Boolean(s.helper2Name || s.helper2Id) &&
            isSameDriverIdentity(s.helper2Id, s.helper2Name, params.helperId, params.helperName))
      );
      if (explicitMatch) {
        const sPlate = normPlate(explicitMatch.plateNumber);
        const plateConflict = Boolean(targetPlate && targetPlate !== '-' && sPlate && sPlate !== '-' && targetPlate !== sPlate);
        if (!plateConflict) return explicitMatch;
      }
    }

    // 2. Cocok berdasarkan armada (fleetId / plat nomor yang sama)
    const fleetMatch = activeDrivers.find(s => {
      if (params.fleetId && s.fleetId && params.fleetId === s.fleetId) return true;
      const sPlate = normPlate(s.plateNumber);
      return Boolean(targetPlate && targetPlate !== '-' && sPlate && sPlate !== '-' && sPlate === targetPlate);
    });
    if (fleetMatch) return fleetMatch;

    // 3. Cocok berdasarkan area yang sama apabila plat nomor tidak bertentangan
    if (targetArea) {
      const areaMatch = activeDrivers.find(s => {
        if (normArea(s.selectedArea) !== targetArea) return false;
        const sPlate = normPlate(s.plateNumber);
        return !targetPlate || targetPlate === '-' || !sPlate || sPlate === '-' || targetPlate === sPlate;
      });
      if (areaMatch) return areaMatch;
    }

    return null;
  }

  /**
   * Check in driver/helper with Role, Area, Armada & optional Helper 1 / Helper 2 selection + PIN verification and log entry to Hostinger MySQL & Laporan Kiriman Kru
   */
  public async checkInDriver(params: {
    driverId: string;
    driverName: string;
    userRole?: string;
    checkinRole?: 'driver' | 'helper';
    fleetId?: string;
    fleetInitialCode?: string;
    plateNumber?: string;
    vehicleType?: string;
    areaName?: string;
    helper1Id?: string;
    helper1Name?: string;
    helper2Id?: string;
    helper2Name?: string;
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

    // Pastikan data shift lintas perangkat tersinkron dari server sebelum verifikasi & penautan tim
    try {
      await this.syncFromServer();
    } catch {}

    const hadPinBefore = this.hasCustomPin(params.driverId, params.driverName);
    if (!this.verifyPin(params.driverId, cleanPin, params.driverName)) {
      return {
        success: false,
        message: 'PIN keamanan tidak sesuai dengan PIN terdaftar akun Anda. Silakan gunakan menu Ubah PIN jika lupa.'
      };
    }

    // Jika pengguna baru belum memiliki PIN, simpan PIN yang baru diverifikasi tersebut untuk semua alias ID/nama kru
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

    const currentUser = logisticsStore.getCurrentUser();
    const resolvedCheckinRole: 'driver' | 'helper' =
      params.checkinRole ||
      (String(params.userRole || currentUser?.role || '').toLowerCase().includes('helper') ? 'helper' : 'driver');
    const roleLabel =
      resolvedCheckinRole === 'helper'
        ? 'Helper'
        : params.userRole || (currentUser?.role ? getUserRoleDisplayTitle(currentUser.role) : 'Driver');
    const chosenArea = (params.areaName || '').trim();

    const matchedPartnerDriver =
      resolvedCheckinRole === 'helper'
        ? this.findActivePartnerDriverShift({
            fleetId: params.fleetId,
            plateNumber: params.plateNumber,
            selectedArea: chosenArea,
            helperId: params.driverId,
            helperName: params.driverName
          })
        : null;

    const effectiveArea = chosenArea || matchedPartnerDriver?.selectedArea || '';
    const effectiveFleetId = params.fleetId || matchedPartnerDriver?.fleetId;
    const effectiveInitialCode = params.fleetInitialCode || matchedPartnerDriver?.fleetInitialCode;
    const effectivePlate = (params.plateNumber && params.plateNumber !== '-' ? params.plateNumber : matchedPartnerDriver?.plateNumber) || '-';
    const effectiveVehicleType = (params.vehicleType && params.vehicleType !== '-' ? params.vehicleType : matchedPartnerDriver?.vehicleType) || '-';

    const cleanH1Name =
      resolvedCheckinRole === 'driver'
        ? (params.helper1Name || '').trim()
        : (params.driverName || '').trim();
    const cleanH1Id = cleanH1Name
      ? (resolvedCheckinRole === 'driver'
          ? (params.helper1Id || `hlp1-${cleanH1Name.toLowerCase().replace(/\s+/g, '-')}`)
          : (params.driverId || `hlp1-${cleanH1Name.toLowerCase().replace(/\s+/g, '-')}`))
      : undefined;
    const cleanH2Name = resolvedCheckinRole === 'driver' ? (params.helper2Name || '').trim() : '';
    const cleanH2Id = cleanH2Name ? (params.helper2Id || `hlp2-${cleanH2Name.toLowerCase().replace(/\s+/g, '-')}`) : undefined;

    const normPlateVal = (v?: string) => String(v || '').replace(/\s+/g, '').toLowerCase();
    const normAreaVal = (v?: string) => String(v || '').trim().toLowerCase().replace(/\s+/g, ' ');

    const buildLinkedHelperShifts = (
      primaryShift: DriverShiftCheckin,
      existingList: DriverShiftCheckin[]
    ): DriverShiftCheckin[] => {
      if (primaryShift.checkinRole === 'helper') {
        // Apabila Driver sudah Check-In lebih dulu di armada/area yang sama, pastikan shift Driver ikut terhubung & tahu nama Helper
        const updatedList = existingList.map(s => {
          if (matchedPartnerDriver && s.id === matchedPartnerDriver.id && s.status !== 'checked_out') {
            const h1OccupiedByOther =
              Boolean(s.helper1Name) && !isSameDriverIdentity(s.helper1Id, s.helper1Name, primaryShift.driverId, primaryShift.driverName);
            return {
              ...s,
              ...(h1OccupiedByOther
                ? {
                    helper2Id: s.helper2Id || primaryShift.driverId,
                    helper2Name: s.helper2Name || primaryShift.driverName
                  }
                : {
                    helper1Id: primaryShift.driverId,
                    helper1Name: primaryShift.driverName
                  }),
              synced: true
            };
          }
          return s;
        });

        // Hapus shift link sintetik milik helper yang sama jika sudah digantikan Check-In PIN asli
        const deduped = updatedList.filter(s => {
          if (s.id === primaryShift.id) return false;
          if (
            s.id.startsWith('SHIFT-LINK-') &&
            s.status !== 'checked_out' &&
            s.date === primaryShift.date &&
            isSameDriverIdentity(s.driverId, s.driverName, primaryShift.driverId, primaryShift.driverName)
          ) {
            return false;
          }
          return true;
        });

        return [...deduped, primaryShift]
          .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
      }

      // Role DRIVER: Tautkan Helper 1 & Helper 2 yang dipilih Driver, DAN perbarui shift Helper jika Helper sudah Check-In lebih dulu
      const updatedExistingList = existingList
        .filter(s => !s.id.startsWith(`SHIFT-LINK-${primaryShift.id}`))
        .map(s => {
          if (s.id === primaryShift.id || s.status === 'checked_out' || s.checkinRole !== 'helper' || s.date !== primaryShift.date) {
            return s;
          }
          const matchesChosenHelper =
            (cleanH1Name && isSameDriverIdentity(s.driverId, s.driverName, cleanH1Id, cleanH1Name)) ||
            (cleanH2Name && isSameDriverIdentity(s.driverId, s.driverName, cleanH2Id, cleanH2Name));
          const samePlate =
            normPlateVal(primaryShift.plateNumber) !== '' &&
            normPlateVal(primaryShift.plateNumber) !== '-' &&
            normPlateVal(s.plateNumber) === normPlateVal(primaryShift.plateNumber);
          const sameFleet = Boolean(primaryShift.fleetId && s.fleetId === primaryShift.fleetId);
          const sameArea = Boolean(primaryShift.selectedArea && normAreaVal(s.selectedArea) === normAreaVal(primaryShift.selectedArea));
          if (matchesChosenHelper || samePlate || sameFleet || sameArea) {
            return {
              ...s,
              pairedDriverId: primaryShift.driverId,
              pairedDriverName: primaryShift.driverName,
              selectedArea: s.selectedArea || primaryShift.selectedArea,
              fleetId: s.fleetId || primaryShift.fleetId,
              fleetInitialCode: s.fleetInitialCode || primaryShift.fleetInitialCode,
              plateNumber: s.plateNumber && s.plateNumber !== '-' ? s.plateNumber : primaryShift.plateNumber,
              synced: true
            };
          }
          return s;
        });

      const hasStandaloneHelperShift = (hId?: string, hName?: string) =>
        Boolean(
          hName &&
            updatedExistingList.some(
              s =>
                s.status !== 'checked_out' &&
                s.checkinRole === 'helper' &&
                s.date === primaryShift.date &&
                !s.id.startsWith('SHIFT-LINK-') &&
                isSameDriverIdentity(s.driverId, s.driverName, hId, hName)
            )
        );

      const linked: DriverShiftCheckin[] = [];
      const crewSummary = [
        `Driver: ${primaryShift.driverName}`,
        cleanH1Name ? `H1: ${cleanH1Name}` : '',
        cleanH2Name ? `H2: ${cleanH2Name}` : ''
      ].filter(Boolean).join(' · ');

      if (cleanH1Name && !hasStandaloneHelperShift(cleanH1Id, cleanH1Name)) {
        linked.push({
          ...primaryShift,
          id: `SHIFT-LINK-${primaryShift.id}-H1`,
          driverId: cleanH1Id || `hlp1-${Date.now()}`,
          driverName: cleanH1Name,
          checkinRole: 'helper',
          pairedDriverId: primaryShift.driverId,
          pairedDriverName: primaryShift.driverName,
          helper1Id: cleanH1Id,
          helper1Name: cleanH1Name,
          helper2Id: cleanH2Id,
          helper2Name: cleanH2Name || undefined,
          notes: `Terhubung Otomatis Check-In Driver (${crewSummary})`
        });
      }
      if (
        cleanH2Name &&
        !isSameDriverIdentity(cleanH1Id, cleanH1Name, cleanH2Id, cleanH2Name) &&
        !hasStandaloneHelperShift(cleanH2Id, cleanH2Name)
      ) {
        linked.push({
          ...primaryShift,
          id: `SHIFT-LINK-${primaryShift.id}-H2`,
          driverId: cleanH2Id || `hlp2-${Date.now()}`,
          driverName: cleanH2Name,
          checkinRole: 'helper',
          pairedDriverId: primaryShift.driverId,
          pairedDriverName: primaryShift.driverName,
          helper1Id: cleanH1Id,
          helper1Name: cleanH1Name || undefined,
          helper2Id: cleanH2Id,
          helper2Name: cleanH2Name,
          notes: `Terhubung Otomatis Check-In Driver (${crewSummary})`
        });
      }
      return [...updatedExistingList.filter(s => s.id !== primaryShift.id), primaryShift, ...linked]
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    };

    // Jika sudah ada shift aktif hari ini untuk kru yang sama (termasuk dari partner driver), perbarui Peran, Area, Armada & Partner sesuai check-in terbaru
    const existingActive = this.getActiveShift(params.driverId, params.driverName);
    const isReplacingPartnerLinkAsHelper =
      resolvedCheckinRole === 'helper' &&
      Boolean(existingActive) &&
      !isSameDriverIdentity(existingActive?.driverId, existingActive?.driverName, params.driverId, params.driverName);

    if (
      existingActive &&
      (isSameDriverIdentity(existingActive.driverId, existingActive.driverName, params.driverId, params.driverName) ||
        isReplacingPartnerLinkAsHelper)
    ) {
      const updatedExisting: DriverShiftCheckin = {
        ...existingActive,
        id: isReplacingPartnerLinkAsHelper && existingActive.id.startsWith('SHIFT-LINK-')
          ? `SHIFT-${Date.now()}-${Math.floor(Math.random() * 899 + 100)}`
          : existingActive.id.startsWith('SHIFT-LINK-') && resolvedCheckinRole === 'helper'
          ? `SHIFT-${Date.now()}-${Math.floor(Math.random() * 899 + 100)}`
          : existingActive.id,
        driverId: params.driverId || existingActive.driverId,
        driverName: params.driverName || existingActive.driverName,
        checkinRole: resolvedCheckinRole,
        pairedDriverId:
          resolvedCheckinRole === 'helper'
            ? (matchedPartnerDriver?.driverId || existingActive.pairedDriverId || (!isSameDriverIdentity(existingActive.driverId, existingActive.driverName, params.driverId, params.driverName) ? existingActive.driverId : undefined))
            : undefined,
        pairedDriverName:
          resolvedCheckinRole === 'helper'
            ? (matchedPartnerDriver?.driverName || existingActive.pairedDriverName || (!isSameDriverIdentity(existingActive.driverId, existingActive.driverName, params.driverId, params.driverName) ? existingActive.driverName : undefined))
            : undefined,
        selectedArea: effectiveArea || existingActive.selectedArea,
        fleetId: effectiveFleetId || existingActive.fleetId,
        fleetInitialCode: effectiveInitialCode || existingActive.fleetInitialCode,
        plateNumber: effectivePlate !== '-' ? effectivePlate : existingActive.plateNumber || '-',
        vehicleType: effectiveVehicleType !== '-' ? effectiveVehicleType : existingActive.vehicleType || '-',
        helper1Id: cleanH1Id,
        helper1Name: cleanH1Name || undefined,
        helper2Id: cleanH2Id,
        helper2Name: cleanH2Name || undefined,
        checklistCompletedAt: matchedPartnerDriver?.checklistCompletedAt || existingActive.checklistCompletedAt,
        securityValidatedAt: matchedPartnerDriver?.securityValidatedAt || existingActive.securityValidatedAt,
        securityValidatedBy: matchedPartnerDriver?.securityValidatedBy || existingActive.securityValidatedBy,
        gateOutAt: matchedPartnerDriver?.gateOutAt || existingActive.gateOutAt,
        locationName: effectiveArea || existingActive.locationName,
        notes: params.notes || existingActive.notes,
        synced: true
      };
      const allShifts = buildLinkedHelperShifts(updatedExisting, this.getShifts());
      await this.persistShiftsToServer(allShifts);

      driverReportService.upsertShiftCheckinCheckoutReport({
        shiftId: updatedExisting.id,
        driverId: updatedExisting.driverId,
        driverName: updatedExisting.driverName,
        userRole: roleLabel,
        helperName: [cleanH1Name, cleanH2Name].filter(Boolean).join(', ') || undefined,
        plateNumber: updatedExisting.plateNumber || '-',
        areaName: effectiveArea || updatedExisting.locationName || 'Presensi Masuk Shift DC',
        checkinTimeFormatted: updatedExisting.checkinTimeFormatted,
        securityPin: '****'
      });

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('driver-shift-updated', { detail: updatedExisting }));
      }
      return {
        success: true,
        shift: updatedExisting,
        message: `Check-In ${roleLabel} diperbarui! Area: ${effectiveArea || '-'} • Armada: ${updatedExisting.plateNumber}.`
      };
    }

    const now = new Date();
    const dateStr = getLocalDateStr(now);
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const timeFormatted = `${hours}:${minutes} WIB`;

    const newShift: DriverShiftCheckin = {
      id: `SHIFT-${Date.now()}-${Math.floor(Math.random() * 899 + 100)}`,
      driverId: params.driverId,
      driverName: params.driverName,
      checkinRole: resolvedCheckinRole,
      pairedDriverId: resolvedCheckinRole === 'helper' ? matchedPartnerDriver?.driverId : undefined,
      pairedDriverName: resolvedCheckinRole === 'helper' ? matchedPartnerDriver?.driverName : undefined,
      selectedArea: effectiveArea || undefined,
      fleetId: effectiveFleetId,
      fleetInitialCode: effectiveInitialCode,
      plateNumber: effectivePlate,
      vehicleType: effectiveVehicleType,
      helper1Id: cleanH1Id,
      helper1Name: cleanH1Name || undefined,
      helper2Id: cleanH2Id,
      helper2Name: cleanH2Name || undefined,
      checklistCompletedAt: matchedPartnerDriver?.checklistCompletedAt,
      securityValidatedAt: matchedPartnerDriver?.securityValidatedAt,
      securityValidatedBy: matchedPartnerDriver?.securityValidatedBy,
      gateOutAt: matchedPartnerDriver?.gateOutAt,
      date: dateStr,
      checkinTime: now.toISOString(),
      checkinTimeFormatted: timeFormatted,
      verificationMethod: 'pin',
      locationName: effectiveArea || 'DC PT. Anugrah Kemasan Kreatif - Sukowidi Banyuwangi',
      latitude: -8.1906,
      longitude: 114.3708,
      status: 'checked_in',
      shiftName: params.shiftName || 'Shift Operasional Harian',
      odometerStartKm: 0,
      notes: params.notes || `Check-In sebagai ${roleLabel} • Area: ${effectiveArea || '-'} • Armada: ${effectivePlate}${cleanH1Name ? ` • Helper 1: ${cleanH1Name}` : ''}${cleanH2Name ? ` • Helper 2: ${cleanH2Name}` : ''}`,
      synced: false,
      createdAt: now.toISOString()
    };

    // Persist directly to memory & Hostinger MySQL /api/driver-shifts (including auto-linked Helper 1 & Helper 2 shifts)
    const shifts = buildLinkedHelperShifts(newShift, this.getShifts());
    const savedRemote = await this.persistShiftsToServer(shifts);
    if (savedRemote) {
      newShift.synced = true;
    }

    // Catat langsung ke Sub-Menu Laporan Kiriman Kru
    driverReportService.upsertShiftCheckinCheckoutReport({
      shiftId: newShift.id,
      driverId: params.driverId,
      driverName: params.driverName,
      userRole: roleLabel,
      helperName: [cleanH1Name, cleanH2Name].filter(Boolean).join(', ') || undefined,
      plateNumber: newShift.plateNumber || '-',
      areaName: effectiveArea || 'Presensi Masuk Shift DC',
      checkinTimeFormatted: timeFormatted,
      securityPin: '****'
    });

    // Persist attendance to Hostinger MySQL
    try {
      const response = await fetch('/api/attendance', {
        method: 'POST',
        headers: this.getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify({
          crewId: params.driverId,
          date: dateStr,
          status: 'present',
          reason: `Check-in ${roleLabel} • ${effectiveArea || 'DC'} • ${newShift.plateNumber} (${timeFormatted})`
        })
      });
      if (response.ok) {
        newShift.synced = true;
        await this.persistShiftsToServer(shifts);
      }
    } catch (err) {
      console.warn('Hostinger attendance sync error:', err);
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('driver-shift-updated', { detail: newShift }));
    }

    return {
      success: true,
      shift: newShift,
      message: `Check-In ${roleLabel} berhasil pukul ${timeFormatted}! Area: ${effectiveArea || '-'} • Armada: ${newShift.plateNumber}.`
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

    await this.persistShiftsToServer(shifts);

    // Gabungkan Check-Out dengan Check-In pada Laporan Kiriman Kru
    driverReportService.upsertShiftCheckinCheckoutReport({
      shiftId: active.id,
      driverId: active.driverId,
      driverName: meta?.driverName || active.driverName,
      userRole: roleLabel,
      helperName: [active.helper1Name, active.helper2Name].filter(Boolean).join(', ') || undefined,
      plateNumber: meta?.plateNumber || active.plateNumber || '-',
      areaName: meta?.areaName || active.selectedArea || 'Presensi Shift Operasional DC',
      checkinTimeFormatted: active.checkinTimeFormatted,
      checkoutTimeFormatted: checkoutFormatted,
      securityPin: '****'
    });
    driverReportService.closeOpenPresensiReportsForTeam({
      shiftIds: [active.id],
      crewNames: [active.driverName, active.helper1Name, active.helper2Name, meta?.driverName],
      plateNumber: meta?.plateNumber || active.plateNumber,
      areaName: meta?.areaName || active.selectedArea,
      checkoutTimeFormatted: checkoutFormatted
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('driver-shift-updated', { detail: active }));
    }

    return {
      success: true,
      message: `Shift selesai pada pukul ${active.checkoutTimeFormatted}. Data Check-In & Check-Out telah digabungkan di Laporan Kiriman Kru!`
    };
  }

  /**
   * Sinkronisasi Tiba di Gudang lintas Driver & Helper:
   * Ketika Driver ATAU Helper menekan "Tiba di Gudang", seluruh shift aktif dalam tim/armada/area
   * perjalanan yang sama hari ini ikut otomatis selesai (checked_out + arrivedAtWarehouseAt).
   */
  public async checkOutCrewTeamForTrip(params: {
    actorDriverId: string;
    actorName?: string;
    actorRole?: string;
    plateNumber?: string;
    areaName?: string;
    tripDate?: string;
    crewNames?: Array<string | undefined>;
    arrivedAtWarehouseAt?: string;
    notes?: string;
  }): Promise<{ checkedOutCount: number; matchedShiftIds: string[] }> {
    try {
      await this.syncFromServer();
    } catch {}

    const shifts = this.getShifts();
    const now = new Date();
    const arrivedIso = params.arrivedAtWarehouseAt || now.toISOString();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const checkoutFormatted = `${hours}:${minutes} WIB`;

    const normPlate = (v?: string) => String(v || '').replace(/\s+/g, '').toLowerCase();
    const normText = (v?: string) => String(v || '').trim().toLowerCase().replace(/\s+/g, ' ');
    const targetPlate = normPlate(params.plateNumber);
    const targetArea = normText(params.areaName);
    const targetDate = String(params.tripDate || '').slice(0, 10) || getLocalDateStr();
    const yesterdayDate = getLocalDateStr(new Date(Date.now() - 24 * 3600 * 1000));

    // Kumpulkan semua nama kru dalam tim (actor + driver + helper1 + helper2 + rekan di shift aktif actor)
    const teamNamesSet = new Set<string>();
    const addName = (n?: string) => {
      const clean = normText(n);
      if (clean && clean !== '-' && clean !== 'driver armada terkait') {
        teamNamesSet.add(clean);
      }
    };
    addName(params.actorName);
    (params.crewNames || []).forEach(addName);

    const actorShift = shifts.find(
      s => s.status !== 'checked_out' && isSameDriverIdentity(s.driverId, s.driverName, params.actorDriverId, params.actorName)
    );
    if (actorShift) {
      addName(actorShift.driverName);
      addName(actorShift.helper1Name);
      addName(actorShift.helper2Name);
    }

    const effectivePlate = targetPlate || normPlate(actorShift?.plateNumber);
    const effectiveArea = targetArea || normText(actorShift?.selectedArea);

    const isNameInTeam = (candidate?: string): boolean => {
      const clean = normText(candidate);
      const compact = normalizeCompactName(candidate);
      if (!clean) return false;
      for (const tn of teamNamesSet) {
        const tnCompact = normalizeCompactName(tn);
        if (
          clean === tn ||
          clean.includes(tn) ||
          tn.includes(clean) ||
          (compact && tnCompact && (compact === tnCompact || compact.includes(tnCompact) || tnCompact.includes(compact)))
        ) {
          return true;
        }
      }
      return false;
    };

    const matchedShifts: DriverShiftCheckin[] = [];
    shifts.forEach(s => {
      if (s.status === 'checked_out') return;
      const sDate = s.date ? s.date.slice(0, 10) : targetDate;
      const relevantDate = sDate === targetDate || sDate === yesterdayDate;
      const isActor = isSameDriverIdentity(s.driverId, s.driverName, params.actorDriverId, params.actorName);
      const samePlate = Boolean(effectivePlate && effectivePlate !== '-' && normPlate(s.plateNumber) === effectivePlate && relevantDate);
      const sameArea = Boolean(effectiveArea && normText(s.selectedArea) === effectiveArea && relevantDate);
      const linkedByCrewName =
        relevantDate &&
        (isNameInTeam(s.driverName) || isNameInTeam(s.helper1Name) || isNameInTeam(s.helper2Name));

      if (isActor || samePlate || (linkedByCrewName && (sameArea || samePlate || !effectiveArea)) || (sameArea && (samePlate || linkedByCrewName))) {
        s.status = 'checked_out';
        s.arrivedAtWarehouseAt = arrivedIso;
        s.checkoutTime = arrivedIso;
        s.checkoutTimeFormatted = checkoutFormatted;
        if (params.notes) {
          s.notes = (s.notes ? s.notes + ' | ' : '') + params.notes;
        }
        matchedShifts.push(s);
      }
    });

    if (matchedShifts.length > 0) {
      await this.persistShiftsToServer(shifts);
      matchedShifts.forEach(s => {
        const memberRole = s.checkinRole === 'helper' ? 'Helper' : 'Driver';
        const helperList = [s.helper1Name, s.helper2Name].filter(h => h && !isSameDriverIdentity(s.driverId, s.driverName, '', h)).join(', ');
        driverReportService.upsertShiftCheckinCheckoutReport({
          shiftId: s.id,
          driverId: s.driverId,
          driverName: s.driverName,
          userRole: memberRole,
          helperName: helperList || undefined,
          plateNumber: s.plateNumber || params.plateNumber || '-',
          areaName: s.selectedArea || params.areaName || 'Gudang Argo',
          checkinTimeFormatted: s.checkinTimeFormatted,
          checkoutTimeFormatted: checkoutFormatted,
          securityPin: '****'
        });
      });

      driverReportService.closeOpenPresensiReportsForTeam({
        shiftIds: matchedShifts.map(s => s.id),
        crewNames: Array.from(teamNamesSet),
        plateNumber: params.plateNumber || actorShift?.plateNumber,
        areaName: params.areaName || actorShift?.selectedArea,
        checkoutTimeFormatted: checkoutFormatted
      });

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('driver-shift-updated', { detail: matchedShifts[0] }));
      }
    } else {
      driverReportService.closeOpenPresensiReportsForTeam({
        crewNames: Array.from(teamNamesSet),
        plateNumber: params.plateNumber,
        areaName: params.areaName,
        checkoutTimeFormatted: checkoutFormatted
      });
    }

    return {
      checkedOutCount: matchedShifts.length,
      matchedShiftIds: matchedShifts.map(s => s.id)
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
      this.memoryShifts = filtered;
      if (typeof window !== 'undefined' && typeof fetch !== 'undefined') {
        const q = new URLSearchParams();
        if (driverName) q.set('driverName', driverName);
        if (dateStr) q.set('date', dateStr);
        fetch(`/api/driver-shifts/${encodeURIComponent(cleanId)}?${q.toString()}`, {
          method: 'DELETE',
          credentials: 'include',
          headers: this.getAuthHeaders()
        }).catch(() => {});
        window.dispatchEvent(new CustomEvent('driver-shift-updated'));
      }
      return true;
    } catch {
      return false;
    }
  }
}

export const driverShiftService = new DriverShiftService();
