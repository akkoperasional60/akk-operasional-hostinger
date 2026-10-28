import { Crew, Schedule } from '../types';
import { DailyScheduleRoute } from '../components/CrewSimulationModal';

export interface RouteAreaInfo {
  areaKey: string;
  displayName: string;
  cluster: string;
}

/**
 * Normalizes route destination to an Area Key & Display Name
 */
export function extractRouteArea(routeName: string): RouteAreaInfo {
  const lower = routeName.toLowerCase();

  if (lower.includes('denpasar 1')) {
    return { areaKey: 'denpasar_1', displayName: 'Denpasar 1 (Bali)', cluster: 'Bali - Denpasar' };
  }
  if (lower.includes('denpasar 2')) {
    return { areaKey: 'denpasar_2', displayName: 'Denpasar 2 (Bali)', cluster: 'Bali - Denpasar' };
  }
  if (lower.includes('denpasar')) {
    return { areaKey: 'denpasar', displayName: 'Denpasar (Bali)', cluster: 'Bali - Denpasar' };
  }
  if (lower.includes('singaraja')) {
    return { areaKey: 'singaraja', displayName: 'Singaraja (Bali)', cluster: 'Bali - Singaraja' };
  }
  if (lower.includes('negara')) {
    return { areaKey: 'negara', displayName: 'Negara (Bali Barat)', cluster: 'Bali - Negara' };
  }
  if (lower.includes('jember selatan')) {
    return { areaKey: 'jember_selatan', displayName: 'Jember Selatan', cluster: 'Jember' };
  }
  if (lower.includes('jember barat')) {
    return { areaKey: 'jember_barat', displayName: 'Jember Barat', cluster: 'Jember' };
  }
  if (lower.includes('jember kota') || lower.includes('jember')) {
    return { areaKey: 'jember_kota', displayName: 'Jember Kota', cluster: 'Jember' };
  }
  if (lower.includes('situbondo') && lower.includes('bondowoso')) {
    return { areaKey: 'situbondo_bondowoso', displayName: 'Situbondo - Bondowoso', cluster: 'Tapal Kuda' };
  }
  if (lower.includes('situbondo')) {
    return { areaKey: 'situbondo', displayName: 'Situbondo', cluster: 'Tapal Kuda' };
  }
  if (lower.includes('bondowoso')) {
    return { areaKey: 'bondowoso', displayName: 'Bondowoso', cluster: 'Tapal Kuda' };
  }
  if (lower.includes('genteng')) {
    return { areaKey: 'genteng', displayName: 'Genteng', cluster: 'Banyuwangi Selatan' };
  }
  if (lower.includes('rogojampi')) {
    return { areaKey: 'rogojampi', displayName: 'Rogojampi', cluster: 'Banyuwangi Tengah' };
  }
  if (lower.includes('muncar')) {
    return { areaKey: 'muncar', displayName: 'Muncar', cluster: 'Banyuwangi Timur' };
  }
  if (lower.includes('sumberayu')) {
    return { areaKey: 'sumberayu', displayName: 'Sumberayu', cluster: 'Banyuwangi Selatan' };
  }
  if (lower.includes('galekan')) {
    return { areaKey: 'galekan', displayName: 'Galekan', cluster: 'Banyuwangi Selatan' };
  }
  if (lower.includes('purwo')) {
    return { areaKey: 'purwo', displayName: 'Purwoharjo', cluster: 'Banyuwangi Selatan' };
  }
  if (lower.includes('jajag')) {
    return { areaKey: 'jajag', displayName: 'Jajag', cluster: 'Banyuwangi Selatan' };
  }
  if (lower.includes('srono')) {
    return { areaKey: 'srono', displayName: 'Srono', cluster: 'Banyuwangi Tengah' };
  }
  if (lower.includes('kalibaru')) {
    return { areaKey: 'kalibaru', displayName: 'Kalibaru', cluster: 'Banyuwangi Barat' };
  }
  if (lower.includes('sanggar')) {
    return { areaKey: 'sanggar', displayName: 'Pesanggaran', cluster: 'Banyuwangi Selatan' };
  }
  if (lower.includes('sempu')) {
    return { areaKey: 'sempu', displayName: 'Sempu', cluster: 'Banyuwangi Tengah' };
  }
  if (lower.includes('ketapang') || lower.includes('wongsorejo')) {
    return { areaKey: 'ketapang_wongsorejo', displayName: 'Ketapang - Wongsorejo', cluster: 'Banyuwangi Utara' };
  }
  if (lower.includes('songgon')) {
    return { areaKey: 'songgon', displayName: 'Songgon', cluster: 'Banyuwangi Barat' };
  }
  if (lower.includes('grosir')) {
    return { areaKey: 'grosir', displayName: 'Grosir Hub BWI', cluster: 'Banyuwangi Kota' };
  }

  // Fallback to route name
  return { areaKey: lower.replace(/[^a-z0-9]/g, '_'), displayName: routeName, cluster: 'Lokal' };
}

