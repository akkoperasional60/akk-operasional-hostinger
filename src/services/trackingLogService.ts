import {
  Schedule,
  Fleet,
  Crew,
  TrackingLog,
  FleetPerformanceMetric,
  CrewPerformanceMetric,
  OverallAnalyticsSummary
} from '../types';
import { logisticsStore } from './store';

const STORAGE_KEY = 'akk_tracking_logs_v2';

/**
 * Haversine formula to compute geodesic distance in Kilometers between 2 points
 */
export function calculateHaversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export type TimeRangePreset = 'all' | 'today' | '7days' | '30days' | 'this_month' | 'custom';

export interface AnalyticsFilterParams {
  timePreset: TimeRangePreset;
  customStartDate?: string;
  customEndDate?: string;
  fleetId?: string; // 'all' or specific ID
  crewId?: string;  // 'all' or specific ID
  status?: string;  // 'all' or specific shipment status
  searchQuery?: string;
}

// Known coordinate reference hubs in East Java & Bali for high-accuracy route path generation
const WAYPOINT_HUBS: Record<string, { lat: number; lng: number; name: string }[]> = {
  bali: [
    { lat: -8.1906, lng: 114.3708, name: 'Gudang Pusat AKK Banyuwangi DC' },
    { lat: -8.1510, lng: 114.3980, name: 'Pelabuhan ASDP Ketapang' },
    { lat: -8.1650, lng: 114.4400, name: 'Pelabuhan Gilimanuk Bali' },
    { lat: -8.2580, lng: 114.5300, name: 'Jalur Nasional Cekik Bali Barat' },
    { lat: -8.3580, lng: 114.6250, name: 'Jembrana / Kota Negara' },
    { lat: -8.4500, lng: 114.8500, name: 'Pekutatan Jembrana' },
    { lat: -8.5120, lng: 115.0200, name: 'Antosari Selemadeg' },
    { lat: -8.5380, lng: 115.1230, name: 'Kota Tabanan' },
    { lat: -8.6200, lng: 115.1750, name: 'Mengwi Badung' },
    { lat: -8.6705, lng: 115.2126, name: 'Denpasar Retail Hub Utama' }
  ],
  pantura: [
    { lat: -8.1906, lng: 114.3708, name: 'Gudang Pusat AKK Banyuwangi DC' },
    { lat: -8.1150, lng: 114.3850, name: 'Bangsring Watu Dodol' },
    { lat: -7.9850, lng: 114.4020, name: 'Wongsorejo Banyuwangi Utara' },
    { lat: -7.9150, lng: 114.4250, name: 'Bajulmati Alas Purwo Gate' },
    { lat: -7.7950, lng: 114.2250, name: 'Hutan Baluran Pantura' },
    { lat: -7.7050, lng: 114.0050, name: 'Situbondo Kota Retail Cluster' },
    { lat: -7.7350, lng: 113.8200, name: 'Pasir Putih Situbondo' },
    { lat: -7.7300, lng: 113.6800, name: 'Besuki Transit Hub' },
    { lat: -7.7550, lng: 113.2150, name: 'Probolinggo Paiton Bypass' },
    { lat: -7.7500, lng: 113.1200, name: 'Probolinggo Kota' },
    { lat: -7.3150, lng: 112.7450, name: 'Surabaya Distribution Hub' }
  ],
  jember: [
    { lat: -8.1906, lng: 114.3708, name: 'Gudang Pusat AKK Banyuwangi DC' },
    { lat: -8.2350, lng: 114.3550, name: 'Banyuwangi Kota Barat' },
    { lat: -8.3050, lng: 114.2980, name: 'Rogojampi Trade Center' },
    { lat: -8.3350, lng: 114.2250, name: 'Singojuruh - Srono' },
    { lat: -8.3635, lng: 114.1520, name: 'Genteng Sentra Bisnis' },
    { lat: -8.3200, lng: 114.0500, name: 'Glenmore Agro Corridor' },
    { lat: -8.2910, lng: 113.9820, name: 'Kalibaru Hill Station' },
    { lat: -8.2750, lng: 113.9200, name: 'Puncak Gunung Gumitir' },
    { lat: -8.2450, lng: 113.8250, name: 'Garahan Silo' },
    { lat: -8.1950, lng: 113.7550, name: 'Mayang Jember' },
    { lat: -8.1720, lng: 113.7000, name: 'Jember Kota / Selatan Hub' }
  ],
  lokal: [
    { lat: -8.1906, lng: 114.3708, name: 'Gudang Pusat AKK Banyuwangi DC' },
    { lat: -8.2150, lng: 114.3650, name: 'Sukowidi - Klatak' },
    { lat: -8.2610, lng: 114.3210, name: 'Kabat Banyuwangi' },
    { lat: -8.3050, lng: 114.2980, name: 'Rogojampi Sentra Pasar' },
    { lat: -8.3300, lng: 114.2850, name: 'Gladag - Gitik' },
    { lat: -8.3850, lng: 114.3200, name: 'Srono Banyuwangi' },
    { lat: -8.4200, lng: 114.3400, name: 'Muncar Central Pelabuhan Ikan' },
    { lat: -8.3635, lng: 114.1520, name: 'Genteng Pasar Induk' },
    { lat: -8.4100, lng: 114.2100, name: 'Jajag Cluring' },
    { lat: -8.1906, lng: 114.3708, name: 'Kembali ke Gudang Pusat AKK DC' }
  ]
};

