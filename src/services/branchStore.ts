import { UserPermissions, UserRole } from '../types';
import { getDefaultPermissionsForRole } from '../utils/rbac';

export interface BranchRecord {
  id: string;
  name: string;
  warehouseName: string;
  slug: string;
  sortOrder: number;
  template: 'Classic / Default' | 'Modern B2B' | 'Enterprise WMS';
  isActive: boolean;
  isFrontlineActive: boolean;
  city: string;
  address: string;
  phone?: string;
  createdAt: string;
}

export interface UserBranchPermissionEntry {
  branchId: string;
  enabled: boolean;
  allAccess: boolean;
  modules: UserPermissions['modules'];
}

export type UserBranchPermissionsMap = Record<string, Record<string, UserBranchPermissionEntry>>;

const LS_BRANCHES_KEY = 'akk_multi_store_branches_v1';
const LS_ACTIVE_BRANCH_KEY = 'akk_active_origin_branch_v1';
const LS_USER_BRANCH_PERMS_KEY = 'akk_user_branch_permissions_v1';
const LS_ENTITY_BRANCH_MAP_KEY = 'akk_entity_branch_assignments_v1';

export interface EntityBranchAssignments {
  schedules: Record<string, string>; // scheduleId -> branchId
  fleets: Record<string, string>;    // fleetId -> branchId
  crews: Record<string, string>;     // crewId -> branchId
  inventory: Record<string, string>; // skuId -> branchId
}

const DEFAULT_BRANCHES: BranchRecord[] = [
  {
    id: 'cab-sidoarjo',
    name: 'Sidoarjo',
    warehouseName: 'Gudang Sidoarjo',
    slug: 'sidoarjo',
    sortOrder: 1,
    template: 'Classic / Default',
    isActive: true,
    isFrontlineActive: true,
    city: 'Sidoarjo',
    address: 'Kawasan Industri Rungkut / Berbek, Sidoarjo, Jawa Timur',
    phone: '031-8912345',
    createdAt: '2026-01-10'
  },
  {
    id: 'cab-banyuwangi',
    name: 'Nusantara',
    warehouseName: 'Gudang Nusantara',
    slug: 'banyuwangi',
    sortOrder: 2,
    template: 'Classic / Default',
    isActive: true,
    isFrontlineActive: true,
    city: 'Banyuwangi',
    address: 'Jl. Argopuro No. 60, Ketapang - Banyuwangi, Jawa Timur',
    phone: '0333-421889',
    createdAt: '2026-01-01'
  }
];