export interface AreaRepetitionConflict {
  crewId: string;
  crewName: string;
  roleType: 'Driver Utama' | 'Helper / Kernet';
  field: 'driverId' | 'helperId';
  targetRouteId: string;
  targetRouteName: string;
  targetDay: string;
  areaName: string;
  previousRouteName: string;
  previousDay: string;
  previousPeriodLabel?: string;
  isCrossWeek?: boolean;
  eligibleAlternatives: Crew[];
  isWeekMandatedRule?: boolean;
}

/**
 * Checks for consecutive week conflicts for a crew in the same area.
 */
export function checkConsecutiveWeekConflict(
  targetDate: string,
  targetAreaName: string,
  candidateCrewId: string,
  field: 'driverId' | 'helperId',
  allSchedules: Schedule[],
  allCrews: Crew[]
): AreaRepetitionConflict | null {
  const targetDateObj = new Date(targetDate);
  const targetAreaInfo = extractRouteArea(targetAreaName);
  
  // Helper to get week number
  const getWeekNumber = (date: Date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    return Math.ceil((((d.getTime() - new Date(d.getFullYear(), 0, 1).getTime()) / 8.64e7) + 1) / 7);
  };
  
  const targetWeek = getWeekNumber(targetDateObj);
  
  // Check previous week
  const conflictSchedule = allSchedules.find(s => {
    const sDate = new Date(s.departureDate);
    const sWeek = getWeekNumber(sDate);
    if (sWeek !== targetWeek - 1) return false;
    
    const assignedId = field === 'driverId' ? s.crewId : s.crewHelperId;
    if (assignedId !== candidateCrewId) return false;
    
    const sArea = extractRouteArea(s.store?.storeName || ''); // Need area from store
    return sArea.areaKey === targetAreaInfo.areaKey;
  });
  
  if (conflictSchedule) {
      const candidateCrew = allCrews.find(c => c.id === candidateCrewId);
      if (!candidateCrew) return null;

      return {
          crewId: candidateCrewId,
          crewName: candidateCrew.name,
          roleType: field === 'driverId' ? 'Driver Utama' : 'Helper / Kernet',
          field: field,
          targetRouteId: 'new-id',
          targetRouteName: targetAreaName,
          targetDay: targetDateObj.toDateString(),
          areaName: targetAreaInfo.displayName,
          previousRouteName: conflictSchedule.store?.storeName || 'Unknown',
          previousDay: new Date(conflictSchedule.departureDate).toDateString(),
          previousPeriodLabel: `Pekan ${getWeekNumber(new Date(conflictSchedule.departureDate))}`,
          isCrossWeek: true,
          eligibleAlternatives: [], // Simplified for now
          isWeekMandatedRule: false
      };
  }
  
  return null;
}

/**
 * Checks whether candidateCrew has already been assigned to the same area previously in the week,
 * or in another week across the 4-week simulation cycle.
 */
