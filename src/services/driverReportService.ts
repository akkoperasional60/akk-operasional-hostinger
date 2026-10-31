export interface DriverHelperReport {
  id: string;
  timestamp: string;
  date?: string; // YYYY-MM-DD
  driverId: string;
  driverName: string;
  userRole?: string;
  helperName?: string;
  plateNumber: string;
  category: 'kendala_jalan' | 'akhir_kiriman' | 'istirahat' | 'update_lokasi' | 'presensi_shift' | 'pin_keamanan' | 'mode_offline' | 'isi_bbm';
  areaName: string;
  deliveryId?: string;
  notes: string;
  photoUrl?: string | null;
  photoUrls?: string[];
  latitude?: number;
  longitude?: number;
  gmapsUrl?: string;
  status: 'pending' | 'verified' | 'follow_up' | 'resolved';
  verifiedBy?: string;
  verifiedAt?: string;
  // Data Pengisian BBM (Solar) di Farly / Gajah Mada
  fuelLocation?: 'Farly' | 'Gajah Mada' | string;
  fuelLiters?: string;
  // Data Presensi Check-In & Check-Out Terpadu + PIN Keamanan
  shiftId?: string;
  checkinTimeFormatted?: string;
  checkoutTimeFormatted?: string;
  securityPin?: string;
  // Data Peringatan Aktivasi Mode Offline Kru Pengiriman
  offlineStatus?: 'masih_offline' | 'sudah_online';
  offlineActivatedAt?: string;
  onlineRestoredAt?: string;
  // Data Kendala Mengantri di Customer (Mulai Antri -> Selang Beberapa Menit Keluar dari Customer)
  customerQueueStatus?: 'sedang_mengantri' | 'selesai_antri';
  customerQueueStartIso?: string;
  customerQueueStartFormatted?: string;
  customerQueueExitFormatted?: string;
  customerQueueDurationMinutes?: number;
  customerOutletName?: string;
  // Solusi & Arahan dari SPV Logistik / Super Admin
  solution?: string;
  solutionBy?: string;
  solutionAt?: string;
  driverAcknowledged?: boolean;
  driverAcknowledgedAt?: string;
}

const STORAGE_KEY = 'akk_driver_helper_reports_v2';

