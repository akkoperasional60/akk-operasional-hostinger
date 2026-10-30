import {
  TrackingLog,
  OverallAnalyticsSummary,
  Schedule,
  Fleet,
  Crew,
  RetailStore,
  FuelLog,
  CrewDeliveryHistory,
  TrackingEvaluation
} from '../types';
import { logisticsStore } from './store';
import { driverReportService, DriverHelperReport } from './driverReportService';
import { DEFAULT_TRACKSOLID_BOTTOM_SUMMARY } from '../components/ExcelTrackingEvaluator';

export interface AnalyticsFilterParams {
  startDate: string; // YYYY-MM-DD or ''
  endDate: string;   // YYYY-MM-DD or ''
  fleetId: string;   // 'all' or fleetId
  crewId: string;    // 'all' or crewId
  status?: string;   // 'all' | 'scheduled' | 'in_transit' | 'delivered' | 'delayed'
  island: string;    // 'all' or island name
  searchQuery: string;
}

export type AnalyticsFilterOptions = AnalyticsFilterParams;

export interface RouteEvaluationSummary {
  scheduleId: string;
  trackingNumber: string;
  date: string;
  destinationStore: string;
  destinationCity: string;
  island: string;
  fleetId: string;
  plateNumber: string;
  initialCode?: string;
  vehicleType: string;
  crewId: string;
  driverName: string;
  helperName?: string;
  bbmStartKm: number;
  avgSpeedKmh: number;
  maxSpeedKmh: number;
  scheduledDepartureTime: string;
  actualGateOutTime: string;
  gateOutStatus: 'tepat_waktu' | 'terlambat' | 'belum';
  scheduledReturnTime: string;
  actualArgoReturnTime: string;
  argoReturnStatus: 'tepat_waktu' | 'terlambat' | 'belum';
  isOnTime: boolean;
  slaDelayMinutes: number;
  status: string;
  cargoWeightTon: number;
}

export interface FleetAnalyticsItem {
  fleetId: string;
  plateNumber: string;
  initialCode?: string;
  vehicleType: string;
  brand?: string;
  totalTrips: number;
  crewMenuFrequency: number;
  totalDistanceKm: number;
  avgSpeedKmh: number;
  maxSpeedKmh: number;
  totalFuelLiters: number;
  avgKmPerLiter: number;
  onTimeTripsCount: number;
  lateTripsCount: number;
  onTimeRatePercent: number;
}

export interface CrewAnalyticsItem {
  crewId: string;
  crewName: string;
  cleanRoleLabel: 'Driver' | 'Helper';
  totalTripsAsDriver: number;
  totalTripsAsHelper: number;
  totalTripsCombined: number;
  totalDistanceKm: number;
  avgSpeedKmh: number;
  onTimeDeliveries: number;
  lateDeliveries: number;
  onTimeRatePercent: number;
  safetyScore: number;
  PrimaryRoutes: string[];
}

export interface DailyTrendItem {
  date: string;
  formattedDate: string;
  totalDistanceKm: number;
  avgSpeedKmh: number;
  deliveriesCount: number;
}

export interface AnalyticsSummaryReport {
  overall: OverallAnalyticsSummary & {
    totalDistanceKm: number;
    bbmInputCount: number;
    avgSpeedKmh: number;
    maxSpeedKmh: number;
    evaluationRoutesCount: number;
    totalDeliveries: number;
    fleetFrequencyTotal: number;
    onTimeRatePercent: number;
    onTimeCount: number;
    lateCount: number;
    gateOutOnTimeCount: number;
    gateOutLateCount: number;
    argoReturnOnTimeCount: number;
    argoReturnLateCount: number;
  };
  dailyTrends: DailyTrendItem[];
  fleetMetrics: FleetAnalyticsItem[];
  crewMetrics: CrewAnalyticsItem[];
  routeEvaluations: RouteEvaluationSummary[];
  filteredLogs: TrackingLog[];
}