class BranchStoreService {
  private branches: BranchRecord[] = [];
  private activeBranchId: string = 'ALL'; // 'ALL' or branch.id
  private userBranchPerms: UserBranchPermissionsMap = {};
  private entityBranches: EntityBranchAssignments = {
    schedules: {},
    fleets: {},
    crews: {},
    inventory: {}
  };
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    try {
      const rawBranches = localStorage.getItem(LS_BRANCHES_KEY);
      if (rawBranches) {
        const parsed = JSON.parse(rawBranches);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Filter out legacy NX / cab-jember and clean any legacy "Gudang Pusat" names
          const cleaned = parsed
            .filter(
              (b: BranchRecord) =>
                b &&
                b.id !== 'cab-jember' &&
                b.slug !== 'nx-jember' &&
                (b.name || '').trim().toUpperCase() !== 'NX'
            )
            .map((b: BranchRecord) => ({
              ...b,
              warehouseName: (b.warehouseName || `Gudang ${b.name}`).replace(/Gudang Pusat\s*/gi, 'Gudang ')
            }));
          this.branches = cleaned.length > 0 ? cleaned : [...DEFAULT_BRANCHES];
        } else {
          this.branches = [...DEFAULT_BRANCHES];
        }
      } else {
        this.branches = [...DEFAULT_BRANCHES];
      }
    } catch {
      this.branches = [...DEFAULT_BRANCHES];
    }

    try {
      const savedActive = localStorage.getItem(LS_ACTIVE_BRANCH_KEY);
      if (savedActive && (savedActive === 'ALL' || this.branches.some(b => b.id === savedActive))) {
        this.activeBranchId = savedActive;
      } else {
        this.activeBranchId = 'ALL';
      }
    } catch {
      this.activeBranchId = 'ALL';
    }

    try {
      const rawPerms = localStorage.getItem(LS_USER_BRANCH_PERMS_KEY);
      if (rawPerms) {
        this.userBranchPerms = JSON.parse(rawPerms) || {};
      }
    } catch {
      this.userBranchPerms = {};
    }

    try {
      const rawEntities = localStorage.getItem(LS_ENTITY_BRANCH_MAP_KEY);
      if (rawEntities) {
        const parsed = JSON.parse(rawEntities);
        this.entityBranches = {
          schedules: parsed?.schedules || {},
          fleets: parsed?.fleets || {},
          crews: parsed?.crews || {},
          inventory: parsed?.inventory || {}
        };
      }
    } catch {}

    this.saveToStorage();
  }

  private saveToStorage() {
    try {
      localStorage.setItem(LS_BRANCHES_KEY, JSON.stringify(this.branches));
      localStorage.setItem(LS_ACTIVE_BRANCH_KEY, this.activeBranchId);
      localStorage.setItem(LS_USER_BRANCH_PERMS_KEY, JSON.stringify(this.userBranchPerms));
      localStorage.setItem(LS_ENTITY_BRANCH_MAP_KEY, JSON.stringify(this.entityBranches));
    } catch {}
  }

  private notify() {
    this.saveToStorage();
    this.listeners.forEach(listener => listener());
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('akk-branch-updated'));
    }
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getBranches(): BranchRecord[] {
    return [...this.branches].sort((a, b) => a.sortOrder - b.sortOrder);
  }

  public getActiveBranches(): BranchRecord[] {
    return this.getBranches().filter(b => b.isActive);
  }

  public getBranchById(branchId: string): BranchRecord | undefined {
    if (!branchId) return undefined;
    return this.branches.find(
      b =>
        b.id === branchId ||
        b.slug === branchId ||
        b.name.toLowerCase() === branchId.toLowerCase()
    );
  }

  public getSelectedOriginBranchId(): string {
    if (this.activeBranchId !== 'ALL' && !this.branches.some(b => b.id === this.activeBranchId)) {
      this.activeBranchId = 'ALL';
    }
    return this.activeBranchId;
  }

  public getSelectedOriginBranch(): BranchRecord | null {
    if (this.activeBranchId === 'ALL') return null;
    return this.branches.find(b => b.id === this.activeBranchId) || null;
  }

  public setSelectedOriginBranchId(branchId: string) {
    this.activeBranchId = branchId;
    this.notify();
  }

  public setActiveBranchId(branchId: string) {
    this.setSelectedOriginBranchId(branchId);
  }

  public addBranch(input: {
    name: string;
    warehouseName?: string;
    slug?: string;
    sortOrder?: number;
    template?: BranchRecord['template'];
    isActive?: boolean;
    isFrontlineActive?: boolean;
    city?: string;
    address?: string;
  }): BranchRecord {
    const cleanName = input.name.trim();
    const autoSlug =
      (input.slug || '').trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-') ||
      cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') ||
      `cabang-${this.branches.length + 1}`;

    const newBranch: BranchRecord = {
      id: `cab-${autoSlug}-${Date.now().toString(36)}`,
      name: cleanName,
      warehouseName: input.warehouseName?.trim() || `Gudang ${cleanName}`,
      slug: autoSlug,
      sortOrder: input.sortOrder !== undefined ? Number(input.sortOrder) : this.branches.length + 1,
      template: input.template || 'Classic / Default',
      isActive: input.isActive !== undefined ? input.isActive : true,
      isFrontlineActive: input.isFrontlineActive !== undefined ? input.isFrontlineActive : true,
      city: input.city?.trim() || cleanName,
      address: input.address?.trim() || `Gudang Distribusi ${cleanName}`,
      createdAt: new Date().toISOString().slice(0, 10)
    };

    this.branches.push(newBranch);
    this.notify();
    return newBranch;
  }

  public updateBranch(branchId: string, patch: Partial<BranchRecord>): boolean {
    const idx = this.branches.findIndex(b => b.id === branchId);
    if (idx === -1) return false;
    this.branches[idx] = {
      ...this.branches[idx],
      ...patch
    };
    this.notify();
    return true;
  }

  public deleteBranch(branchId: string): boolean {
    if (this.branches.length <= 1) return false;
    const prevLen = this.branches.length;
    this.branches = this.branches.filter(b => b.id !== branchId);
    if (this.activeBranchId === branchId) {
      this.activeBranchId = 'ALL';
    }
    if (this.branches.length !== prevLen) {
      this.notify();
      return true;
    }
    return false;
  }

  // ============================================================
  // ENTITY <-> ORIGIN WAREHOUSE (CABANG) ASSIGNMENT & RESOLUTION
  // ============================================================
  public getFleetBranchId(fleetId: string, plateNumber?: string, initialCode?: string): string {
    const mapped = this.entityBranches.fleets[fleetId];
    if (mapped && this.branches.some(b => b.id === mapped)) {
      return mapped;
    }
    const code = `${initialCode || ''} ${plateNumber || ''}`.toUpperCase();
    if (code.includes('W ') || code.includes('L ') || code.includes('SDA')) {
      return 'cab-sidoarjo';
    }
    return 'cab-banyuwangi';
  }

  public setFleetBranchId(fleetId: string, branchId: string) {
    this.entityBranches.fleets[fleetId] = branchId;
    this.notify();
  }

  public getCrewBranchId(crewId: string, crewName?: string): string {
    const mapped = this.entityBranches.crews[crewId];
    if (mapped && this.branches.some(b => b.id === mapped)) {
      return mapped;
    }
    if (crewName && this.entityBranches.crews[crewName.toLowerCase()]) {
      const byName = this.entityBranches.crews[crewName.toLowerCase()];
      if (this.branches.some(b => b.id === byName)) return byName;
    }
    return 'cab-banyuwangi';
  }

  public setCrewBranchId(crewId: string, branchId: string, crewName?: string) {
    this.entityBranches.crews[crewId] = branchId;
    if (crewName) {
      this.entityBranches.crews[crewName.toLowerCase()] = branchId;
    }
    this.notify();
  }

  public getScheduleBranchId(scheduleId?: string, originName?: string, fleetId?: string): string {
    if (scheduleId) {
      const mapped = this.entityBranches.schedules[scheduleId];
      if (mapped && this.branches.some(b => b.id === mapped)) {
        return mapped;
      }
    }
    if (originName) {
      const lower = originName.toLowerCase();
      if (lower.includes('sidoarjo') || lower.includes('surabaya')) return 'cab-sidoarjo';
      if (lower.includes('nusantara') || lower.includes('banyuwangi')) return 'cab-banyuwangi';
      const customMatch = this.branches.find(
        b => lower.includes(b.name.toLowerCase()) || lower.includes(b.slug.toLowerCase())
      );
      if (customMatch) return customMatch.id;
    }
    if (fleetId && this.entityBranches.fleets[fleetId]) {
      const fltBranch = this.entityBranches.fleets[fleetId];
      if (this.branches.some(b => b.id === fltBranch)) return fltBranch;
    }
    return 'cab-banyuwangi';
  }

  public setScheduleBranchId(scheduleId: string, branchId: string) {
    this.entityBranches.schedules[scheduleId] = branchId;
    this.notify();
  }

  public getInventoryBranchId(skuId: string, cabangName?: string): string {
    const mapped = this.entityBranches.inventory[skuId];
    if (mapped && this.branches.some(b => b.id === mapped)) {
      return mapped;
    }
    if (cabangName) {
      const lower = cabangName.toLowerCase();
      const matched = this.branches.find(
        b => b.name.toLowerCase() === lower || b.slug.toLowerCase() === lower || b.city.toLowerCase() === lower
      );
      if (matched) return matched.id;
    }
    const num = parseInt(skuId.replace(/\D/g, '') || '1', 10);
    if (num % 5 === 0) return 'cab-sidoarjo';
    return 'cab-banyuwangi';
  }

  public setInventoryBranchId(skuId: string, branchId: string) {
    this.entityBranches.inventory[skuId] = branchId;
    this.notify();
  }

  public getFleetBranch(fleetId: string, plateNumber?: string, initialCode?: string): BranchRecord {
    const id = this.getFleetBranchId(fleetId, plateNumber, initialCode);
    return this.getBranchById(id) || this.branches[0] || DEFAULT_BRANCHES[1];
  }

  public setFleetBranch(fleetId: string, branchId: string) {
    this.setFleetBranchId(fleetId, branchId);
  }

  public getCrewBranch(crewId: string, crewName?: string): BranchRecord {
    const id = this.getCrewBranchId(crewId, crewName);
    return this.getBranchById(id) || this.branches[0] || DEFAULT_BRANCHES[1];
  }

  public setCrewBranch(crewId: string, branchId: string, crewName?: string) {
    this.setCrewBranchId(crewId, branchId, crewName);
  }

  public getScheduleBranch(scheduleId?: string, originName?: string, fleetId?: string): BranchRecord {
    const id = this.getScheduleBranchId(scheduleId, originName, fleetId);
    return this.getBranchById(id) || this.branches[0] || DEFAULT_BRANCHES[1];
  }

  public setScheduleBranch(scheduleId: string, branchId: string) {
    this.setScheduleBranchId(scheduleId, branchId);
  }

  public getInventoryBranch(skuId: string, cabangName?: string): BranchRecord {
    const id = this.getInventoryBranchId(skuId, cabangName);
    return this.getBranchById(id) || this.branches[0] || DEFAULT_BRANCHES[1];
  }

  public setInventoryBranch(skuId: string, branchId: string) {
    this.setInventoryBranchId(skuId, branchId);
  }

  // ============================================================
  // PER-USER, PER-BRANCH RBAC PERMISSIONS
  // ============================================================
  public getUserBranchPermissions(
    userId: string,
    role: UserRole,
    existingUserModules?: UserPermissions['modules']
  ): Record<string, UserBranchPermissionEntry> {
    const savedForUser = this.userBranchPerms[userId] || {};
    const result: Record<string, UserBranchPermissionEntry> = {};
    const roleDefaults = getDefaultPermissionsForRole(role);

    this.getBranches().forEach(branch => {
      if (savedForUser[branch.id]) {
        result[branch.id] = JSON.parse(JSON.stringify(savedForUser[branch.id]));
      } else {
        // Default: Nusantara (Banyuwangi) is enabled by default for existing AKK staff,
        // Super Admin gets all branches enabled
        const isDefaultEnabled = role === 'super_admin' || branch.id === 'cab-banyuwangi';
        const baseModules: UserPermissions['modules'] = {};

        Object.keys(roleDefaults).forEach(modId => {
          if (isDefaultEnabled) {
            const sourceMod = existingUserModules?.[modId] || roleDefaults[modId];
            baseModules[modId] = JSON.parse(JSON.stringify(sourceMod));
          } else {
            const emptySubs: Record<string, 'none' | 'read_only' | 'full_access'> = {};
            Object.keys(roleDefaults[modId]?.subMenus || {}).forEach(subId => {
              emptySubs[subId] = 'none';
            });
            baseModules[modId] = {
              enabled: false,
              subMenus: emptySubs
            };
          }
        });

        const activeCount = this.countActiveModulesInBranch(baseModules);
        const totalModules = Object.keys(roleDefaults).length;

        result[branch.id] = {
          branchId: branch.id,
          enabled: isDefaultEnabled && activeCount > 0,
          allAccess: isDefaultEnabled && activeCount === totalModules,
          modules: baseModules
        };
      }
    });

    return result;
  }

  public saveUserBranchPermissions(
    userId: string,
    branchPerms: Record<string, UserBranchPermissionEntry>
  ) {
    this.userBranchPerms[userId] = JSON.parse(JSON.stringify(branchPerms));
    this.notify();
  }

  public canUserAccessBranch(
    user: { id: string; role: UserRole; permissions?: UserPermissions } | null | undefined,
    branchId: string
  ): boolean {
    if (!user) return true;
    if (user.role === 'super_admin') return true;
    const perms = this.getUserBranchPermissions(user.id, user.role, user.permissions?.modules);
    return Boolean(perms[branchId]?.enabled);
  }

  public getAccessibleBranchesForUser(
    user?: { id: string; role: UserRole; permissions?: UserPermissions } | null
  ): BranchRecord[] {
    const active = this.getActiveBranches();
    if (!user || user.role === 'super_admin') return active;
    const filtered = active.filter(b => this.canUserAccessBranch(user, b.id));
    return filtered.length > 0 ? filtered : active;
  }

  public countActiveModulesInBranch(modules: UserPermissions['modules']): number {
    if (!modules) return 0;
    return Object.values(modules).filter(m => {
      if (!m || !m.enabled) return false;
      return Object.values(m.subMenus || {}).some(v => v === 'full_access' || v === 'read_only');
    }).length;
  }

  public countActiveSubMenusInModule(mod?: {
    enabled: boolean;
    subMenus: Record<string, 'read_only' | 'full_access' | 'none'>;
  }): number {
    if (!mod || !mod.enabled) return 0;
    return Object.values(mod.subMenus || {}).filter(v => v === 'full_access' || v === 'read_only').length;
  }

  public getUsersCountForBranch(
    branchId: string,
    usersOrTotalCount?: number | Array<{ id: string; role: UserRole; permissions?: UserPermissions; status?: string }>
  ): number {
    if (Array.isArray(usersOrTotalCount)) {
      let count = 0;
      usersOrTotalCount.forEach(u => {
        if (u.status === 'rejected') return;
        const perms = this.getUserBranchPermissions(u.id, u.role, u.permissions?.modules);
        if (perms[branchId]?.enabled) {
          count++;
        }
      });
      return count;
    }

    let customCount = 0;
    Object.values(this.userBranchPerms).forEach(userMap => {
      if (userMap[branchId]?.enabled) customCount++;
    });
    if (customCount > 0) return customCount;
    if (branchId === 'cab-banyuwangi') return typeof usersOrTotalCount === 'number' ? usersOrTotalCount : 29;
    return 1;
  }
}

export const branchStore = new BranchStoreService();