export function checkAreaRepetitionConflict(
  targetRouteId: string,
  targetRouteName: string,
  targetDay: string,
  candidateCrewId: string,
  field: 'driverId' | 'helperId',
  allRoutes: DailyScheduleRoute[],
  allCrews: Crew[],
  selectedWeek?: number,
  allWeeksData?: Record<number, DailyScheduleRoute[]>
): AreaRepetitionConflict | null {
  if (!candidateCrewId) return null;

  const targetAreaInfo = extractRouteArea(targetRouteName);
  const candidateCrew = allCrews.find(c => c.id === candidateCrewId);
  if (!candidateCrew) return null;

  // 1. First, check within the current week's routes
  const previousSameAreaRouteInWeek = allRoutes.find(r => {
    if (r.id === targetRouteId) return false;
    const assignedId = field === 'driverId' ? r.driverId : r.helperId;
    if (assignedId !== candidateCrewId) return false;

    const area = extractRouteArea(r.route);
    return area.areaKey === targetAreaInfo.areaKey || r.route.toLowerCase() === targetRouteName.toLowerCase();
  });

  // Check if this is an official week-mandated rule where user explicitly required the same crew:
  // Week 1: Denpasar 1 Senin & Rabu (same driver & helper)
  // Week 2: Singaraja Selasa & Susulan Singaraja Kamis (same driver & helper)
  // Week 3: Klaster Jember (Jember Selatan, Jember Barat, Jember Kota)
  // Week 4: Tapal Kuda (Situbondo/Bondowoso, Susulan, Negara)
  let isWeekMandated = false;
  if (previousSameAreaRouteInWeek) {
    if (selectedWeek === 1 && targetRouteName.includes('Denpasar 1') && previousSameAreaRouteInWeek.route.includes('Denpasar 1')) {
      isWeekMandated = true;
    }
    if (selectedWeek === 2 && targetRouteName.includes('Singaraja') && previousSameAreaRouteInWeek.route.includes('Singaraja')) {
      isWeekMandated = true;
    }
    if (selectedWeek === 3 && targetRouteName.includes('Jember') && previousSameAreaRouteInWeek.route.includes('Jember')) {
      isWeekMandated = true;
    }
    if (selectedWeek === 4 && (targetRouteName.includes('Situbondo') || targetRouteName.includes('Bondowoso')) && (previousSameAreaRouteInWeek.route.includes('Situbondo') || previousSameAreaRouteInWeek.route.includes('Bondowoso'))) {
      isWeekMandated = true;
    }
  }

  // 2. If no conflict in the current week, check cross-week history across allWeeksData
  let crossWeekConflict: { weekNum: number; route: DailyScheduleRoute } | null = null;
  if (!previousSameAreaRouteInWeek && allWeeksData) {
    for (const [wStr, wRoutes] of Object.entries(allWeeksData)) {
      const wNum = parseInt(wStr, 10);
      if (wNum === selectedWeek) continue; // Skip current week as checked above

      const match = wRoutes.find(r => {
        const assignedId = field === 'driverId' ? r.driverId : r.helperId;
        if (assignedId !== candidateCrewId) return false;
        const area = extractRouteArea(r.route);
        return area.areaKey === targetAreaInfo.areaKey;
      });

      if (match) {
        crossWeekConflict = { weekNum: wNum, route: match };
        break;
      }
    }
  }

  if (!previousSameAreaRouteInWeek && !crossWeekConflict) {
    return null;
  }

  // Find eligible alternative crews of same role who have NEVER been assigned to this area in this week (and preferably across weeks)
  const isHelperRole = field === 'helperId';
  const rolePool = allCrews.filter(c => {
    if (isHelperRole) {
      return c.role.includes('Helper') || c.role === 'Kernet / Helper';
    }
    return !c.role.includes('Helper') && c.role !== 'Kernet / Helper';
  });

  // Filter out any crew who already has a route in this area in current week
  const eligibleAlternatives = rolePool.filter(c => {
    if (c.id === candidateCrewId) return false;
    const hasAreaHistoryInWeek = allRoutes.some(r => {
      const assignedId = field === 'driverId' ? r.driverId : r.helperId;
      if (assignedId !== c.id) return false;
      const area = extractRouteArea(r.route);
      return area.areaKey === targetAreaInfo.areaKey || r.route.toLowerCase() === targetRouteName.toLowerCase();
    });
    return !hasAreaHistoryInWeek;
  });

  if (previousSameAreaRouteInWeek) {
    return {
      crewId: candidateCrewId,
      crewName: candidateCrew.name,
      roleType: isHelperRole ? 'Helper / Kernet' : 'Driver Utama',
      field,
      targetRouteId,
      targetRouteName,
      targetDay,
      areaName: targetAreaInfo.displayName,
      previousRouteName: previousSameAreaRouteInWeek.route,
      previousDay: `${previousSameAreaRouteInWeek.day} (Pekan ${selectedWeek || 1})`,
      previousPeriodLabel: `Pekan ${selectedWeek || 1}`,
      isCrossWeek: false,
      eligibleAlternatives,
      isWeekMandatedRule: isWeekMandated
    };
  }

  if (crossWeekConflict) {
    return {
      crewId: candidateCrewId,
      crewName: candidateCrew.name,
      roleType: isHelperRole ? 'Helper / Kernet' : 'Driver Utama',
      field,
      targetRouteId,
      targetRouteName,
      targetDay,
      areaName: targetAreaInfo.displayName,
      previousRouteName: crossWeekConflict.route.route,
      previousDay: `${crossWeekConflict.route.day} (Pekan ${crossWeekConflict.weekNum})`,
      previousPeriodLabel: `Pekan ${crossWeekConflict.weekNum}`,
      isCrossWeek: true,
      eligibleAlternatives,
      isWeekMandatedRule: false
    };
  }

  return null;
}