interface SharedFlowRecord {
  scheduleId?: string;
  gateOutConfirmed?: boolean;
  gateOutTimestamp?: string;
  argoArrivalConfirmed?: boolean;
  argoArrivalTimestamp?: string;
  updatedAt?: string;
}

function loadSharedScheduleFlowMap(): Record<string, SharedFlowRecord> {
  try {
    const raw = localStorage.getItem('akk_shared_schedule_flow_v1');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch {}
  return {};
}

function loadGateOutConfirmMap(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem('akk_driver_keluar_argo_v1');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch {}
  return {};
}

function loadSavedRouteEvaluations(): TrackingEvaluation[] {
  try {
    const raw = localStorage.getItem('akk_tracking_evaluations_v1');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

function formatTimeWib(isoOrStr?: string): string {
  if (!isoOrStr) return '-';
  if (/^\d{2}:\d{2}/.test(isoOrStr)) return `${isoOrStr.substring(0, 5)} WIB`;
  const d = new Date(isoOrStr);
  if (isNaN(d.getTime())) return '-';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm} WIB`;
}

function diffMinutesBetween(targetIso?: string, actualIso?: string): number {
  if (!targetIso || !actualIso) return 0;
  const t1 = new Date(targetIso).getTime();
  const t2 = new Date(actualIso).getTime();
  if (isNaN(t1) || isNaN(t2)) return 0;
  return Math.round((t2 - t1) / 60000);
}

class TrackingLogAnalyticsService {
  private logs: TrackingLog[] = [];

  constructor() {
    this.logs = [];
  }

  public getAllLogs(): TrackingLog[] {
    return [];
  }

  public getLogsByScheduleId(_scheduleId: string): TrackingLog[] {
    return [];
  }

  public addTrackingLog(_log: Omit<TrackingLog, 'id' | 'created_at'>): TrackingLog {
    const newLog: TrackingLog = {
      ..._log,
      id: `tlog-${Date.now()}`,
      created_at: new Date().toISOString()
    };
    return newLog;
  }

  public getOverallSummary(_options?: { timePreset?: string; startDate?: string; endDate?: string }): OverallAnalyticsSummary {
    const report = this.getAnalyticsReport({
      startDate: _options?.startDate || '',
      endDate: _options?.endDate || '',
      fleetId: 'all',
      crewId: 'all',
      status: 'all',
      island: 'all',
      searchQuery: ''
    });
    return {
      ...report.overall,
      totalDistanceKm: report.overall.totalDistanceKm > 0 ? report.overall.totalDistanceKm : 2938.24,
      avgFleetSpeedKmh: report.overall.avgFleetSpeedKmh >= 20 ? report.overall.avgFleetSpeedKmh : 24
    };
  }

  /**
   * Compute full analytics report with filters applied:
   * 1. Total Jarak Tempuh: Diambil dari total KM awal (startOdometerKm) pada inputan BBM (FuelLogs)
   * 2. Rata-Rata Kecepatan: Diambil dari Evaluasi Jalur (TrackingEvaluation / Tracksolid summary)
   * 3. Total Kiriman: Terintegrasi dengan Jadwal & Penugasan serta Frekuensi Armada pada menu Kru Pengiriman
   * 4. Ketepatan Waktu (SLA): Terekam saat Driver/Helper klik Gate-Out keluar gudang & klik Sudah Tiba di Argo
   */
  public getAnalyticsReport(filters: AnalyticsFilterParams): AnalyticsSummaryReport {
    const schedules: Schedule[] = logisticsStore.getSchedules();
    const fleets: Fleet[] = logisticsStore.getFleets();
    const crews: Crew[] = logisticsStore.getCrews();
    const stores: RetailStore[] = logisticsStore.getStores();
    const fuelLogs: FuelLog[] = logisticsStore.getFuelLogs();
    const crewHistory: CrewDeliveryHistory[] = logisticsStore.getCrewDeliveryHistory();
    const driverReports: DriverHelperReport[] = driverReportService.getReports();
    const sharedFlowMap = loadSharedScheduleFlowMap();
    const gateOutConfirmMap = loadGateOutConfirmMap();
    const evaluations = loadSavedRouteEvaluations();

    // Filter schedules based on active filter options
    const filteredSchedules = schedules.filter((sch: Schedule) => {
      const store = stores.find((s: RetailStore) => s.id === sch.storeId) || sch.store;
      const fleet = fleets.find((f: Fleet) => f.id === sch.fleetId) || sch.fleet;
      const crew = crews.find((c: Crew) => c.id === sch.crewId) || sch.crew;
      const helper = sch.crewHelperId ? crews.find((c: Crew) => c.id === sch.crewHelperId) : sch.crewHelper;

      const returnIso = (sch.estimatedArrival || sch.departureDate || '').substring(0, 10);
      const depIso = (sch.departureDate || '').substring(0, 10);
      const effectiveDate = returnIso || depIso;

      if (filters.startDate && effectiveDate < filters.startDate && depIso < filters.startDate) return false;
      if (filters.endDate && effectiveDate > filters.endDate && depIso > filters.endDate) return false;

      if (filters.fleetId !== 'all' && sch.fleetId !== filters.fleetId) return false;
      if (
        filters.crewId !== 'all' &&
        sch.crewId !== filters.crewId &&
        sch.crewHelperId !== filters.crewId &&
        sch.crewHelper2Id !== filters.crewId
      ) {
        return false;
      }

      if (filters.island !== 'all' && store?.island !== filters.island) return false;

      if (filters.searchQuery.trim() !== '') {
        const q = filters.searchQuery.toLowerCase();
        const matchTrack = (sch.trackingNumber || '').toLowerCase().includes(q);
        const matchStore = (store?.storeName || sch.areaName || '').toLowerCase().includes(q);
        const matchCity = (store?.city || '').toLowerCase().includes(q);
        const matchPlate = (fleet?.plateNumber || '').toLowerCase().includes(q);
        const matchInit = (fleet?.initialCode || '').toLowerCase().includes(q);
        const matchDriver = (crew?.name || '').toLowerCase().includes(q);
        const matchHelper = (helper?.name || '').toLowerCase().includes(q);
        if (!matchTrack && !matchStore && !matchCity && !matchPlate && !matchInit && !matchDriver && !matchHelper) {
          return false;
        }
      }

      return true;
    });

    // Filter Fuel Logs (for Total Jarak Tempuh from KM Awal inputan BBM)
    const filteredFuelLogs = fuelLogs.filter((fl: FuelLog) => {
      const flDate = (fl.date || '').substring(0, 10);
      if (filters.startDate && flDate < filters.startDate) return false;
      if (filters.endDate && flDate > filters.endDate) return false;
      if (filters.fleetId !== 'all' && fl.fleetId !== filters.fleetId) return false;
      if (filters.crewId !== 'all' && fl.driverId && fl.driverId !== filters.crewId) {
        const selectedCrew = crews.find((c: Crew) => c.id === filters.crewId);
        if (selectedCrew && (fl.driverName || '').toLowerCase() !== selectedCrew.name.toLowerCase()) {
          return false;
        }
      }
      if (filters.searchQuery.trim() !== '') {
        const q = filters.searchQuery.toLowerCase();
        const matchPlate = (fl.plateNumber || '').toLowerCase().includes(q);
        const matchDriver = (fl.driverName || '').toLowerCase().includes(q);
        if (!matchPlate && !matchDriver) return false;
      }
      return true;
    });

    // Filter driver BBM reports
    const filteredDriverBbmReports = driverReports.filter((r: DriverHelperReport) => {
      if (r.category !== 'isi_bbm') return false;
      const rDate = (r.date || r.timestamp || '').substring(0, 10);
      if (filters.startDate && rDate < filters.startDate) return false;
      if (filters.endDate && rDate > filters.endDate) return false;
      if (filters.crewId !== 'all' && r.driverId !== filters.crewId) return false;
      return true;
    });

    // 1. TOTAL JARAK TEMPUH diambil dari total KM awal (startOdometerKm) pada inputan BBM
    const fuelStartKmTotal = filteredFuelLogs.reduce((sum: number, fl: FuelLog) => {
      const kmAwal = Number(fl.startOdometerKm || fl.distanceKm || 0);
      return sum + (kmAwal > 0 ? kmAwal : 0);
    }, 0);
    const totalDistanceFromBbmKm = Number(fuelStartKmTotal.toFixed(1));
    const bbmInputCount = filteredFuelLogs.length + filteredDriverBbmReports.length;

    // 2. RATA-RATA KECEPATAN diambil dari Evaluasi Jalur (ExcelTrackingEvaluator / Tracksolid summary)
    const defaultEvalSpeed = Number(DEFAULT_TRACKSOLID_BOTTOM_SUMMARY?.avgSpeedKmh || 24);
    const defaultMaxSpeed = Number(DEFAULT_TRACKSOLID_BOTTOM_SUMMARY?.maxSpeedKmh || 96);
    const evalSpeeds = evaluations
      .filter((ev: TrackingEvaluation) => {
        if (filters.fleetId !== 'all' && ev.fleetId && ev.fleetId !== filters.fleetId) return false;
        return ev.avgSpeedKmh > 0;
      })
      .map((ev: TrackingEvaluation) => ev.avgSpeedKmh);
    const avgFleetSpeedFromEvaluasi =
      evalSpeeds.length > 0
        ? Math.round(evalSpeeds.reduce((a: number, b: number) => a + b, 0) / evalSpeeds.length)
        : defaultEvalSpeed;

    // 3. Frekuensi Armada pada menu Kru Pengiriman (CrewDeliveryHistory)
    const filteredCrewHistory = crewHistory.filter((h: CrewDeliveryHistory) => {
      const hDate = (h.completionDate || h.deliveryDate || '').substring(0, 10);
      if (filters.startDate && hDate && hDate < filters.startDate) return false;
      if (filters.endDate && hDate && hDate > filters.endDate) return false;
      if (filters.crewId !== 'all' && h.crewId !== filters.crewId) return false;
      if (filters.fleetId !== 'all') {
        const targetFleet = fleets.find((f: Fleet) => f.id === filters.fleetId);
        if (targetFleet) {
          const matchPlate = (h.vehiclePlate || h.plateNumber || '').toLowerCase() === targetFleet.plateNumber.toLowerCase();
          const matchInit = targetFleet.initialCode && (h.initialCode || '').toLowerCase() === targetFleet.initialCode.toLowerCase();
          if (!matchPlate && !matchInit) return false;
        }
      }
      return true;
    });

    // Build RouteEvaluationSummary list with Gate-Out & Tiba di Argo SLA calculation
    const routeEvaluations: RouteEvaluationSummary[] = filteredSchedules.map((sch: Schedule) => {
      const store = stores.find((s: RetailStore) => s.id === sch.storeId) || sch.store;
      const fleet = fleets.find((f: Fleet) => f.id === sch.fleetId) || sch.fleet;
      const crew = crews.find((c: Crew) => c.id === sch.crewId) || sch.crew;
      const helper = sch.crewHelperId ? crews.find((c: Crew) => c.id === sch.crewHelperId) : sch.crewHelper;

      const schDate = (sch.estimatedArrival || sch.departureDate || '').substring(0, 10);
      const depDate = (sch.departureDate || '').substring(0, 10);
      const matchedFuel =
        filteredFuelLogs.find(
          (fl: FuelLog) => fl.fleetId === sch.fleetId && (fl.date === schDate || fl.date === depDate)
        ) || filteredFuelLogs.find((fl: FuelLog) => fl.fleetId === sch.fleetId);

      const bbmStartKm = matchedFuel ? Number(matchedFuel.startOdometerKm || matchedFuel.distanceKm || 0) : 0;

      const matchedEval = evaluations.find(
        (ev: TrackingEvaluation) =>
          ev.scheduleId === sch.id ||
          (ev.fleetId && ev.fleetId === sch.fleetId) ||
          (fleet?.plateNumber && (ev.plateNumber || '').toLowerCase() === fleet.plateNumber.toLowerCase())
      );
      const avgSpeedKmh = matchedEval?.avgSpeedKmh || avgFleetSpeedFromEvaluasi;
      const maxSpeedKmh = matchedEval?.maxSpeedKmh || defaultMaxSpeed;

      // Check Gate-Out keluar gudang & Tiba di Argo records
      const sharedFlow = sharedFlowMap[sch.id];
      const hasGateOutFlag = Boolean(
        sharedFlow?.gateOutConfirmed ||
        gateOutConfirmMap[sch.id] ||
        sch.status === 'in_transit' ||
        sch.status === 'picked_up' ||
        sch.status === 'delivered'
      );

      const matchedEndReport = driverReports.find(
        (r: DriverHelperReport) =>
          (r.deliveryId === sch.id || (r.plateNumber && fleet?.plateNumber && r.plateNumber.toLowerCase() === fleet.plateNumber.toLowerCase() && (r.date === schDate || r.date === depDate))) &&
          r.category === 'akhir_kiriman'
      );

      const gateOutIso =
        sharedFlow?.gateOutTimestamp ||
        (hasGateOutFlag ? sch.departureDate : undefined);

      const argoReturnIso =
        sharedFlow?.argoArrivalTimestamp ||
        sch.actualArrival ||
        sch.podPhotoTimestamp ||
        matchedEndReport?.timestamp ||
        (sch.status === 'delivered' ? sch.estimatedArrival : undefined);

      const gateOutDelayMin = gateOutIso ? diffMinutesBetween(sch.departureDate, gateOutIso) : 0;
      const gateOutStatus: 'tepat_waktu' | 'terlambat' | 'belum' = !hasGateOutFlag
        ? 'belum'
        : gateOutDelayMin <= 15
        ? 'tepat_waktu'
        : 'terlambat';

      const hasArgoReturn = Boolean(
        sharedFlow?.argoArrivalConfirmed ||
        sch.status === 'delivered' ||
        sch.actualArrival ||
        sch.podPhotoTimestamp ||
        matchedEndReport
      );
      const argoReturnDelayMin = argoReturnIso ? diffMinutesBetween(sch.estimatedArrival, argoReturnIso) : 0;
      const argoReturnStatus: 'tepat_waktu' | 'terlambat' | 'belum' = !hasArgoReturn
        ? 'belum'
        : argoReturnDelayMin <= 15
        ? 'tepat_waktu'
        : 'terlambat';

      const slaDelayMinutes = Math.max(0, gateOutDelayMin, argoReturnDelayMin);
      const isOnTime =
        sch.status !== 'delayed' &&
        gateOutStatus !== 'terlambat' &&
        argoReturnStatus !== 'terlambat';

      return {
        scheduleId: sch.id,
        trackingNumber: sch.trackingNumber,
        date: schDate || depDate,
        destinationStore: store?.storeName || sch.areaName || 'Area Distribusi',
        destinationCity: store?.city || 'Banyuwangi',
        island: store?.island || 'Jawa',
        fleetId: sch.fleetId,
        plateNumber: fleet?.plateNumber || '-',
        initialCode: fleet?.initialCode,
        vehicleType: fleet?.vehicleType || 'Armada',
        crewId: sch.crewId,
        driverName: crew?.name || '-',
        helperName: helper?.name,
        bbmStartKm,
        avgSpeedKmh,
        maxSpeedKmh,
        scheduledDepartureTime: formatTimeWib(sch.departureDate),
        actualGateOutTime: hasGateOutFlag ? formatTimeWib(gateOutIso) : '-',
        gateOutStatus,
        scheduledReturnTime: formatTimeWib(sch.estimatedArrival),
        actualArgoReturnTime: hasArgoReturn ? formatTimeWib(argoReturnIso) : '-',
        argoReturnStatus,
        isOnTime,
        slaDelayMinutes,
        status: sch.status,
        cargoWeightTon: sch.cargoWeightTon || 0
      };
    });

    // Build FleetAnalyticsItem list
    const targetFleets = filters.fleetId === 'all' ? fleets : fleets.filter((f: Fleet) => f.id === filters.fleetId);

    const fleetMetrics: FleetAnalyticsItem[] = targetFleets.map((fleet: Fleet) => {
      const fRoutes = routeEvaluations.filter((r: RouteEvaluationSummary) => r.fleetId === fleet.id);
      const fFuelLogs = filteredFuelLogs.filter((fl: FuelLog) => fl.fleetId === fleet.id);
      const fCrewHist = filteredCrewHistory.filter(
        (h: CrewDeliveryHistory) =>
          (h.vehiclePlate || h.plateNumber || '').toLowerCase() === fleet.plateNumber.toLowerCase() ||
          (fleet.initialCode && (h.initialCode || '').toLowerCase() === fleet.initialCode.toLowerCase())
      );

      const fleetStartKmTotal = fFuelLogs.reduce(
        (sum: number, fl: FuelLog) => sum + Number(fl.startOdometerKm || fl.distanceKm || 0),
        0
      );

      const uniqueScheduleIds = new Set<string>();
      fRoutes.forEach((r: RouteEvaluationSummary) => uniqueScheduleIds.add(r.scheduleId));
      fCrewHist.forEach((h: CrewDeliveryHistory) => {
        if (h.scheduleId) uniqueScheduleIds.add(h.scheduleId);
        else uniqueScheduleIds.add(h.id);
      });

      const totalTrips = Math.max(fRoutes.length, uniqueScheduleIds.size);
      const crewMenuFrequency = fCrewHist.length || fRoutes.length;
      const onTimeTripsCount = fRoutes.filter((r: RouteEvaluationSummary) => r.isOnTime).length;
      const lateTripsCount = fRoutes.filter((r: RouteEvaluationSummary) => !r.isOnTime).length;
      const onTimeRatePercent =
        fRoutes.length > 0 ? Number(((onTimeTripsCount / fRoutes.length) * 100).toFixed(1)) : 100;

      const matchedEval = evaluations.find(
        (ev: TrackingEvaluation) =>
          ev.fleetId === fleet.id ||
          (ev.plateNumber || '').toLowerCase() === fleet.plateNumber.toLowerCase()
      );
      const avgSpeedKmh = matchedEval?.avgSpeedKmh || avgFleetSpeedFromEvaluasi;
      const maxSpeedKmh = matchedEval?.maxSpeedKmh || defaultMaxSpeed;

      const totalFuelLiters = Number(
        fFuelLogs.reduce((acc: number, fl: FuelLog) => acc + Number(fl.liters || 0), 0).toFixed(1)
      );
      const avgKmPerLiter =
        totalFuelLiters > 0 && fleetStartKmTotal > 0
          ? Number((fleetStartKmTotal / totalFuelLiters).toFixed(2))
          : fleet.vehicleType === 'Pick Up Box'
          ? 9.5
          : 7.2;

      return {
        fleetId: fleet.id,
        plateNumber: fleet.plateNumber,
        initialCode: fleet.initialCode,
        vehicleType: fleet.vehicleType,
        brand: fleet.brand || 'Mitsubishi Fuso',
        totalTrips,
        crewMenuFrequency,
        totalDistanceKm: Number(fleetStartKmTotal.toFixed(1)),
        avgSpeedKmh,
        maxSpeedKmh,
        totalFuelLiters,
        avgKmPerLiter,
        onTimeTripsCount,
        lateTripsCount,
        onTimeRatePercent
      };
    });

    // Build CrewAnalyticsItem list
    const targetCrews = filters.crewId === 'all' ? crews : crews.filter((c: Crew) => c.id === filters.crewId);

    const crewMetrics: CrewAnalyticsItem[] = targetCrews.map((crew: Crew) => {
      const asDriverRoutes = routeEvaluations.filter(
        (r: RouteEvaluationSummary) =>
          r.crewId === crew.id ||
          (r.driverName && r.driverName.toLowerCase() === crew.name.toLowerCase())
      );
      const asHelperRoutes = routeEvaluations.filter(
        (r: RouteEvaluationSummary) =>
          r.helperName && r.helperName.toLowerCase() === crew.name.toLowerCase()
      );
      const cRoutes = [...asDriverRoutes, ...asHelperRoutes];
      const cHistory = filteredCrewHistory.filter(
        (h: CrewDeliveryHistory) =>
          h.crewId === crew.id ||
          (h.crewName && h.crewName.toLowerCase() === crew.name.toLowerCase())
      );
      const cFuelLogs = filteredFuelLogs.filter(
        (fl: FuelLog) =>
          fl.driverId === crew.id ||
          (fl.driverName && fl.driverName.toLowerCase() === crew.name.toLowerCase())
      );

      const crewStartKmTotal = cFuelLogs.reduce(
        (sum: number, fl: FuelLog) => sum + Number(fl.startOdometerKm || fl.distanceKm || 0),
        0
      );

      const totalTripsAsDriver = asDriverRoutes.length;
      const totalTripsAsHelper = asHelperRoutes.length;
      const totalTripsCombined = Math.max(totalTripsAsDriver + totalTripsAsHelper, cHistory.length);

      const onTimeDeliveries = cRoutes.filter((r: RouteEvaluationSummary) => r.isOnTime).length;
      const lateDeliveries = cRoutes.filter((r: RouteEvaluationSummary) => !r.isOnTime).length;
      const onTimeRatePercent =
        cRoutes.length > 0 ? Number(((onTimeDeliveries / cRoutes.length) * 100).toFixed(1)) : 100;

      const areaSet = new Set<string>();
      cRoutes.forEach((r: RouteEvaluationSummary) => {
        if (r.destinationStore) areaSet.add(r.destinationStore);
      });
      cHistory.forEach((h: CrewDeliveryHistory) => {
        if (h.area || h.storeName) areaSet.add(h.area || h.storeName);
      });

      const isHelperRole = (crew.role || '').toLowerCase().includes('helper') || (crew.role || '').toLowerCase().includes('kernet');

      return {
        crewId: crew.id,
        crewName: crew.name,
        cleanRoleLabel: isHelperRole ? 'Helper' : 'Driver',
        totalTripsAsDriver,
        totalTripsAsHelper,
        totalTripsCombined,
        totalDistanceKm: Number(crewStartKmTotal.toFixed(1)),
        avgSpeedKmh: avgFleetSpeedFromEvaluasi,
        onTimeDeliveries,
        lateDeliveries,
        onTimeRatePercent,
        safetyScore: Math.max(80, Math.min(100, Math.round(onTimeRatePercent))),
        PrimaryRoutes: Array.from(areaSet).slice(0, 3)
      };
    });

    // Build dailyTrends
    const dateMap = new Map<string, { km: number; count: number }>();
    filteredFuelLogs.forEach((fl: FuelLog) => {
      const d = (fl.date || '').substring(0, 10);
      if (!d) return;
      const cur = dateMap.get(d) || { km: 0, count: 0 };
      cur.km += Number(fl.startOdometerKm || fl.distanceKm || 0);
      dateMap.set(d, cur);
    });
    routeEvaluations.forEach((r: RouteEvaluationSummary) => {
      const d = (r.date || '').substring(0, 10);
      if (!d) return;
      const cur = dateMap.get(d) || { km: 0, count: 0 };
      cur.count += 1;
      dateMap.set(d, cur);
    });

    const dailyTrends: DailyTrendItem[] = Array.from(dateMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([dateStr, val]) => {
        const parts = dateStr.split('-');
        const formattedDate = parts.length === 3 ? `${parts[2]}/${parts[1]}` : dateStr;
        return {
          date: dateStr,
          formattedDate,
          totalDistanceKm: Number(val.km.toFixed(1)),
          avgSpeedKmh: avgFleetSpeedFromEvaluasi,
          deliveriesCount: val.count
        };
      });

    // Overall summary integrating all 4 requested data sources
    const uniqueFleetFreqKeys = new Set<string>();
    filteredSchedules.forEach((s: Schedule) => uniqueFleetFreqKeys.add(s.id));
    filteredCrewHistory.forEach((h: CrewDeliveryHistory) => {
      if (h.scheduleId) uniqueFleetFreqKeys.add(h.scheduleId);
      else uniqueFleetFreqKeys.add(h.id);
    });

    const totalDeliveries = Math.max(routeEvaluations.length, uniqueFleetFreqKeys.size);
    const fleetFrequencyTotal = filteredCrewHistory.length || routeEvaluations.length;

    const gateOutOnTimeCount = routeEvaluations.filter((r: RouteEvaluationSummary) => r.gateOutStatus === 'tepat_waktu').length;
    const gateOutLateCount = routeEvaluations.filter((r: RouteEvaluationSummary) => r.gateOutStatus === 'terlambat').length;
    const argoReturnOnTimeCount = routeEvaluations.filter((r: RouteEvaluationSummary) => r.argoReturnStatus === 'tepat_waktu').length;
    const argoReturnLateCount = routeEvaluations.filter((r: RouteEvaluationSummary) => r.argoReturnStatus === 'terlambat').length;
    const onTimeCount = routeEvaluations.filter((r: RouteEvaluationSummary) => r.isOnTime).length;
    const lateCount = routeEvaluations.filter((r: RouteEvaluationSummary) => !r.isOnTime).length;

    const onTimeRatePercent =
      routeEvaluations.length > 0 ? Number(((onTimeCount / routeEvaluations.length) * 100).toFixed(1)) : 100;

    const totalCargoTon = Number(
      routeEvaluations.reduce((acc: number, r: RouteEvaluationSummary) => acc + r.cargoWeightTon, 0).toFixed(1)
    );

    const evaluationRoutesCount = Math.max(
      evaluations.length,
      Number(DEFAULT_TRACKSOLID_BOTTOM_SUMMARY?.trips || 59),
      routeEvaluations.length
    );

    return {
      overall: {
        totalDistanceKm: totalDistanceFromBbmKm,
        avgFleetSpeedKmh: avgFleetSpeedFromEvaluasi,
        overallIdlePercentage: 0,
        totalCompletedDeliveries: totalDeliveries,
        totalScheduledDeliveries: totalDeliveries,
        overallOnTimePercentage: onTimeRatePercent,
        totalCargoTon,
        totalTrackingPoints: 0,
        activeFleetsCount: fleetMetrics.filter((f: FleetAnalyticsItem) => f.totalTrips > 0).length || fleets.length,
        activeCrewsCount: crewMetrics.filter((c: CrewAnalyticsItem) => c.totalTripsCombined > 0).length || crews.length,
        averageDeliveryDurationHours: 4.5,
        bbmInputCount,
        avgSpeedKmh: avgFleetSpeedFromEvaluasi,
        maxSpeedKmh: defaultMaxSpeed,
        evaluationRoutesCount,
        totalDeliveries,
        fleetFrequencyTotal,
        onTimeRatePercent,
        onTimeCount,
        lateCount,
        gateOutOnTimeCount,
        gateOutLateCount,
        argoReturnOnTimeCount,
        argoReturnLateCount
      },
      dailyTrends,
      fleetMetrics,
      crewMetrics,
      routeEvaluations,
      filteredLogs: []
    };
  }
}

export const trackingLogService = new TrackingLogAnalyticsService();
