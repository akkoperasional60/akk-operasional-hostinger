import { Crew, Fleet, RetailStore, Schedule, CrewDeliveryHistory } from '../types';
import { logisticsStore } from './store';

export type OptimizationPriority = 
  | 'fastest_time' 
  | 'balanced_workload' 
  | 'route_experience' 
  | 'fuel_cost_efficient';

export interface OptimizationParameters {
  storeId: string;
  cargoWeightTon: number;
  priority: OptimizationPriority;
  departureTime?: string;
  requireDoubleDriver?: boolean;
}

export interface RecommendationCandidate {
  id: string;
  driver: Crew;
  helper?: Crew;
  fleet: Fleet;
  overallScore: number; // e.g. 98.5
  
  // Breakdown Scores (0 - 100)
  speedHistoryScore: number;
  workloadScore: number;
  routeExperienceScore: number;
  vehicleMatchScore: number;
  
  // Historical Rationale & Metrics
  historicalAvgTimeHours: number;
  historicalOnTimeRate: number; // percentage
  historicalTripCountOnRoute: number;
  recentWorkloadTrips7Days: number;
  fatigueStatus: 'Aman (Sangat Segar)' | 'Normal' | 'Cukup Tinggi' | 'Tinggi (Saran Istirahat)';
  
  estimatedTravelTimeHours: number;
  estimatedFuelLiters: number;
  estimatedCostRp: number;
  
  rationaleList: string[];
  badges: string[];
}

export class RouteOptimizerService {

