import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { restGet } from "@/lib/restClient";
import type { TaskRow } from "@/lib/tasks";

/**
 * Who may do what with tasks.
 * - Admins / super admins: everything.
 * - Members granted "task-assign" (on their role in Permissions, or individually on the member):
 *   assign, unassign, edit and delete any task.
 * - Members granted "task-dashboard": open the Task Progress Dashboard.
 * - Everyone else: create tasks for themselves, and update progress on tasks assigned to or created by them.
 */
export function useTaskPrivileges() {
  const { user, role } = useAuth();
  const { permissions } = usePermissions();
  const isAdminOrAbove = role === "admin" || role === "super_admin";

  // profiles.sections is not loaded into the auth profile, so read this member's own grants directly.
  const { data: ownSections = [] } = useQuery({
    queryKey: ["own-sections", user?.id],
    queryFn: async () => {
      const rows = await restGet<{ sections: string[] | null }>(`profiles?select=sections&user_id=eq.${user!.id}`);
      return Array.isArray(rows[0]?.sections) ? rows[0].sections : [];
    },
    enabled: !!user?.id && !isAdminOrAbove,
    staleTime: 5 * 60 * 1000,
  });

  const granted = (section: string) =>
    isAdminOrAbove || (permissions[role] ?? []).includes(section as never) || ownSections.includes(section);

  const canAssign = granted("task-assign");
  const canViewDashboard = granted("task-dashboard");

  const canManageTask = (t: Pick<TaskRow, "created_by">) => canAssign || (!!user && t.created_by === user.id);
  const canUpdateProgress = (t: Pick<TaskRow, "created_by" | "assigned_to">) =>
    canManageTask(t) || (!!user && t.assigned_to === user.id);

  return { userId: user?.id ?? "", isAdminOrAbove, canAssign, canViewDashboard, canManageTask, canUpdateProgress };
}
