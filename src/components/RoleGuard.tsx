import React from 'react';
import { ShieldAlert, Lock, ArrowRight } from 'lucide-react';
import { UserProfile, UserRole } from '../types';
import {
  canAccess,
  getUserRoleDisplayTitle,
  hasRequiredRole
} from '../utils/rbac';
import { useRoleAccess, UseRoleAccessReturn } from '../hooks/useRoleAccess';

export { useRoleAccess };
export type UseRoleAccessResult = UseRoleAccessReturn;

interface RoleGuardProps {
  allowedRoles: Array<UserRole | 'dispatcher' | 'manager'>;
  moduleId?: string;
  user?: UserProfile;
  fallback?: React.ReactNode;
  onRedirectToAllowed?: () => void;
  children: React.ReactNode;
}

/**
 * Declarative Frontend RBAC Guard Component
 * Restricts UI rendering to users whose assigned role matches allowedRoles.
 */
export const RoleGuard: React.FC<RoleGuardProps> = ({
  allowedRoles,
  moduleId,
  user: propUser,
  fallback,
  onRedirectToAllowed,
  children
}) => {
  const { user: hookUser } = useRoleAccess();
  const activeUser = propUser || hookUser;

  const isRoleAllowed = hasRequiredRole(activeUser, allowedRoles);
  const isModuleAllowed = moduleId ? canAccess(activeUser, moduleId) : true;

  if (isRoleAllowed && isModuleAllowed) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  return (
    <div className="bg-slate-900 border border-rose-500/30 rounded-2xl p-6 text-center max-w-lg mx-auto my-8 space-y-4 shadow-xl">
      <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto">
        <ShieldAlert className="w-6 h-6" />
      </div>
      <div className="space-y-1.5">
        <div className="text-xs font-bold uppercase tracking-wider text-rose-400 flex items-center justify-center gap-1.5">
          <Lock className="w-3.5 h-3.5" />
          <span>Pembatasan Akses Berbasis Peran (RBAC &amp; Hostinger MySQL)</span>
        </div>
        <h3 className="text-base font-black text-white">
          Akses Modul Dibatasi untuk Peran Anda
        </h3>
        <p className="text-xs text-slate-400 leading-relaxed">
          Akun Anda (<strong className="text-slate-200">{activeUser.fullName}</strong>) saat ini terdaftar sebagai{' '}
          <strong className="text-amber-400">{getUserRoleDisplayTitle(activeUser.role)}</strong>. Halaman ini memerlukan hak akses{' '}
          <strong className="text-white">{allowedRoles.join(' / ').toUpperCase()}</strong>.
        </p>
      </div>
      {onRedirectToAllowed && (
        <button
          type="button"
          onClick={onRedirectToAllowed}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition cursor-pointer"
        >
          <span>Kembali ke Portal Sesuai Role</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};