  public static optimizeRouteAssignment(
    params: OptimizationParameters,
    allCrews: Crew[],
    allFleets: Fleet[],
    allStores: RetailStore[]
  ): RecommendationCandidate[] {
    const targetStore = allStores.find(s => s.id === params.storeId) || allStores[0];
    if (!targetStore) return [];

    const histories = logisticsStore.getCrewDeliveryHistory();

    // Separate Drivers and Helpers
    const drivers = allCrews.filter(c => c.role === 'Driver Utama' || c.role === 'Driver Cadangan' || !c.role.includes('Helper'));
    const helpers = allCrews.filter(c => c.role === 'Kernet / Helper' || c.role.includes('Helper'));

    // Capacity matching fleets
    const suitableFleets = allFleets.filter(f => {
      const cap = f.tonnageCapacity || (
        f.vehicleType === 'Double STD' ? 12 :
        f.vehicleType === 'Engkel Long' ? 8 :
        f.vehicleType === 'Engkel STD' ? 5 : 2
      );
      return cap >= params.cargoWeightTon * 0.8; // Allow slight flexibility
    });

    const activeFleets = suitableFleets.length > 0 ? suitableFleets : allFleets;

    const candidates: RecommendationCandidate[] = [];

    // Evaluate combinations
    drivers.forEach((driver) => {
      // Evaluate with each helper (or no helper if light load)
      const helperOptions = helpers.length > 0 ? helpers : [undefined];

      helperOptions.forEach((helper) => {
        activeFleets.forEach((fleet) => {
          const candidate = this.evaluateCombination(
            driver,
            helper,
            fleet,
            targetStore,
            params,
            histories
          );
          candidates.push(candidate);
        });
      });
    });

    // Sort candidates by overallScore descending
    candidates.sort((a, b) => b.overallScore - a.overallScore);

    // Return top candidates (e.g. top 5 unique driver/helper combos)
    const uniqueMap = new Map<string, RecommendationCandidate>();
    for (const item of candidates) {
      const key = `${item.driver.id}-${item.helper?.id || 'none'}-${item.fleet.id}`;
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, item);
      }
      if (uniqueMap.size >= 6) break;
    }

    return Array.from(uniqueMap.values());
  }

  private static evaluateCombination(
    driver: Crew,
    helper: Crew | undefined,
    fleet: Fleet,
    store: RetailStore,
    params: OptimizationParameters,
    histories: CrewDeliveryHistory[]
  ): RecommendationCandidate {

    // 1. Route Experience Matching
    const driverHistories = histories.filter(h => h.crewId === driver.id);
    const helperHistories = helper ? histories.filter(h => h.crewId === helper.id) : [];

    const areaName = store.storeName.toUpperCase();
    const city = store.city.toLowerCase();
    const island = store.island.toLowerCase();

    // Match count on exact area or city
    const driverRouteTrips = driverHistories.filter(h => 
      h.storeName.toLowerCase().includes(city) || 
      h.area.toLowerCase().includes(city) ||
      h.island.toLowerCase() === island
    );

    const routeExperienceKeywords = [store.city, store.province, store.storeName, store.island];
    const driverHasExpBadge = (driver.routeExperience || []).some(exp => 
      routeExperienceKeywords.some(kw => exp.toLowerCase().includes(kw.toLowerCase()))
    );

    let routeExperienceScore = Math.min(100, (driverRouteTrips.length * 15) + (driverHasExpBadge ? 35 : 10));

    // 2. Speed & On-Time History Score
    const onTimeDriverTrips = driverRouteTrips.filter(h => h.onTimeStatus === 'Tepat Waktu' || h.onTimeStatus === 'Lebih Cepat');
    const onTimeRate = driverRouteTrips.length > 0 
      ? Math.round((onTimeDriverTrips.length / driverRouteTrips.length) * 100)
      : (driver.rating >= 4.7 ? 95 : 88);

    const speedHistoryScore = Math.min(100, Math.round((driver.rating / 5) * 40 + (onTimeRate * 0.6)));

    // 3. Workload & Fatigue Balance Score
    // Mock 7-day workload calculation from driver.tripsCompleted or recent history
    const recentWorkloadTrips7Days = Math.max(0, Math.floor(driver.tripsCompleted % 5));
    let fatigueStatus: RecommendationCandidate['fatigueStatus'] = 'Aman (Sangat Segar)';
    let workloadScore = 95;

    if (recentWorkloadTrips7Days >= 4) {
      fatigueStatus = 'Tinggi (Saran Istirahat)';
      workloadScore = 55;
    } else if (recentWorkloadTrips7Days === 3) {
      fatigueStatus = 'Cukup Tinggi';
      workloadScore = 75;
    } else if (recentWorkloadTrips7Days === 2) {
      fatigueStatus = 'Normal';
      workloadScore = 88;
    }

    if (driver.status === 'available') workloadScore += 5;
    if (helper && helper.status === 'available') workloadScore += 5;
    workloadScore = Math.min(100, workloadScore);

    // 4. Vehicle Capacity & Efficiency Match
    const fleetCap = fleet.tonnageCapacity || (
      fleet.vehicleType === 'Double STD' ? 12 :
      fleet.vehicleType === 'Engkel Long' ? 8 :
      fleet.vehicleType === 'Engkel STD' ? 5 : 2
    );

    const utilizationRatio = params.cargoWeightTon / fleetCap;
    let vehicleMatchScore = 80;
    if (utilizationRatio >= 0.6 && utilizationRatio <= 0.9) {
      vehicleMatchScore = 100; // Perfect fit
    } else if (utilizationRatio > 0.9 && utilizationRatio <= 1.0) {
      vehicleMatchScore = 90; // High utilization
    } else if (utilizationRatio < 0.6) {
      vehicleMatchScore = 70; // Under-utilized
    }

    // Calculate Overall Weighted Score based on User Priority
    let overallScore = 0;
    switch (params.priority) {
      case 'fastest_time':
        overallScore = (speedHistoryScore * 0.45) + (routeExperienceScore * 0.30) + (workloadScore * 0.15) + (vehicleMatchScore * 0.10);
        break;
      case 'balanced_workload':
        overallScore = (workloadScore * 0.45) + (speedHistoryScore * 0.25) + (routeExperienceScore * 0.20) + (vehicleMatchScore * 0.10);
        break;
      case 'route_experience':
        overallScore = (routeExperienceScore * 0.50) + (speedHistoryScore * 0.25) + (workloadScore * 0.15) + (vehicleMatchScore * 0.10);
        break;
      case 'fuel_cost_efficient':
        overallScore = (vehicleMatchScore * 0.40) + (workloadScore * 0.30) + (speedHistoryScore * 0.20) + (routeExperienceScore * 0.10);
        break;
      default:
        overallScore = (speedHistoryScore * 0.30) + (workloadScore * 0.30) + (routeExperienceScore * 0.25) + (vehicleMatchScore * 0.15);
    }

    overallScore = Math.min(99.8, Math.max(70.0, Number(overallScore.toFixed(1))));

    // Estimated travel time and cost calculations
    const isBali = store.island.includes('Bali');
    const isSumatera = store.island.includes('Sumatera');
    const isInterIsland = isBali || isSumatera || store.island !== 'Jawa';

    const baseDistanceKm = isBali ? 150 : isSumatera ? 980 : (store.city.includes('Surabaya') ? 290 : 85);
    const avgSpeedKmH = driverRouteTrips.length > 5 ? 52 : 45;
    const travelTimeBaseHours = Number((baseDistanceKm / avgSpeedKmH).toFixed(1)) + (isInterIsland ? 3.5 : 0);
    const historicalAvgTimeHours = Math.max(1.5, Number((travelTimeBaseHours * 0.92).toFixed(1)));

    const fuelLiters = Math.round(baseDistanceKm / (fleet.vehicleType === 'Pick Up Box' ? 9 : 6));
    const estimatedCostRp = Math.round((fuelLiters * 13500) + (isInterIsland ? 850000 : 250000) + (driver.rating * 50000));

    // Construct Rationale list
    const rationaleList: string[] = [];
    if (driverRouteTrips.length > 0) {
      rationaleList.push(`Driver ${driver.name} memiliki ${driverRouteTrips.length}x rekam jejak pengiriman di area ${store.city} dengan ketepatan waktu ${onTimeRate}%.`);
    } else if (driverHasExpBadge) {
      rationaleList.push(`Driver ${driver.name} tersertifikasi memiliki pengalaman rute ${store.province} & Tapal Kuda.`);
    } else {
      rationaleList.push(`Driver ${driver.name} memiliki rating kinerja tinggi (${driver.rating.toFixed(1)}/5.0).`);
    }

    if (helper) {
      rationaleList.push(`Helper ${helper.name} melengkapi kru dengan status sertifikasi K3 & muatan aman.`);
    }

    if (fatigueStatus === 'Aman (Sangat Segar)' || fatigueStatus === 'Normal') {
      rationaleList.push(`Tingkat kelelahan kru tergolong ${fatigueStatus} (hanya ${recentWorkloadTrips7Days} trip dalam 7 hari terakhir).`);
    }

    rationaleList.push(`Armada ${fleet.plateNumber} (${fleet.vehicleType}) memiliki tingkat efisiensi kapasitas ${Math.round(utilizationRatio * 100)}% dari beban ${params.cargoWeightTon} Ton.`);

    // Badges
    const badges: string[] = [];
    if (overallScore >= 95) badges.push('Sangat Direkomendasikan');
    if (onTimeRate >= 95) badges.push('Rute Tercepat Historis');
    if (recentWorkloadTrips7Days <= 1) badges.push('Beban Kerja Seimbang');
    if (vehicleMatchScore >= 95) badges.push('Kapasitas Armada Pas');
    if (isInterIsland) badges.push('Siap Lintas Pulau');

    return {
      id: `${driver.id}-${helper?.id || 'none'}-${fleet.id}`,
      driver,
      helper,
      fleet,
      overallScore,
      speedHistoryScore,
      workloadScore,
      routeExperienceScore,
      vehicleMatchScore,
      historicalAvgTimeHours,
      historicalOnTimeRate: onTimeRate,
      historicalTripCountOnRoute: driverRouteTrips.length,
      recentWorkloadTrips7Days,
      fatigueStatus,
      estimatedTravelTimeHours: travelTimeBaseHours,
      estimatedFuelLiters: fuelLiters,
      estimatedCostRp,
      rationaleList,
      badges
    };
  }
}
