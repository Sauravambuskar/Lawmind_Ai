import { useState, useEffect, useCallback } from "react";
import {
  getPermissions,
  loadPermissions as loadPerms,
  setRolePermissions as setRolePerms,
  hasAccess as checkAccess,
  subscribeToPermissions,
  type PermissionMap,
  type SectionId,
} from "@/lib/permissionStore";
import type { UserRole } from "@/hooks/auth.types";

/**
 * React hook for the permission store.
 * No external state library needed.
 */
export function usePermissions() {
  const [permissions, setPermissions] = useState<PermissionMap>(getPermissions());

  useEffect(() => {
    // Load on mount
    loadPerms();
    // Subscribe to changes
    const unsub = subscribeToPermissions(() => {
      setPermissions({ ...getPermissions() });
    });
    return unsub;
  }, []);

  const setRolePermissions = useCallback(async (role: UserRole, sections: SectionId[]) => {
    await setRolePerms(role, sections);
  }, []);

  const hasAccess = useCallback((role: UserRole, sectionId: string) => {
    return checkAccess(role, sectionId);
  }, [permissions]);

  return { permissions, setRolePermissions, hasAccess };
}
