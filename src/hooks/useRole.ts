import { useAuth } from "./useAuth";
import type { UserRole } from "./auth.types";

export type { UserRole };

const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  agent: 'Agent',
  lawyer: 'Lawyer',
};

const ROLE_BADGE: Record<UserRole, string> = {
  super_admin: 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-500/15 dark:text-purple-300 dark:border-purple-500/30',
  admin: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30',
  agent: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30',
  lawyer: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30',
};

const ROLE_DOT: Record<UserRole, string> = {
  super_admin: 'bg-purple-500',
  admin: 'bg-blue-500',
  agent: 'bg-emerald-500',
  lawyer: 'bg-amber-500',
};

export function getRoleLabel(role: UserRole) {
  return ROLE_LABELS[role] ?? role;
}

export function getRoleBadge(role: UserRole) {
  return ROLE_BADGE[role] ?? 'bg-gray-100 text-gray-700 border-gray-200';
}

export function getRoleDot(role: UserRole) {
  return ROLE_DOT[role] ?? 'bg-gray-400';
}

export function useRole() {
  const { role, profile } = useAuth();

  const isSuperAdmin = role === 'super_admin';
  const isAdmin = role === 'admin';
  const isAdminOrAbove = isSuperAdmin || isAdmin;
  const isAgent = role === 'agent';
  const isLawyer = role === 'lawyer';

  const canManageUser = (targetRole: UserRole) => {
    if (isSuperAdmin) return true;
    if (isAdmin) return targetRole !== 'super_admin' && targetRole !== 'admin';
    return false;
  };

  const canAssignRole = (targetRole: UserRole) => {
    if (isSuperAdmin) return true;
    if (isAdmin) return targetRole === 'agent' || targetRole === 'lawyer';
    return false;
  };

  return {
    role,
    profile,
    isSuperAdmin,
    isAdmin,
    isAdminOrAbove,
    isAgent,
    isLawyer,
    canManageUser,
    canAssignRole,
    roleLabel: getRoleLabel(role),
    roleBadge: getRoleBadge(role),
  };
}