export const getLocalDateStr = (input?: string | Date): string => {
  if (!input) {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }
  if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.trim())) {
    return input.trim();
  }
  const d = input instanceof Date ? input : new Date(input);
  if (isNaN(d.getTime())) {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

class DriverReportService {
  private memoryReports: DriverHelperReport[] | null = null;
  private seqCounter = 0;
  private channel: BroadcastChannel | null = null;
  private eventSource: EventSource | null = null;
  private reconnectTimer: number | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        if ('BroadcastChannel' in window) {
          this.channel = new BroadcastChannel('akk_driver_reports_realtime');
          this.channel.onmessage = (evt) => {
            const msg = evt.data;
            if (!msg) return;
            if (Array.isArray(msg.reports)) {
              this.mergeIncomingReports(msg.reports, false);
            } else if (msg.report && msg.report.id) {
              this.mergeIncomingReports([msg.report], false);
            }
          };
        }
      } catch {}

      window.addEventListener('storage', (evt) => {
        if (evt.key === STORAGE_KEY && evt.newValue) {
          try {
            const parsed = JSON.parse(evt.newValue);
            if (Array.isArray(parsed)) {
              this.mergeIncomingReports(parsed, false);
            }
          } catch {}
        }
      });
    }
  }

  private ensureServerRealtimeSync() {
    if (typeof window === 'undefined' || !('EventSource' in window)) return;
    if (this.eventSource && this.eventSource.readyState !== EventSource.CLOSED) return;

    try {
      const es = new EventSource('/api/driver-reports/stream');
      this.eventSource = es;

      es.onmessage = (evt) => {
        try {
          const data = JSON.parse(evt.data);
          if (
            data.type === 'report_upserted' ||
            data.type === 'solution_updated' ||
            data.type === 'solution_acknowledged'
          ) {
            if (data.payload && data.payload.id) {
              this.mergeIncomingReports([data.payload], false);
            }
          } else if (data.type === 'reports_synced') {
            this.syncWithServer().catch(() => {});
          }
        } catch {}
      };

      es.onerror = () => {
        try {
          es.close();
        } catch {}
        if (this.eventSource === es) this.eventSource = null;

        // Re-check the authenticated API first. If the session has expired,
        // syncWithServer() returns without reopening SSE, avoiding a reconnect loop on the login page.
        if (this.reconnectTimer !== null) {
          window.clearTimeout(this.reconnectTimer);
        }
        this.reconnectTimer = window.setTimeout(() => {
          this.reconnectTimer = null;
          this.syncWithServer().catch(() => {});
        }, 4000);
      };
    } catch {}
  }

  public async syncWithServer(): Promise<void> {
    if (typeof window === 'undefined' || typeof fetch === 'undefined') return;
    try {
      const res = await fetch('/api/driver-reports', { credentials: 'include' });
      if (!res.ok) return;
      this.ensureServerRealtimeSync();
      const json = await res.json();
      if (Array.isArray(json.reports) && json.reports.length > 0) {
        this.mergeIncomingReports(json.reports, false);
      }
      const localList = this.getReports();
      if (localList.length > 0 && (!Array.isArray(json.reports) || json.reports.length < localList.length)) {
        await fetch('/api/driver-reports', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ reports: localList.slice(0, 60) })
        });
      }
    } catch {}
  }

  private pushReportToServer(report: DriverHelperReport) {
    if (typeof window === 'undefined' || typeof fetch === 'undefined') return;
    fetch('/api/driver-reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ report })
    }).catch(() => {});
  }

  private normalizeList(parsed: DriverHelperReport[]): DriverHelperReport[] {
    const seenIds = new Set<string>();
    return parsed.map((r, index) => {
      let uniqueId = r.id || `REP-2026-${1000 + index}`;
      if (seenIds.has(uniqueId)) {
        uniqueId = `${uniqueId}-${index + 1}`;
      }
      seenIds.add(uniqueId);
      const hasSol = Boolean(r.solution && r.solution.trim());
      const isConstraintCategory = r.category === 'kendala_jalan' || r.category === 'mode_offline';
      const resolvedStatus =
        hasSol && r.status === 'pending'
          ? 'resolved'
          : !isConstraintCategory && r.status === 'pending'
          ? 'verified'
          : r.status;
      const photoUrls = Array.isArray(r.photoUrls) && r.photoUrls.length > 0
        ? r.photoUrls
        : r.photoUrl
        ? [r.photoUrl]
        : [];
      return {
        ...r,
        id: uniqueId,
        photoUrl: r.photoUrl || photoUrls[0] || null,
        photoUrls,
        status: resolvedStatus,
        date: r.timestamp ? getLocalDateStr(new Date(r.timestamp)) : (r.date || getLocalDateStr())
      };
    });
  }

  private mergeIncomingReports(incoming: DriverHelperReport[], broadcastToPeers: boolean = false) {
    const current = this.getStoredReports();
    const map = new Map<string, DriverHelperReport>();
    for (const r of current) {
      map.set(r.id, r);
    }
    let changedReport: DriverHelperReport | null = null;
    for (const inc of incoming) {
      if (!inc || !inc.id) continue;
      const existing = map.get(inc.id);
      if (!existing) {
        map.set(inc.id, inc);
        changedReport = inc;
      } else {
        const incHasSol = Boolean(inc.solution && inc.solution.trim());
        const exHasSol = Boolean(existing.solution && existing.solution.trim());
        const merged: DriverHelperReport = {
          ...existing,
          ...inc,
          solution: incHasSol ? inc.solution : existing.solution,
          solutionBy: incHasSol ? inc.solutionBy : existing.solutionBy,
          solutionAt: incHasSol ? inc.solutionAt : existing.solutionAt,
          status: incHasSol ? (inc.status === 'pending' ? 'resolved' : inc.status) : (exHasSol ? existing.status : inc.status),
          photoUrl: inc.photoUrl || existing.photoUrl,
          photoUrls: (Array.isArray(inc.photoUrls) && inc.photoUrls.length > 0) ? inc.photoUrls : existing.photoUrls
        };
        map.set(inc.id, merged);
        changedReport = merged;
      }
    }
    const mergedList = this.normalizeList(
      Array.from(map.values()).sort(
        (a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime()
      )
    );
    this.persistListInternal(mergedList, broadcastToPeers);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('driver-report-updated', { detail: changedReport || mergedList[0] }));
    }
  }

  private getStoredReports(): DriverHelperReport[] {
    let storedList: DriverHelperReport[] = [];
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      try {
        const data = localStorage.getItem(STORAGE_KEY);
        if (data) {
          const parsed: DriverHelperReport[] = JSON.parse(data);
          if (Array.isArray(parsed)) {
            storedList = this.normalizeList(parsed);
          }
        }
      } catch (e) {
        console.warn('Failed to read from localStorage:', e);
      }
    }

    if (this.memoryReports && this.memoryReports.length > 0) {
      if (storedList.length === 0) return this.memoryReports;
      // Merge memoryReports and storedList so neither in-memory nor localStorage changes are ever lost
      const map = new Map<string, DriverHelperReport>();
      for (const r of storedList) map.set(r.id, r);
      for (const m of this.memoryReports) {
        const ex = map.get(m.id);
        if (!ex) {
          map.set(m.id, m);
        } else {
          const mHasSol = Boolean(m.solution && m.solution.trim());
          const exHasSol = Boolean(ex.solution && ex.solution.trim());
          map.set(m.id, {
            ...ex,
            ...m,
            solution: mHasSol ? m.solution : ex.solution,
            solutionBy: mHasSol ? m.solutionBy : ex.solutionBy,
            solutionAt: mHasSol ? m.solutionAt : ex.solutionAt,
            status: mHasSol ? m.status : (exHasSol ? ex.status : m.status)
          });
        }
      }
      this.memoryReports = this.normalizeList(
        Array.from(map.values()).sort(
          (a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime()
        )
      );
      return this.memoryReports;
    }

    this.memoryReports = storedList;
    return this.memoryReports;
  }

  private persistListInternal(list: DriverHelperReport[], broadcastToPeers: boolean = true): void {
    const normalized = this.normalizeList(list);
    this.memoryReports = normalized;
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
      } catch {
        // QuotaExceededError fallback: keep photos on the 15 most recent reports and strip oversized base64 from older reports
        try {
          const compact = normalized.map((r, idx) => {
            if (idx < 15) {
              // Keep up to 3 photos on recent reports
              const trimmedPhotos = Array.isArray(r.photoUrls) ? r.photoUrls.slice(0, 3) : undefined;
              return { ...r, photoUrls: trimmedPhotos };
            }
            return { ...r, photoUrl: null, photoUrls: [] };
          });
          localStorage.setItem(STORAGE_KEY, JSON.stringify(compact));
        } catch {
          // Final fallback: keep latest 30 reports metadata + latest 3 photos
          try {
            const ultraCompact = normalized.slice(0, 30).map((r, idx) =>
              idx < 3 ? r : { ...r, photoUrl: null, photoUrls: [] }
            );
            localStorage.setItem(STORAGE_KEY, JSON.stringify(ultraCompact));
          } catch {}
        }
      }
    }

    if (broadcastToPeers && this.channel) {
      try {
        this.channel.postMessage({ reports: normalized.slice(0, 30) });
      } catch {}
    }
  }

  private saveReports(list: DriverHelperReport[]): void {
    this.persistListInternal(list, true);
  }

  public getReports(): DriverHelperReport[] {
    return this.getStoredReports();
  }

  public addReport(
    report: Omit<DriverHelperReport, 'id' | 'timestamp' | 'status'> & { status?: 'pending' | 'verified' | 'follow_up' | 'resolved' }
  ): DriverHelperReport {
    const list = [...this.getReports()];
    const now = new Date();
    this.seqCounter += 1;
    let uniqueId = `REP-${now.getFullYear()}-${Date.now().toString().slice(-4)}${Math.floor(10 + Math.random() * 90)}`;
    while (list.some(r => r.id === uniqueId)) {
      uniqueId = `REP-${now.getFullYear()}-${Date.now().toString().slice(-4)}${Math.floor(10 + Math.random() * 90)}-${this.seqCounter}`;
    }
    const isConstraintCategory = report.category === 'kendala_jalan' || report.category === 'mode_offline';
    const defaultStatus = isConstraintCategory ? 'pending' : 'verified';
    const photoUrls = Array.isArray(report.photoUrls) && report.photoUrls.length > 0
      ? report.photoUrls
      : report.photoUrl
      ? [report.photoUrl]
      : [];
    const newReport: DriverHelperReport = {
      ...report,
      id: uniqueId,
      photoUrl: report.photoUrl || photoUrls[0] || null,
      photoUrls,
      timestamp: now.toISOString(),
      date: getLocalDateStr(now),
      status: report.status || defaultStatus
    };
    list.unshift(newReport);
    this.saveReports(list);
    this.pushReportToServer(newReport);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('driver-report-updated', { detail: newReport }));
    }
    return newReport;
  }

  /**
   * Mencatat Check-In atau menggabungkan Check-Out ke dalam satu laporan terpadu di Laporan Kiriman Kru
   */
  public upsertShiftCheckinCheckoutReport(params: {
    shiftId: string;
    driverId: string;
    driverName: string;
    userRole?: string;
    plateNumber: string;
    areaName?: string;
    checkinTimeFormatted: string;
    checkoutTimeFormatted?: string;
    securityPin?: string;
  }): DriverHelperReport {
    const list = this.getReports();
    const today = getLocalDateStr();

    // Cari laporan presensi aktif untuk shiftId atau driverId pada hari ini
    const existingIdx = list.findIndex(
      r =>
        r.category === 'presensi_shift' &&
        (r.shiftId === params.shiftId || (r.driverId === params.driverId && r.date === today && !r.checkoutTimeFormatted))
    );

    if (existingIdx >= 0) {
      const existing = list[existingIdx];
      const mergedCheckout = params.checkoutTimeFormatted || existing.checkoutTimeFormatted;
      const mergedPin = '****';
      const updatedNotes = mergedCheckout
        ? `[PRESENSI SHIFT TERPADU] Check-In: ${existing.checkinTimeFormatted || params.checkinTimeFormatted} | Check-Out: ${mergedCheckout} | PIN Keamanan: Terverifikasi`
        : `[PRESENSI CHECK-IN] Waktu Masuk: ${params.checkinTimeFormatted} (Status: Sedang Bertugas) | PIN Keamanan: Terverifikasi`;

      list[existingIdx] = {
        ...existing,
        driverName: params.driverName || existing.driverName,
        userRole: params.userRole || existing.userRole,
        plateNumber: params.plateNumber || existing.plateNumber,
        areaName: params.areaName || existing.areaName,
        checkoutTimeFormatted: mergedCheckout,
        securityPin: mergedPin,
        notes: updatedNotes,
        status: 'verified',
        verifiedBy: 'Sistem Presensi Terpadu',
        verifiedAt: new Date().toISOString(),
        timestamp: new Date().toISOString()
      };

      this.saveReports(list);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('driver-report-updated', { detail: list[existingIdx] }));
      }
      return list[existingIdx];
    }

    const pinStr = '****';
    const initialNotes = params.checkoutTimeFormatted
      ? `[PRESENSI SHIFT TERPADU] Check-In: ${params.checkinTimeFormatted} | Check-Out: ${params.checkoutTimeFormatted} | PIN Keamanan: Terverifikasi`
      : `[PRESENSI CHECK-IN] Waktu Masuk: ${params.checkinTimeFormatted} (Status: Sedang Bertugas) | PIN Keamanan: Terverifikasi`;

    return this.addReport({
      driverId: params.driverId,
      driverName: params.driverName,
      userRole: params.userRole || 'Driver',
      plateNumber: params.plateNumber || '-',
      category: 'presensi_shift',
      areaName: params.areaName || 'Presensi Operasional DC',
      notes: initialNotes,
      shiftId: params.shiftId,
      checkinTimeFormatted: params.checkinTimeFormatted,
      checkoutTimeFormatted: params.checkoutTimeFormatted,
      securityPin: pinStr,
      status: 'verified',
      verifiedBy: 'Sistem Presensi Terpadu'
    });
  }

  /**
   * Mencatat perubahan / pembuatan PIN Keamanan baru (2x verifikasi) ke dalam Laporan Kiriman Kru
   */
  public recordPinChangeReport(params: {
    driverId: string;
    driverName: string;
    userRole?: string;
    plateNumber: string;
    areaName?: string;
    newPin: string;
  }): DriverHelperReport {
    const list = this.getReports();
    const today = getLocalDateStr();

    // Update juga securityPin pada laporan presensi hari ini jika sudah ada
    const activeShiftIdx = list.findIndex(
      r => r.category === 'presensi_shift' && r.driverId === params.driverId && r.date === today
    );
    if (activeShiftIdx >= 0) {
      list[activeShiftIdx].securityPin = '****';
      this.saveReports(list);
    }

    return this.addReport({
      driverId: params.driverId,
      driverName: params.driverName,
      userRole: params.userRole || 'Driver',
      plateNumber: params.plateNumber || '-',
      category: 'pin_keamanan',
      areaName: params.areaName || 'Keamanan Akun Kru DC',
      securityPin: '****',
      notes: `[DATA PIN KEAMANAN KRU] Pengguna memperbarui / mengaktifkan PIN Keamanan (Verifikasi 2x).`,
      status: 'verified',
      verifiedBy: 'Otentikasi PIN 2x Verifikasi'
    });
  }

  public updateReportSolution(
    id: string,
    solution: string,
    solutionBy: string = 'SPV Logistik DC',
    newStatus: 'verified' | 'follow_up' | 'pending' | 'resolved' = 'resolved'
  ): boolean {
    const list = [...this.getReports()];
    const idx = list.findIndex(r => r.id === id);
    if (idx >= 0) {
      list[idx] = {
        ...list[idx],
        solution,
        solutionBy,
        solutionAt: new Date().toISOString(),
        status: newStatus === 'pending' ? 'resolved' : newStatus,
        driverAcknowledged: false
      };
      this.saveReports(list);

      if (typeof window !== 'undefined' && typeof fetch !== 'undefined') {
        fetch(`/api/driver-reports/${encodeURIComponent(id)}/solution`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            solution,
            solutionBy,
            status: list[idx].status,
            reportSnapshot: list[idx]
          })
        }).catch(() => {});
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('driver-report-updated', { detail: list[idx] }));
      }
      return true;
    }
    return false;
  }

  public acknowledgeReportSolution(id: string): boolean {
    const list = [...this.getReports()];
    const idx = list.findIndex(r => r.id === id);
    if (idx >= 0) {
      list[idx] = {
        ...list[idx],
        driverAcknowledged: true,
        driverAcknowledgedAt: new Date().toISOString()
      };
      this.saveReports(list);

      if (typeof window !== 'undefined' && typeof fetch !== 'undefined') {
        fetch(`/api/driver-reports/${encodeURIComponent(id)}/acknowledge`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include'
        }).catch(() => {});
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('driver-report-updated', { detail: list[idx] }));
      }
      return true;
    }
    return false;
  }

  public updateReportStatus(
    id: string,
    status: 'verified' | 'follow_up' | 'pending' | 'resolved',
    verifiedBy: string = 'SPV Logistik'
  ): boolean {
    const list = [...this.getReports()];
    const idx = list.findIndex(r => r.id === id);
    if (idx >= 0) {
      list[idx] = {
        ...list[idx],
        status,
        verifiedBy,
        verifiedAt: new Date().toISOString()
      };
      this.saveReports(list);
      this.pushReportToServer(list[idx]);

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('driver-report-updated', { detail: list[idx] }));
      }
      return true;
    }
    return false;
  }

  public deleteReport(id: string): boolean {
    const list = this.getReports();
    const filtered = list.filter(r => r.id !== id);
    this.saveReports(filtered);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('driver-report-updated'));
    }
    return true;
  }

  /**
   * Mencatat siapa saja kru yang mengaktifkan Mode Offline sebagai peringatan bagi Tim Pengiriman
   * agar segera di-online-kan kembali.
   */
  public recordOfflineModeActivation(params: {
    driverId: string;
    driverName: string;
    userRole?: string;
    helperName?: string;
    plateNumber: string;
    areaName?: string;
    modeType?: 'simulasi' | 'jaringan';
  }): DriverHelperReport {
    const list = this.getReports();
    const today = getLocalDateStr();
    const now = new Date();
    const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';

    const existingIdx = list.findIndex(
      r =>
        r.category === 'mode_offline' &&
        r.date === today &&
        r.offlineStatus === 'masih_offline' &&
        (r.driverId === params.driverId || r.driverName.toLowerCase() === params.driverName.toLowerCase())
    );

    const warningNote = `[PERINGATAN MODE OFFLINE AKTIF] ${params.driverName} (${params.userRole || 'Driver'}${params.helperName ? ` • Helper: ${params.helperName}` : ''}) mengaktifkan Mode Offline pada pukul ${timeStr}. PERINGATAN TIM PENGIRIMAN: Harap segera di-online-kan kembali agar sinkronisasi data & GPS berjalan real-time!`;

    if (existingIdx >= 0) {
      list[existingIdx] = {
        ...list[existingIdx],
        driverName: params.driverName || list[existingIdx].driverName,
        userRole: params.userRole || list[existingIdx].userRole,
        helperName: params.helperName || list[existingIdx].helperName,
        plateNumber: params.plateNumber || list[existingIdx].plateNumber,
        areaName: params.areaName || list[existingIdx].areaName,
        offlineStatus: 'masih_offline',
        offlineActivatedAt: list[existingIdx].offlineActivatedAt || timeStr,
        onlineRestoredAt: undefined,
        notes: warningNote,
        status: 'pending',
        timestamp: now.toISOString()
      };
      this.saveReports(list);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('driver-report-updated', { detail: list[existingIdx] }));
      }
      return list[existingIdx];
    }

    return this.addReport({
      driverId: params.driverId,
      driverName: params.driverName,
      userRole: params.userRole || 'Driver',
      helperName: params.helperName,
      plateNumber: params.plateNumber || '-',
      category: 'mode_offline',
      areaName: params.areaName || 'Rute Pengiriman Aktif',
      offlineStatus: 'masih_offline',
      offlineActivatedAt: timeStr,
      notes: warningNote,
      status: 'pending'
    });
  }

  /**
   * Menandai bahwa kru yang sebelumnya mengaktifkan Mode Offline sudah kembali Online
   */
  public markOfflineModeRestored(params: {
    reportId?: string;
    driverId?: string;
    driverName?: string;
    restoredBy?: string;
  }): DriverHelperReport | null {
    const list = this.getReports();
    const now = new Date();
    const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
    let updatedReport: DriverHelperReport | null = null;

    list.forEach((r, idx) => {
      if (r.category !== 'mode_offline') return;
      const matchById = params.reportId && r.id === params.reportId;
      const matchByDriver =
        !params.reportId &&
        r.offlineStatus === 'masih_offline' &&
        ((params.driverId && r.driverId === params.driverId) ||
          (params.driverName && r.driverName.toLowerCase() === params.driverName.toLowerCase()));

      if (matchById || matchByDriver) {
        const cleanBaseNote = r.notes.replace(/\s*\|\s*\[SUDAH ONLINE KEMBALI.*?\]/g, '');
        list[idx] = {
          ...r,
          offlineStatus: 'sudah_online',
          onlineRestoredAt: timeStr,
          status: 'verified',
          verifiedBy: params.restoredBy || 'Tim Pengiriman (Online Kembali)',
          verifiedAt: now.toISOString(),
          notes: `${cleanBaseNote} | [SUDAH ONLINE KEMBALI pukul ${timeStr} oleh ${params.restoredBy || r.driverName}]`,
          solution:
            r.solution && r.solution.trim()
              ? r.solution
              : `Mode Offline telah dimatikan dan perangkat kembali Online pada pukul ${timeStr}.`,
          solutionBy: r.solutionBy || params.restoredBy || 'Sistem Monitoring Online',
          solutionAt: r.solutionAt || now.toISOString(),
          driverAcknowledged: true,
          driverAcknowledgedAt: now.toISOString()
        };
        updatedReport = list[idx];
      }
    });

    if (updatedReport) {
      this.saveReports(list);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('driver-report-updated', { detail: updatedReport }));
        window.dispatchEvent(new CustomEvent('akk-force-online-mode'));
      }
    }
    return updatedReport;
  }

  /**
   * Mencatat ketika kru mengalami kendala sedang mengantri di customer,
   * lalu beberapa menit kemudian baru keluar dari customer tersebut.
   */
  public startCustomerQueueReport(params: {
    driverId: string;
    driverName: string;
    userRole?: string;
    helperName?: string;
    plateNumber: string;
    areaName: string;
    customerOutletName?: string;
    deliveryId?: string;
    notes?: string;
    photoUrl?: string | null;
    latitude?: number;
    longitude?: number;
    gmapsUrl?: string;
  }): DriverHelperReport {
    const list = this.getReports();
    const today = getLocalDateStr();
    const now = new Date();
    const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
    const outlet = params.customerOutletName || params.areaName || 'Customer / Toko Tujuan';

    const existingIdx = list.findIndex(
      r =>
        r.category === 'kendala_jalan' &&
        r.date === today &&
        r.customerQueueStatus === 'sedang_mengantri' &&
        (r.driverId === params.driverId || r.driverName.toLowerCase() === params.driverName.toLowerCase())
    );

    const queueNote = params.notes?.trim()
      ? `[ANTRI DI CUSTOMER: ${outlet}] Mulai Mengantri: ${timeStr} (Status: Sedang Mengantri di Customer) — ${params.notes.trim()}`
      : `[ANTRI DI CUSTOMER: ${outlet}] Mulai Mengantri: ${timeStr} (Status: Sedang Mengantri Bongkar/Muat di Customer, menunggu keluar dari customer).`;

    if (existingIdx >= 0) {
      list[existingIdx] = {
        ...list[existingIdx],
        areaName: params.areaName || list[existingIdx].areaName,
        customerOutletName: outlet,
        customerQueueStatus: 'sedang_mengantri',
        customerQueueStartIso: list[existingIdx].customerQueueStartIso || now.toISOString(),
        customerQueueStartFormatted: list[existingIdx].customerQueueStartFormatted || timeStr,
        photoUrl: params.photoUrl || list[existingIdx].photoUrl,
        notes: queueNote,
        timestamp: now.toISOString()
      };
      this.saveReports(list);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('driver-report-updated', { detail: list[existingIdx] }));
      }
      return list[existingIdx];
    }

    return this.addReport({
      driverId: params.driverId,
      driverName: params.driverName,
      userRole: params.userRole || 'Driver',
      helperName: params.helperName,
      plateNumber: params.plateNumber,
      category: 'kendala_jalan',
      areaName: params.areaName,
      deliveryId: params.deliveryId,
      customerOutletName: outlet,
      customerQueueStatus: 'sedang_mengantri',
      customerQueueStartIso: now.toISOString(),
      customerQueueStartFormatted: timeStr,
      notes: queueNote,
      photoUrl: params.photoUrl,
      latitude: params.latitude,
      longitude: params.longitude,
      gmapsUrl: params.gmapsUrl,
      status: 'pending'
    });
  }

  /**
   * Menyelesaikan antrean ketika kru sudah keluar dari customer setelah selang beberapa menit
   */
  public completeCustomerQueueExit(params: {
    reportId?: string;
    driverId?: string;
    driverName?: string;
    simulatedExtraMinutes?: number;
    exitNotes?: string;
  }): DriverHelperReport | null {
    const list = this.getReports();
    const now = new Date();
    let targetIdx = -1;

    if (params.reportId) {
      targetIdx = list.findIndex(r => r.id === params.reportId);
    }
    if (targetIdx < 0) {
      targetIdx = list.findIndex(
        r =>
          r.customerQueueStatus === 'sedang_mengantri' &&
          ((params.driverId && r.driverId === params.driverId) ||
            (params.driverName && r.driverName.toLowerCase() === params.driverName.toLowerCase()))
      );
    }

    if (targetIdx < 0) return null;

    const existing = list[targetIdx];
    const startMs = existing.customerQueueStartIso ? new Date(existing.customerQueueStartIso).getTime() : new Date(existing.timestamp).getTime();
    const extraMs = (params.simulatedExtraMinutes || 0) * 60000;
    const effectiveExitDate = new Date(Math.max(now.getTime(), startMs + 60000) + extraMs);
    const durationMin = Math.max(1, Math.round((effectiveExitDate.getTime() - startMs) / 60000));

    const startFormatted =
      existing.customerQueueStartFormatted ||
      new Date(startMs).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
    const exitFormatted =
      effectiveExitDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
    const outlet = existing.customerOutletName || existing.areaName || 'Customer';

    const extraNoteText = params.exitNotes?.trim() ? ` | Catatan Keluar: ${params.exitNotes.trim()}` : '';
    const updatedNotes = `[SELESAI ANTRI & KELUAR DARI CUSTOMER: ${outlet}] Mulai Antri: ${startFormatted} ➔ Keluar dari Customer: ${exitFormatted} (Selang Waktu Mengantri: ${durationMin} Menit)${extraNoteText}`;

    list[targetIdx] = {
      ...existing,
      customerQueueStatus: 'selesai_antri',
      customerQueueStartFormatted: startFormatted,
      customerQueueExitFormatted: exitFormatted,
      customerQueueDurationMinutes: durationMin,
      notes: updatedNotes,
      status: existing.solution && existing.solution.trim() ? 'resolved' : 'verified',
      verifiedBy: existing.verifiedBy || 'Konfirmasi Keluar Customer (Kru)',
      verifiedAt: now.toISOString()
    };

    this.saveReports(list);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('driver-report-updated', { detail: list[targetIdx] }));
    }
    return list[targetIdx];
  }

  public submitReport(params: {
    driverId: string;
    driverName: string;
    driverPhone?: string;
    plateNumber: string;
    category: 'kendala_jalan' | 'akhir_kiriman' | 'istirahat' | 'update_lokasi' | 'presensi_shift' | 'pin_keamanan' | 'mode_offline' | 'isi_bbm';
    reportText?: string;
    notes?: string;
    latitude?: number;
    longitude?: number;
    locationName?: string;
    areaName?: string;
    helperName?: string;
    photoUrl?: string;
    fuelLocation?: 'Farly' | 'Gajah Mada' | string;
    fuelLiters?: string;
  }): DriverHelperReport {
    return this.addReport({
      driverId: params.driverId,
      driverName: params.driverName,
      helperName: params.helperName,
      plateNumber: params.plateNumber,
      category: params.category,
      areaName: params.areaName || params.locationName || 'Lokasi Kendala Lapangan',
      notes: params.notes || params.reportText || '',
      latitude: params.latitude,
      longitude: params.longitude,
      photoUrl: params.photoUrl
    });
  }

  public resolveReport(
    id: string,
    solution: string,
    solutionBy: string = 'SPV Logistik DC'
  ): DriverHelperReport | null {
    const success = this.updateReportSolution(id, solution, solutionBy, 'resolved');
    if (success) {
      return this.getReports().find(r => r.id === id) || null;
    }
    return null;
  }
}

export const driverReportService = new DriverReportService();
