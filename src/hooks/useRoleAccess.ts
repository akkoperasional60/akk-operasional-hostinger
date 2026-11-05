import { useState, useEffect, useCallback } from 'react';
import { UserProfile, UserRole } from '../types';
import { logisticsStore } from '../services/store';
import {
  canAccess,
  canEdit,
  getUserRoleDisplayTitle,
  hasRequiredRole,
  isDispatcherRole,
  isDriverRole,
  isReadOnlyAccess,
  isSuperAdminRole
} from '../utils/rbac';

export interface UseRoleAccessReturn {
  user: UserProfile;
  role: UserRole;
  roleTitle: string;
  isSupabaseAuthenticated: boolean;
  canManageFleet: (targetUser?: UserProfile) => boolean;
  isDriver: (targetUser?: UserProfile) => boolean;
  isAdmin: (targetUser?: UserProfile) => boolean;
  isDispatcher: (targetUser?: UserProfile) => boolean;
  hasRole: (allowedRoles: Array<UserRole | 'dispatcher' | 'manager'>, targetUser?: UserProfile) => boolean;
  canAccessModule: (moduleId: string, subMenuId?: string, targetUser?: UserProfile) => boolean;
  canEditModule: (moduleId: string, subMenuId?: string, targetUser?: UserProfile) => boolean;
  isReadOnlyModule: (moduleId: string, subMenuId?: string, targetUser?: UserProfile) => boolean;
}

/**
 * Custom RBAC hook providing reactive user state from the logistics store
 * along with role helper functions (`canManageFleet`, `isDriver`, `isAdmin`, `canEditModule`, `isReadOnlyModule`).
 */
export function useRoleAccess(): UseRoleAccessReturn {
  const [user, setUser] = useState<UserProfile>(() => logisticsStore.getCurrentUser());
  const [isSupabaseAuthenticated, setIsSupabaseAuthenticated] = useState<boolean>(false);

  useEffect(() => {
    const unsubscribe = logisticsStore.subscribe(() => {
      const next = logisticsStore.getCurrentUser();
      setUser(prev => {
        if (
          prev.id === next.id &&
          prev.fullName === next.fullName &&
          prev.role === next.role &&
          prev.status === next.status &&
          prev.email === next.email &&
          JSON.stringify(prev.permissions) === JSON.stringify(next.permissions)
        ) {
          return prev;
        }
        return { ...next };
      });
      setIsSupabaseAuthenticated(Boolean(next?.id && next.id !== 'guest'));
    });

    setIsSupabaseAuthenticated(Boolean(logisticsStore.getCurrentUser()?.id && logisticsStore.getCurrentUser().id !== 'guest'));

    return () => {
      unsubscribe();
    };
  }, []);

  const isAdmin = useCallback(
    (targetUser?: UserProfile): boolean => {
      const activeUser = targetUser ?? user ?? logisticsStore.getCurrentUser();
      if (!activeUser || activeUser.status !== 'approved') return false;
      return isSuperAdminRole(activeUser.role);
    },
    [user]
  );

  const isDriver = useCallback(
    (targetUser?: UserProfile): boolean => {
      const activeUser = targetUser ?? user ?? logisticsStore.getCurrentUser();
      if (!activeUser) return false;
      return isDriverRole(activeUser.role);
    },
    [user]
  );

  const isDispatcher = useCallback(
    (targetUser?: UserProfile): boolean => {
      const activeUser = targetUser ?? user ?? logisticsStore.getCurrentUser();
      if (!activeUser || activeUser.status !== 'approved') return false;
      return isDispatcherRole(activeUser.role);
    },
    [user]
  );

  const canManageFleet = useCallback(
    (targetUser?: UserProfile): boolean => {
      const activeUser = targetUser ?? user ?? logisticsStore.getCurrentUser();
      if (!activeUser || activeUser.status !== 'approved' || activeUser.role === 'unassigned') {
        return false;
      }
      if (isDriverRole(activeUser.role)) {
        return false;
      }
      if (isSuperAdminRole(activeUser.role)) {
        return true;
      }
      return canEdit(activeUser, 'fleets') || canEdit(activeUser, 'schedules');
    },
    [user]
  );

  const hasRole = useCallback(
    (allowedRoles: Array<UserRole | 'dispatcher' | 'manager'>, targetUser?: UserProfile): boolean => {
      const activeUser = targetUser ?? user ?? logisticsStore.getCurrentUser();
      return hasRequiredRole(activeUser, allowedRoles);
    },
    [user]
  );

  const canAccessModule = useCallback(
    (moduleId: string, subMenuId?: string, targetUser?: UserProfile): boolean => {
      const activeUser = targetUser ?? user ?? logisticsStore.getCurrentUser();
      return canAccess(activeUser, moduleId, subMenuId);
    },
    [user]
  );

  const canEditModule = useCallback(
    (moduleId: string, subMenuId?: string, targetUser?: UserProfile): boolean => {
      const activeUser = targetUser ?? user ?? logisticsStore.getCurrentUser();
      return canEdit(activeUser, moduleId, subMenuId);
    },
    [user]
  );

  const isReadOnlyModule = useCallback(
    (moduleId: string, subMenuId?: string, targetUser?: UserProfile): boolean => {
      const activeUser = targetUser ?? user ?? logisticsStore.getCurrentUser();
      return isReadOnlyAccess(activeUser, moduleId, subMenuId);
    },
    [user]
  );

  return {
    user,
    role: user.role,
    roleTitle: getUserRoleDisplayTitle(user.role),
    isSupabaseAuthenticated,
    canManageFleet,
    isDriver,
    isAdmin,
    isDispatcher,
    hasRole,
    canAccessModule,
    canEditModule,
    isReadOnlyModule
  };
}