class TrackingLogService {
  private trackingLogs: TrackingLog[] = [];
  private isInitialized = false;

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    try {
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          this.trackingLogs = JSON.parse(raw);
          this.isInitialized = true;
        }
      }
    } catch (e) {
      console.warn('[TrackingLogService] Failed to load tracking logs from storage:', e);
      this.trackingLogs = [];
    }

    // Ensure we have seeded data if empty or too small
    if (!this.trackingLogs || this.trackingLogs.length < 20) {
      this.seedTrackingLogsFromSchedules();
    }
  }

  private saveToStorage() {
    try {
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.trackingLogs));
      }
    } catch (e) {
      console.warn('[TrackingLogService] Failed to save tracking logs to storage:', e);
    }
  }

  /**
   * Seed realistic GPS tracking logs for all existing schedules in logisticsStore
   */
  public seedTrackingLogsFromSchedules(): TrackingLog[] {
    const schedules = logisticsStore.getSchedules();
    const generatedLogs: TrackingLog[] = [];

    schedules.forEach((sch) => {
      // Pick route path based on destination / notes
      let routePath = WAYPOINT_HUBS.lokal;
      const destLower = `${sch.store?.storeName || ''} ${sch.store?.city || ''} ${sch.notes || ''}`.toLowerCase();

      if (sch.isInterIsland || destLower.includes('bali') || destLower.includes('denpasar') || destLower.includes('singaraja') || destLower.includes('negara')) {
        routePath = WAYPOINT_HUBS.bali;
      } else if (destLower.includes('situbondo') || destLower.includes('probolinggo') || destLower.includes('surabaya') || destLower.includes('bondowoso')) {
        routePath = WAYPOINT_HUBS.pantura;
      } else if (destLower.includes('jember') || destLower.includes('lumajang') || destLower.includes('kalibaru')) {
        routePath = WAYPOINT_HUBS.jember;
      }

      const depTime = new Date(sch.departureDate).getTime();
      let arrTime = sch.actualArrival ? new Date(sch.actualArrival).getTime() : new Date(sch.estimatedArrival).getTime();
      
      // Safety fallback: if timestamps invalid, ensure at least 3 hours duration
      if (isNaN(depTime) || isNaN(arrTime) || arrTime <= depTime) {
        arrTime = (isNaN(depTime) ? Date.now() - 3600000 * 6 : depTime) + 3600000 * 4;
      }

      const totalDurationMs = arrTime - depTime;
      const pointCount = Math.max(12, Math.min(30, routePath.length * 2));
      const stepMs = totalDurationMs / (pointCount - 1);

      for (let i = 0; i < pointCount; i++) {
        const pointTime = new Date(depTime + i * stepMs).toISOString();
        const progress = i / (pointCount - 1);
        const floatIndex = progress * (routePath.length - 1);
        const idxLow = Math.floor(floatIndex);
        const idxHigh = Math.min(routePath.length - 1, Math.ceil(floatIndex));
        const fraction = floatIndex - idxLow;

        const p1 = routePath[idxLow];
        const p2 = routePath[idxHigh];

        // Linear interpolation with subtle jitter for GPS accuracy
        const jitterLat = ((Math.sin(i * 13 + 7) * 1000) % 5) / 10000;
        const jitterLng = ((Math.cos(i * 17 + 3) * 1000) % 5) / 10000;
        const lat = p1.lat + (p2.lat - p1.lat) * fraction + jitterLat;
        const lng = p1.lng + (p2.lng - p1.lng) * fraction + jitterLng;

        // Realistic Engine & Speed logic:
        // First point: DC loading (IDLE / STOP)
        // Last point: Destination unloading (STOP)
        // Random 15% intermediate points: IDLE (traffic light, ferry queue, rest area)
        let engineStatus: 'RUNNING' | 'STOP' | 'IDLE' = 'RUNNING';
        let speed = 40 + Math.round((Math.sin(i * 2.5) + 1) * 18); // 40 - 76 km/h

        if (i === 0) {
          engineStatus = 'IDLE';
          speed = 0;
        } else if (i === pointCount - 1) {
          engineStatus = sch.status === 'delivered' ? 'STOP' : 'RUNNING';
          speed = sch.status === 'delivered' ? 0 : 35;
        } else if (i % 6 === 3) {
          // Scheduled rest / traffic / port queue
          engineStatus = 'IDLE';
          speed = 0;
        } else if (i % 8 === 0) {
          // Slow crawling traffic
          engineStatus = 'RUNNING';
          speed = 12;
        }

        const locationName = i === 0 ? p1.name : (p2.name || 'Jalur Distribusi AKK');

        generatedLogs.push({
          id: `trk-log-${sch.id}-${i + 1}`,
          schedule_id: sch.id,
          timestamp: pointTime,
          latitude: Number(lat.toFixed(6)),
          longitude: Number(lng.toFixed(6)),
          speed,
          engine_status: engineStatus,
          location_name: locationName,
          created_at: pointTime
        });
      }
    });

    this.trackingLogs = generatedLogs;
    this.saveToStorage();
    this.isInitialized = true;
    return this.trackingLogs;
  }

  /**
   * Return all stored tracking logs or filtered by schedule ID
   */
  public getTrackingLogs(scheduleId?: string): TrackingLog[] {
    if (this.trackingLogs.length === 0) {
      this.seedTrackingLogsFromSchedules();
    }
    if (scheduleId) {
      return this.trackingLogs.filter(t => t.schedule_id === scheduleId);
    }
    return [...this.trackingLogs];
  }

  /**
   * Add a single new tracking log
   */
  public addTrackingLog(log: Omit<TrackingLog, 'id' | 'created_at'>): TrackingLog {
    const newLog: TrackingLog = {
      ...log,
      id: `trk-log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      created_at: new Date().toISOString()
    };
    this.trackingLogs.push(newLog);
    this.saveToStorage();
    return newLog;
  }

  /**
   * Filter schedules according to time presets, fleet, crew, and search query
   */
  public filterSchedules(params: AnalyticsFilterParams): Schedule[] {
    const allSchedules = logisticsStore.getSchedules();
    const now = new Date();

    return allSchedules.filter((sch) => {
      // 1. Fleet Filter
      if (params.fleetId && params.fleetId !== 'all' && sch.fleetId !== params.fleetId) {
        return false;
      }

      // 2. Crew Filter (Check Driver Utama or Helper)
      if (params.crewId && params.crewId !== 'all') {
        const isMatched = sch.crewId === params.crewId || sch.crewHelperId === params.crewId || sch.crewHelper2Id === params.crewId;
        if (!isMatched) return false;
      }

      // 3. Status Filter
      if (params.status && params.status !== 'all' && sch.status !== params.status) {
        return false;
      }

      // 4. Search Query Filter
      if (params.searchQuery && params.searchQuery.trim() !== '') {
        const q = params.searchQuery.toLowerCase().trim();
        const matchTracking = sch.trackingNumber.toLowerCase().includes(q);
        const matchStore = sch.store?.storeName?.toLowerCase().includes(q);
        const matchPlate = sch.fleet?.plateNumber?.toLowerCase().includes(q);
        const matchCrew = sch.crew?.name?.toLowerCase().includes(q);
        const matchArea = sch.areaName?.toLowerCase().includes(q) || sch.store?.city?.toLowerCase().includes(q);
        if (!matchTracking && !matchStore && !matchPlate && !matchCrew && !matchArea) {
          return false;
        }
      }

      // 5. Time Range Filter
      const schedTime = new Date(sch.departureDate).getTime();
      if (isNaN(schedTime)) return true;

      if (params.timePreset === 'today') {
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const todayEnd = todayStart + 24 * 3600 * 1000;
        return schedTime >= todayStart && schedTime <= todayEnd;
      }

      if (params.timePreset === '7days') {
        const sevenDaysAgo = now.getTime() - 7 * 24 * 3600 * 1000;
        return schedTime >= sevenDaysAgo;
      }

      if (params.timePreset === '30days') {
        const thirtyDaysAgo = now.getTime() - 30 * 24 * 3600 * 1000;
        return schedTime >= thirtyDaysAgo;
      }

      if (params.timePreset === 'this_month') {
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
        return schedTime >= monthStart;
      }

      if (params.timePreset === 'custom') {
        if (params.customStartDate) {
          const cStart = new Date(params.customStartDate).getTime();
          if (!isNaN(cStart) && schedTime < cStart) return false;
        }
        if (params.customEndDate) {
          const cEnd = new Date(params.customEndDate).getTime() + 24 * 3600 * 1000; // End of the day
          if (!isNaN(cEnd) && schedTime > cEnd) return false;
        }
      }

      return true;
    });
  }

  /**
   * Calculate detailed GPS performance metrics for a specific set of schedules
   */
  public calculateScheduleGpsMetrics(scheduleId: string): {
    totalDistanceKm: number;
    avgSpeedKmh: number;
    maxSpeedKmh: number;
    idleMinutes: number;
    runningMinutes: number;
    stopMinutes: number;
    totalPoints: number;
  } {
    const logs = this.getTrackingLogs(scheduleId).sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    if (logs.length === 0) {
      return {
        totalDistanceKm: 0,
        avgSpeedKmh: 0,
        maxSpeedKmh: 0,
        idleMinutes: 0,
        runningMinutes: 0,
        stopMinutes: 0,
        totalPoints: 0
      };
    }

    let totalDist = 0;
    let maxSpeed = 0;
    let speedSumRunning = 0;
    let runningCount = 0;

    let idleMinutes = 0;
    let runningMinutes = 0;
    let stopMinutes = 0;

    for (let i = 0; i < logs.length; i++) {
      const cur = logs[i];
      if (cur.speed > maxSpeed) maxSpeed = cur.speed;

      if (cur.engine_status === 'RUNNING' && cur.speed > 0) {
        speedSumRunning += cur.speed;
        runningCount++;
      }

      if (i > 0) {
        const prev = logs[i - 1];
        const distSeg = calculateHaversineDistanceKm(
          prev.latitude,
          prev.longitude,
          cur.latitude,
          cur.longitude
        );
        totalDist += distSeg;

        const timeDiffMin = Math.max(
          1,
          Math.min(120, (new Date(cur.timestamp).getTime() - new Date(prev.timestamp).getTime()) / 60000)
        );

        if (cur.engine_status === 'IDLE' || (cur.speed === 0 && cur.engine_status !== 'STOP')) {
          idleMinutes += timeDiffMin;
        } else if (cur.engine_status === 'STOP') {
          stopMinutes += timeDiffMin;
        } else {
          runningMinutes += timeDiffMin;
        }
      }
    }

    const avgSpeed = runningCount > 0 ? Math.round(speedSumRunning / runningCount) : 0;

    return {
      totalDistanceKm: Number(totalDist.toFixed(1)),
      avgSpeedKmh: avgSpeed,
      maxSpeedKmh: Math.round(maxSpeed),
      idleMinutes: Math.round(idleMinutes),
      runningMinutes: Math.round(runningMinutes),
      stopMinutes: Math.round(stopMinutes),
      totalPoints: logs.length
    };
  }

  /**
   * Generate Overall Analytics Summary based on filtered schedules
   */
  public getOverallSummary(params: AnalyticsFilterParams): OverallAnalyticsSummary {
    const schedules = this.filterSchedules(params);
    let totalKm = 0;
    let speedSum = 0;
    let speedCount = 0;
    let totalIdleMin = 0;
    let totalRunMin = 0;
    let completedCount = 0;
    let onTimeCount = 0;
    let totalDurationHoursSum = 0;
    let totalCargo = 0;
    let totalPoints = 0;

    const activeFleetsSet = new Set<string>();
    const activeCrewsSet = new Set<string>();

    schedules.forEach((sch) => {
      if (sch.fleetId) activeFleetsSet.add(sch.fleetId);
      if (sch.crewId) activeCrewsSet.add(sch.crewId);
      totalCargo += sch.cargoWeightTon || 0;

      if (sch.status === 'delivered') {
        completedCount++;
      }

      // Check on-time status
      if (sch.actualArrival && sch.estimatedArrival) {
        const act = new Date(sch.actualArrival).getTime();
        const est = new Date(sch.estimatedArrival).getTime();
        if (act <= est + 15 * 60000) { // 15 min grace window
          onTimeCount++;
        }
      } else if (sch.status === 'delivered') {
        onTimeCount++; // Delivered within schedule
      }

      const dep = new Date(sch.departureDate).getTime();
      const arr = sch.actualArrival ? new Date(sch.actualArrival).getTime() : new Date(sch.estimatedArrival).getTime();
      if (!isNaN(dep) && !isNaN(arr) && arr > dep) {
        totalDurationHoursSum += (arr - dep) / 3600000;
      }

      const gps = this.calculateScheduleGpsMetrics(sch.id);
      totalKm += gps.totalDistanceKm;
      totalIdleMin += gps.idleMinutes;
      totalRunMin += gps.runningMinutes;
      totalPoints += gps.totalPoints;

      if (gps.avgSpeedKmh > 0) {
        speedSum += gps.avgSpeedKmh;
        speedCount++;
      }
    });

    const totalOperationalMin = totalIdleMin + totalRunMin;
    const overallIdlePercentage = totalOperationalMin > 0 
      ? Number(((totalIdleMin / totalOperationalMin) * 100).toFixed(1))
      : 14.5;

    const overallOnTimePercentage = schedules.length > 0 
      ? Number(((onTimeCount / schedules.length) * 100).toFixed(1))
      : 95.0;

    const avgFleetSpeed = speedCount > 0 ? Math.round(speedSum / speedCount) : 48;
    const avgDurationHours = schedules.length > 0 ? Number((totalDurationHoursSum / schedules.length).toFixed(1)) : 4.5;

    return {
      totalDistanceKm: Number(totalKm.toFixed(1)),
      avgFleetSpeedKmh: avgFleetSpeed,
      overallIdlePercentage,
      totalCompletedDeliveries: completedCount,
      totalScheduledDeliveries: schedules.length,
      overallOnTimePercentage,
      totalCargoTon: Number(totalCargo.toFixed(1)),
      totalTrackingPoints: totalPoints,
      activeFleetsCount: activeFleetsSet.size,
      activeCrewsCount: activeCrewsSet.size,
      averageDeliveryDurationHours: avgDurationHours
    };
  }

  /**
   * Aggregate Performance Summary for Fleets
   */
  public getFleetPerformance(params: AnalyticsFilterParams): FleetPerformanceMetric[] {
    const schedules = this.filterSchedules(params);
    const allFleets = logisticsStore.getFleets();

    // Group schedules by fleetId
    const fleetMap = new Map<string, Schedule[]>();
    schedules.forEach((sch) => {
      if (!sch.fleetId) return;
      const list = fleetMap.get(sch.fleetId) || [];
      list.push(sch);
      fleetMap.set(sch.fleetId, list);
    });

    const metrics: FleetPerformanceMetric[] = allFleets.map((fleet) => {
      const fleetSchedules = fleetMap.get(fleet.id) || [];
      let totalDist = 0;
      let maxSpeed = 0;
      let speedSum = 0;
      let speedCount = 0;
      let idleMin = 0;
      let runMin = 0;
      let stopMin = 0;
      let completed = 0;
      let inTransit = 0;
      let delayed = 0;
      let onTime = 0;
      let delayMinTotal = 0;
      let delayCount = 0;
      let totalWeight = 0;

      fleetSchedules.forEach((sch) => {
        totalWeight += sch.cargoWeightTon || 0;
        if (sch.status === 'delivered') completed++;
        else if (sch.status === 'in_transit') inTransit++;
        else if (sch.status === 'delayed') delayed++;

        // On-time check
        if (sch.actualArrival && sch.estimatedArrival) {
          const act = new Date(sch.actualArrival).getTime();
          const est = new Date(sch.estimatedArrival).getTime();
          if (act <= est + 15 * 60000) {
            onTime++;
          } else {
            const diffMin = Math.round((act - est) / 60000);
            delayMinTotal += diffMin;
            delayCount++;
          }
        } else if (sch.status === 'delivered') {
          onTime++;
        }

        const gps = this.calculateScheduleGpsMetrics(sch.id);
        totalDist += gps.totalDistanceKm;
        if (gps.maxSpeedKmh > maxSpeed) maxSpeed = gps.maxSpeedKmh;
        if (gps.avgSpeedKmh > 0) {
          speedSum += gps.avgSpeedKmh;
          speedCount++;
        }
        idleMin += gps.idleMinutes;
        runMin += gps.runningMinutes;
        stopMin += gps.stopMinutes;
      });

      const totalOpMin = idleMin + runMin;
      const idlePercent = totalOpMin > 0 ? Number(((idleMin / totalOpMin) * 100).toFixed(1)) : 0;
      const avgSpeed = speedCount > 0 ? Math.round(speedSum / speedCount) : (fleetSchedules.length > 0 ? 46 : 0);
      const onTimePercent = fleetSchedules.length > 0 ? Number(((onTime / fleetSchedules.length) * 100).toFixed(1)) : 100;
      const avgDelay = delayCount > 0 ? Math.round(delayMinTotal / delayCount) : 0;

      // Fuel consumption estimate (Roughly 8.5 km/L for pickup box, 6.5 km/L for light truck, 4.2 km/L for heavy truck)
      let fuelRatio = 7.5;
      if (fleet.vehicleType.toLowerCase().includes('pick up')) fuelRatio = 8.5;
      else if (fleet.vehicleType.toLowerCase().includes('tronton') || fleet.vehicleType.toLowerCase().includes('fuso')) fuelRatio = 4.2;
      else if (fleet.vehicleType.toLowerCase().includes('cdd') || fleet.vehicleType.toLowerCase().includes('engkel')) fuelRatio = 6.2;

      const estimatedLiters = totalDist > 0 ? Number((totalDist / fuelRatio).toFixed(1)) : 0;

      return {
        fleetId: fleet.id,
        plateNumber: fleet.plateNumber,
        initialCode: fleet.initialCode || '-',
        vehicleType: fleet.vehicleType,
        brand: fleet.brand || 'Mitsubishi / Isuzu',
        totalDistanceKm: Number(totalDist.toFixed(1)),
        avgSpeedKmh: avgSpeed,
        maxSpeedKmh: maxSpeed || 75,
        idleTimeMinutes: idleMin,
        runningTimeMinutes: runMin,
        stopTimeMinutes: stopMin,
        totalOperationMinutes: totalOpMin,
        idlePercentage: idlePercent,
        totalSchedules: fleetSchedules.length,
        completedDeliveries: completed,
        inTransitDeliveries: inTransit,
        delayedDeliveries: delayed,
        onTimeCount: onTime,
        onTimePercentage: onTimePercent,
        avgDelayMinutes: avgDelay,
        cargoWeightTotalTon: Number(totalWeight.toFixed(1)),
        fuelUsedEstimatedLiters: estimatedLiters,
        fuelEfficiencyKmPerLiter: fuelRatio
      };
    });

    // If a specific fleetId is selected in params, filter to it
    if (params.fleetId && params.fleetId !== 'all') {
      return metrics.filter(m => m.fleetId === params.fleetId);
    }

    // Sort descending by totalDistanceKm
    return metrics.sort((a, b) => b.totalDistanceKm - a.totalDistanceKm);
  }

  /**
   * Aggregate Performance Summary for Crew (Drivers & Helpers)
   */
  public getCrewPerformance(params: AnalyticsFilterParams): CrewPerformanceMetric[] {
    const schedules = this.filterSchedules(params);
    const allCrews = logisticsStore.getCrews();

    // Group schedules by crewId
    const crewMap = new Map<string, Schedule[]>();
    schedules.forEach((sch) => {
      // Attribute to driver utama
      if (sch.crewId) {
        const list = crewMap.get(sch.crewId) || [];
        list.push(sch);
        crewMap.set(sch.crewId, list);
      }
      // Also attribute to helpers if present
      if (sch.crewHelperId) {
        const list = crewMap.get(sch.crewHelperId) || [];
        list.push(sch);
        crewMap.set(sch.crewHelperId, list);
      }
      if (sch.crewHelper2Id) {
        const list = crewMap.get(sch.crewHelper2Id) || [];
        list.push(sch);
        crewMap.set(sch.crewHelper2Id, list);
      }
    });

    const metrics: CrewPerformanceMetric[] = allCrews.map((crew) => {
      const crewSchedules = crewMap.get(crew.id) || [];
      let totalDist = 0;
      let speedSum = 0;
      let speedCount = 0;
      let idleMin = 0;
      let runMin = 0;
      let completed = 0;
      let inTransit = 0;
      let delayed = 0;
      let onTime = 0;
      let delayMinTotal = 0;
      let delayCount = 0;

      const destinationFrequency: Record<string, number> = {};

      crewSchedules.forEach((sch) => {
        if (sch.status === 'delivered') completed++;
        else if (sch.status === 'in_transit') inTransit++;
        else if (sch.status === 'delayed') delayed++;

        const destKey = sch.areaName || sch.store?.city || sch.store?.storeName || 'Banyuwangi DC';
        destinationFrequency[destKey] = (destinationFrequency[destKey] || 0) + 1;

        if (sch.actualArrival && sch.estimatedArrival) {
          const act = new Date(sch.actualArrival).getTime();
          const est = new Date(sch.estimatedArrival).getTime();
          if (act <= est + 15 * 60000) {
            onTime++;
          } else {
            const diffMin = Math.round((act - est) / 60000);
            delayMinTotal += diffMin;
            delayCount++;
          }
        } else if (sch.status === 'delivered') {
          onTime++;
        }

        const gps = this.calculateScheduleGpsMetrics(sch.id);
        totalDist += gps.totalDistanceKm;
        if (gps.avgSpeedKmh > 0) {
          speedSum += gps.avgSpeedKmh;
          speedCount++;
        }
        idleMin += gps.idleMinutes;
        runMin += gps.runningMinutes;
      });

      const totalOpMin = idleMin + runMin;
      const idlePercent = totalOpMin > 0 ? Number(((idleMin / totalOpMin) * 100).toFixed(1)) : 0;
      const avgSpeed = speedCount > 0 ? Math.round(speedSum / speedCount) : (crewSchedules.length > 0 ? 47 : 0);
      const onTimePercent = crewSchedules.length > 0 ? Number(((onTime / crewSchedules.length) * 100).toFixed(1)) : 100;
      const avgDelay = delayCount > 0 ? Math.round(delayMinTotal / delayCount) : 0;

      // Punctuality Score: (onTimePercent * 0.8) + (max(0, 100 - avgDelay) * 0.2)
      const punctualityScore = crewSchedules.length > 0
        ? Math.round(onTimePercent * 0.8 + Math.max(0, 100 - avgDelay * 2) * 0.2)
        : 96;

      // Find top destination area
      let topArea = crew.routeExperience?.[0] || 'Lokal Banyuwangi';
      let maxFreq = 0;
      for (const [area, freq] of Object.entries(destinationFrequency)) {
        if (freq > maxFreq) {
          maxFreq = freq;
          topArea = area;
        }
      }

      return {
        crewId: crew.id,
        name: crew.name,
        role: crew.role,
        phone: crew.phone,
        rating: crew.rating || 4.8,
        tripsCompletedTotal: crew.tripsCompleted || completed,
        totalDistanceKm: Number(totalDist.toFixed(1)),
        avgSpeedKmh: avgSpeed,
        idleTimeMinutes: idleMin,
        runningTimeMinutes: runMin,
        idlePercentage: idlePercent,
        totalSchedules: crewSchedules.length,
        completedDeliveries: completed,
        inTransitDeliveries: inTransit,
        delayedDeliveries: delayed,
        onTimeCount: onTime,
        onTimePercentage: onTimePercent,
        avgDelayMinutes: avgDelay,
        punctualityScore,
        topDestinationArea: topArea
      };
    });

    if (params.crewId && params.crewId !== 'all') {
      return metrics.filter(m => m.crewId === params.crewId);
    }

    return metrics.sort((a, b) => b.totalDistanceKm - a.totalDistanceKm);
  }

  /**
   * Export analytical data to CSV
   */
  public exportToCsv(type: 'fleet' | 'crew' | 'schedules' | 'raw_tracking_logs', params: AnalyticsFilterParams) {
    let filename = `laporan_analitik_${type}_${new Date().toISOString().slice(0, 10)}.csv`;
    let csvContent = '';

    if (type === 'fleet') {
      const data = this.getFleetPerformance(params);
      const headers = [
        'Plat Nomor',
        'Inisial',
        'Tipe Armada',
        'Merk',
        'Total Jarak (KM)',
        'Rata-rata Kecepatan (KM/H)',
        'Kecepatan Max (KM/H)',
        'Waktu Idle (Menit)',
        'Persentase Idle (%)',
        'Total Jadwal',
        'Pengiriman Selesai',
        'Sedang Jalan',
        'Terlambat',
        'Ketepatan Waktu (%)',
        'Rata2 Keterlambatan (Menit)',
        'Muatan Terkirim (Ton)',
        'Estimasi Konsumsi BBM (Liter)'
      ];
      const rows = data.map(d => [
        `"${d.plateNumber}"`,
        `"${d.initialCode}"`,
        `"${d.vehicleType}"`,
        `"${d.brand}"`,
        d.totalDistanceKm,
        d.avgSpeedKmh,
        d.maxSpeedKmh,
        d.idleTimeMinutes,
        d.idlePercentage,
        d.totalSchedules,
        d.completedDeliveries,
        d.inTransitDeliveries,
        d.delayedDeliveries,
        d.onTimePercentage,
        d.avgDelayMinutes,
        d.cargoWeightTotalTon,
        d.fuelUsedEstimatedLiters
      ]);
      csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    } else if (type === 'crew') {
      const data = this.getCrewPerformance(params);
      const headers = [
        'Nama Kru',
        'Jabatan / Role',
        'Nomor Telepon',
        'Rating',
        'Total Jarak Ditempuh (KM)',
        'Rata2 Kecepatan (KM/H)',
        'Waktu Idle (Menit)',
        'Persentase Idle (%)',
        'Total Jadwal Ditugaskan',
        'Pengiriman Selesai',
        'Ketepatan Waktu (%)',
        'Skor Ketepatan (0-100)',
        'Rata2 Keterlambatan (Menit)',
        'Rute Dominan'
      ];
      const rows = data.map(d => [
        `"${d.name}"`,
        `"${d.role}"`,
        `"${d.phone}"`,
        d.rating,
        d.totalDistanceKm,
        d.avgSpeedKmh,
        d.idleTimeMinutes,
        d.idlePercentage,
        d.totalSchedules,
        d.completedDeliveries,
        d.onTimePercentage,
        d.punctualityScore,
        d.avgDelayMinutes,
        `"${d.topDestinationArea || '-'}"`
      ]);
      csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    } else if (type === 'schedules') {
      const schedules = this.filterSchedules(params);
      const headers = [
        'Nomor Tracking',
        'Tujuan Toko',
        'Kota / Area',
        'Armada',
        'Driver Utama',
        'Status',
        'Tanggal Berangkat',
        'Estimasi Tiba',
        'Aktual Tiba',
        'Berat Muatan (Ton)',
        'Jarak Tempuh (KM)',
        'Rata2 Kecepatan (KM/H)',
        'Waktu Idle (Menit)',
        'On-Time Status'
      ];
      const rows = schedules.map(s => {
        const gps = this.calculateScheduleGpsMetrics(s.id);
        let onTimeStr = 'Tepat Waktu';
        if (s.actualArrival && s.estimatedArrival) {
          onTimeStr = new Date(s.actualArrival).getTime() <= new Date(s.estimatedArrival).getTime() + 15 * 60000 
            ? 'On-Time' 
            : 'Delayed';
        }
        return [
          `"${s.trackingNumber}"`,
          `"${s.store?.storeName || '-'}"`,
          `"${s.store?.city || s.areaName || '-'}"`,
          `"${s.fleet?.plateNumber || '-'}"`,
          `"${s.crew?.name || '-'}"`,
          `"${s.status}"`,
          `"${s.departureDate}"`,
          `"${s.estimatedArrival}"`,
          `"${s.actualArrival || '-'}"`,
          s.cargoWeightTon || 0,
          gps.totalDistanceKm,
          gps.avgSpeedKmh,
          gps.idleMinutes,
          `"${onTimeStr}"`
        ];
      });
      csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    } else {
      // Raw tracking logs
      const schedules = this.filterSchedules(params);
      const schedIds = new Set(schedules.map(s => s.id));
      const logs = this.trackingLogs.filter(l => schedIds.has(l.schedule_id));

      const headers = ['Log ID', 'Schedule ID', 'Waktu (UTC)', 'Latitude', 'Longitude', 'Kecepatan (KM/H)', 'Status Mesin', 'Lokasi Acuan'];
      const rows = logs.map(l => [
        `"${l.id}"`,
        `"${l.schedule_id}"`,
        `"${l.timestamp}"`,
        l.latitude,
        l.longitude,
        l.speed,
        `"${l.engine_status}"`,
        `"${l.location_name || '-'}"`
      ]);
      csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    }

    // Trigger browser download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

export const trackingLogService = new TrackingLogService();