/**
 * Audits all routes in a week for repeated area assignments per driver or helper,
 * accounting for official week mandates.
 */
export function auditWeekAreaRotations(
  routes: DailyScheduleRoute[],
  crews: Crew[],
  weekNum?: number
): {
  totalRoutes: number;
  repeatedAssignmentsCount: number;
  conflicts: {
    crewName: string;
    role: string;
    area: string;
    routesDesc: string;
    isMandated?: boolean;
  }[];
  isFullyVaried: boolean;
} {
  const driverAreaMap = new Map<string, { area: string; routeId: string; route: string; day: string }[]>();
  const helperAreaMap = new Map<string, { area: string; routeId: string; route: string; day: string }[]>();

  routes.forEach(r => {
    const area = extractRouteArea(r.route).displayName;
    if (r.driverId) {
      const list = driverAreaMap.get(r.driverId) || [];
      list.push({ area, routeId: r.id, route: r.route, day: r.day });
      driverAreaMap.set(r.driverId, list);
    }
    if (r.helperId) {
      const list = helperAreaMap.get(r.helperId) || [];
      list.push({ area, routeId: r.id, route: r.route, day: r.day });
      helperAreaMap.set(r.helperId, list);
    }
  });

  const conflicts: { crewName: string; role: string; area: string; routesDesc: string; isMandated?: boolean }[] = [];

  const checkMap = (map: Map<string, { area: string; routeId: string; route: string; day: string }[]>, roleLabel: string) => {
    map.forEach((list, crewId) => {
      const crew = crews.find(c => c.id === crewId);
      const crewName = crew ? crew.name : crewId;

      // Group by area
      const byArea = new Map<string, { route: string; day: string }[]>();
      list.forEach(item => {
        const existing = byArea.get(item.area) || [];
        existing.push(item);
        byArea.set(item.area, existing);
      });

      byArea.forEach((items, area) => {
        if (items.length > 1) {
          // Check if this is the week's intentional mandated pattern
          let isMandated = false;
          if (weekNum === 1 && area.includes('Denpasar 1')) {
            isMandated = true;
          } else if (weekNum === 2 && area.includes('Singaraja')) {
            isMandated = true;
          } else if (weekNum === 3 && area.includes('Jember')) {
            isMandated = true;
          } else if (weekNum === 4 && (area.includes('Situbondo') || area.includes('Bondowoso') || area.includes('Negara'))) {
            isMandated = true;
          }

          conflicts.push({
            crewName,
            role: roleLabel,
            area,
            routesDesc: items.map(it => `${it.day} (${it.route})`).join(' & '),
            isMandated
          });
        }
      });
    });
  };

  checkMap(driverAreaMap, 'Driver');
  checkMap(helperAreaMap, 'Helper');

  // Unintentional conflicts only
  const unexpectedConflicts = conflicts.filter(c => !c.isMandated);

  return {
    totalRoutes: routes.length,
    repeatedAssignmentsCount: unexpectedConflicts.length,
    conflicts,
    isFullyVaried: unexpectedConflicts.length === 0
  };
}
