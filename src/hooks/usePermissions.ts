import { useState, useEffect, useCallback } from "react";
import {
  getPermissions,
  loadPermissions as loadPerms,
  setRolePermissions as setRolePerms,
  hasUserAccess as checkAccess,
  setUserSections as setUserSecs,
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

  /**
   * `userSections` is the optional per-user override from profiles.sections.
   * When omitted or empty, role permissions apply.
   */
  const hasAccess = useCallback(
    (role: UserRole, sectionId: string, userSections?: string[] | null) => {
      return checkAccess(role, sectionId, userSections);
    },
    [permissions],
  );

  const setUserSections = useCallback(
    async (userId: string, sections: SectionId[] | null) => {
      await setUserSecs(userId, sections);
    },
    [],
  );

  return { permissions, setRolePermissions, setUserSections, hasAccess };
}
