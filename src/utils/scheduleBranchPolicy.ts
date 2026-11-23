import type { Schedule } from '../types';
import { branchStore } from '../services/branchStore';

type ScheduleWithBranch = Schedule & { branchId?: string };

/**
 * Resolve only grounded origin branch assignments. A destination's location is
 * NOT an origin branch, and missing origins must never silently become Banyuwangi.
 */
export function resolveScheduleBranchStrict(schedule: Schedule): string | null {
  const s = schedule as ScheduleWithBranch;
  const direct = String(s.branchId || '').trim();
  if (direct && branchStore.getBranchById(direct)) return direct;

  const mapped = branchStore.getExplicitScheduleBranchId(s.id);
  if (mapped) return mapped;

  const explicitFleet = String(s.fleet?.branchId || '').trim();
  if (explicitFleet && branchStore.getBranchById(explicitFleet)) return explicitFleet;

  const origin = String(s.originName || '').toLowerCase();
  const sidoarjo = /sidoarjo|surabaya/.test(origin);
  const banyuwangi = /banyuwangi|nusantara|sukowidi/.test(origin);
  if (sidoarjo && !banyuwangi) return 'cab-sidoarjo';
  if (banyuwangi && !sidoarjo) return 'cab-banyuwangi';
  return null;
}

/** Explicit snapshot branches must agree with the chosen cabang. */
export function resolveSnapshotBranchStrict(
  snapshot: { branchId?: string; id?: string },
  schedules: Schedule[]
): string | null {
  const direct = String(snapshot?.branchId || '').trim();
  if (direct && branchStore.getBranchById(direct)) return direct;
  const schedule = snapshot?.id ? schedules.find(s => s.id === snapshot.id) : undefined;
  return schedule ? resolveScheduleBranchStrict(schedule) : null;
}
