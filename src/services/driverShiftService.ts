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
      if (Array.isArray(data?.shifts)) {
        const mergedMap = new Map<string, DriverShiftCheckin>();
        for (const s of [...data.shifts, ...(this.memoryShifts || [])]) {
          if (s && s.id && !mergedMap.has(String(s.id))) {
            mergedMap.set(String(s.id), s);
          }
        }
        this.memoryShifts = Array.from(mergedMap.values()).slice(0, 150);
      }
      if (data?.pins && typeof data.pins === 'object') {
        this.memoryPins = { ...(this.memoryPins || {}), ...data.pins };
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('driver-shift-updated'));
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
          checkinRole: 'helper'
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
    const cleanH1Name = resolvedCheckinRole === 'driver' ? (params.helper1Name || '').trim() : '';
    const cleanH1Id = cleanH1Name ? (params.helper1Id || `hlp1-${cleanH1Name.toLowerCase().replace(/\s+/g, '-')}`) : undefined;
    const cleanH2Name = resolvedCheckinRole === 'driver' ? (params.helper2Name || '').trim() : '';
    const cleanH2Id = cleanH2Name ? (params.helper2Id || `hlp2-${cleanH2Name.toLowerCase().replace(/\s+/g, '-')}`) : undefined;

    const buildLinkedHelperShifts = (
      primaryShift: DriverShiftCheckin,
      existingList: DriverShiftCheckin[]
    ): DriverShiftCheckin[] => {
      const cleanedList = existingList.filter(
        s => !s.id.startsWith(`SHIFT-LINK-${primaryShift.id}`)
      );
      const linked: DriverShiftCheckin[] = [];
      const crewSummary = [
        `Driver: ${primaryShift.driverName}`,
        cleanH1Name ? `H1: ${cleanH1Name}` : '',
        cleanH2Name ? `H2: ${cleanH2Name}` : ''
      ].filter(Boolean).join(' · ');

      if (cleanH1Name) {
        linked.push({
          ...primaryShift,
          id: `SHIFT-LINK-${primaryShift.id}-H1`,
          driverId: cleanH1Id || `hlp1-${Date.now()}`,
          driverName: cleanH1Name,
          checkinRole: 'helper',
          helper1Id: cleanH1Id,
          helper1Name: cleanH1Name,
          helper2Id: cleanH2Id,
          helper2Name: cleanH2Name || undefined,
          notes: `Terhubung Otomatis Check-In Driver (${crewSummary})`
        });
      }
      if (cleanH2Name && !isSameDriverIdentity(cleanH1Id, cleanH1Name, cleanH2Id, cleanH2Name)) {
        linked.push({
          ...primaryShift,
          id: `SHIFT-LINK-${primaryShift.id}-H2`,
          driverId: cleanH2Id || `hlp2-${Date.now()}`,
          driverName: cleanH2Name,
          checkinRole: 'helper',
          helper1Id: cleanH1Id,
          helper1Name: cleanH1Name || undefined,
          helper2Id: cleanH2Id,
          helper2Name: cleanH2Name,
          notes: `Terhubung Otomatis Check-In Driver (${crewSummary})`
        });
      }
      return [...cleanedList.filter(s => s.id !== primaryShift.id), primaryShift, ...linked]
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    };

    // Jika sudah ada shift aktif hari ini untuk kru yang sama, perbarui Peran, Area, Armada & Kru Helper sesuai pilihan check-in terbaru
    const existingActive = this.getActiveShift(params.driverId, params.driverName);
    if (existingActive && isSameDriverIdentity(existingActive.driverId, existingActive.driverName, params.driverId, params.driverName)) {
      const updatedExisting: DriverShiftCheckin = {
        ...existingActive,
        driverId: params.driverId || existingActive.driverId,
        driverName: params.driverName || existingActive.driverName,
        checkinRole: resolvedCheckinRole,
        selectedArea: chosenArea || existingActive.selectedArea,
        fleetId: params.fleetId || existingActive.fleetId,
        fleetInitialCode: params.fleetInitialCode || existingActive.fleetInitialCode,
        plateNumber: params.plateNumber || existingActive.plateNumber || '-',
        vehicleType: params.vehicleType || existingActive.vehicleType || '-',
        helper1Id: cleanH1Id || (resolvedCheckinRole === 'driver' ? undefined : existingActive.helper1Id),
        helper1Name: cleanH1Name || (resolvedCheckinRole === 'driver' ? undefined : existingActive.helper1Name),
        helper2Id: cleanH2Id || (resolvedCheckinRole === 'driver' ? undefined : existingActive.helper2Id),
        helper2Name: cleanH2Name || (resolvedCheckinRole === 'driver' ? undefined : existingActive.helper2Name),
        locationName: chosenArea || existingActive.locationName,
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
        areaName: chosenArea || updatedExisting.locationName || 'Presensi Masuk Shift DC',
        checkinTimeFormatted: updatedExisting.checkinTimeFormatted,
        securityPin: '****'
      });

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('driver-shift-updated', { detail: updatedExisting }));
      }
      return {
        success: true,
        shift: updatedExisting,
        message: `Check-In ${roleLabel} diperbarui! Area: ${chosenArea || '-'} • Armada: ${updatedExisting.plateNumber}.`
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
      selectedArea: chosenArea || undefined,
      fleetId: params.fleetId,
      fleetInitialCode: params.fleetInitialCode,
      plateNumber: params.plateNumber || '-',
      vehicleType: params.vehicleType || '-',
      helper1Id: cleanH1Id,
      helper1Name: cleanH1Name || undefined,
      helper2Id: cleanH2Id,
      helper2Name: cleanH2Name || undefined,
      date: dateStr,
      checkinTime: now.toISOString(),
      checkinTimeFormatted: timeFormatted,
      verificationMethod: 'pin',
      locationName: chosenArea || 'DC PT. Anugrah Kemasan Kreatif - Sukowidi Banyuwangi',
      latitude: -8.1906,
      longitude: 114.3708,
      status: 'checked_in',
      shiftName: params.shiftName || 'Shift Operasional Harian',
      odometerStartKm: 0,
      notes: params.notes || `Check-In sebagai ${roleLabel} • Area: ${chosenArea || '-'} • Armada: ${params.plateNumber || '-'}${cleanH1Name ? ` • Helper 1: ${cleanH1Name}` : ''}${cleanH2Name ? ` • Helper 2: ${cleanH2Name}` : ''}`,
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
      areaName: chosenArea || 'Presensi Masuk Shift DC',
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
          reason: `Check-in ${roleLabel} • ${chosenArea || 'DC'} • ${newShift.plateNumber} (${timeFormatted})`
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
      message: `Check-In ${roleLabel} berhasil pukul ${timeFormatted}! Area: ${chosenArea || '-'} • Armada: ${newShift.plateNumber}.`
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
