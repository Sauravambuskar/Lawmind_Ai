import { restGet, restInsert, restDelete, restUpdate } from "@/lib/restClient";
import type { UserRole } from "@/hooks/auth.types";

// ── All app sections that can be controlled ──
export const APP_SECTIONS = [
  { id: "dashboard", label: "Dashboard", group: "Home" },
  { id: "today", label: "Today's Diary", group: "Home" },
  { id: "staff", label: "Staff Management", group: "Home" },
  { id: "clients", label: "Clients", group: "Practice" },
  { id: "advocates", label: "Advocates", group: "Practice" },
  { id: "advice", label: "Advice", group: "Practice" },
  { id: "cases", label: "Cases", group: "Practice" },
  { id: "hearings", label: "Hearings", group: "Practice" },
  { id: "hearing-calendar", label: "Hearing Calendar", group: "Practice" },
  { id: "evidence", label: "Evidence", group: "Practice" },
  { id: "invoices", label: "Invoices", group: "Practice" },
  { id: "documents", label: "Documents", group: "Practice" },
  { id: "impdocs", label: "Important Documents", group: "Practice" },
  { id: "notice-maker", label: "Notice Maker", group: "Practice" },
  { id: "quick-docs", label: "Quick Docs", group: "Practice" },
  { id: "expenses", label: "Expenses", group: "Practice" },
  { id: "contacts", label: "Contacts", group: "Practice" },
  { id: "notes", label: "Notes", group: "Practice" },
  { id: "tasks", label: "Tasks", group: "Practice" },
  { id: "ai-agent", label: "AI Agent", group: "Practice" },
  { id: "matters", label: "Matters", group: "Setup" },
  { id: "tags", label: "Tags", group: "Setup" },
  { id: "expense-types", label: "Expense Types", group: "Setup" },
  { id: "templates", label: "Templates", group: "Setup" },
  { id: "logs", label: "Audit Logs", group: "Setup" },
  { id: "ai-settings", label: "AI Settings", group: "Setup" },
  { id: "email", label: "Email Settings", group: "Setup" },
  { id: "reports", label: "Reports", group: "Setup" },
  { id: "permissions", label: "Permissions", group: "Setup" },
] as const;

export type SectionId = typeof APP_SECTIONS[number]["id"];
export type PermissionMap = Record<UserRole, SectionId[]>;

const ALL_SECTIONS = APP_SECTIONS.map(s => s.id) as SectionId[];

export const DEFAULT_PERMISSIONS: PermissionMap = {
  super_admin: [...ALL_SECTIONS],
  admin: [...ALL_SECTIONS],
  agent: ["dashboard", "today", "clients", "cases", "hearings", "hearing-calendar", "tasks", "documents", "notes", "contacts", "expenses"] as SectionId[],
  lawyer: ["dashboard", "today", "clients", "advocates", "cases", "hearings", "hearing-calendar", "evidence", "invoices", "documents", "impdocs", "notice-maker", "quick-docs", "expenses", "contacts", "notes", "tasks", "ai-agent"] as SectionId[],
};

// ── Simple module-level store (no external dependency) ──
let _permissions: PermissionMap = { ...DEFAULT_PERMISSIONS };
let _loaded = false;
let _loading = false;
const _listeners = new Set<() => void>();

function notify() { _listeners.forEach(fn => fn()); }

export function subscribeToPermissions(fn: () => void) {
  _listeners.add(fn);
  return () => { _listeners.delete(fn); };
}

export function getPermissions(): PermissionMap {
  return _permissions;
}

export function isPermissionsLoaded() { return _loaded; }

/** Load permissions from Supabase (once) */
export async function loadPermissions(): Promise<void> {
  if (_loaded || _loading) return;
  _loading = true;

  try {
    const data = await restGet<{ role: UserRole; sections: SectionId[] }>("role_permissions?select=*");
    if (Array.isArray(data) && data.length > 0) {
      const perms = { ...DEFAULT_PERMISSIONS };
      data.forEach((row) => {
        if (row.role && Array.isArray(row.sections)) {
          perms[row.role] = row.sections;
        }
      });
      _permissions = perms;
    }
  } catch {
    // Not logged in yet, or table missing — keep safe defaults
  }

  _loaded = true;
  _loading = false;
  notify();
}

/** Save permissions for a role */
export async function setRolePermissions(role: UserRole, sections: SectionId[]): Promise<void> {
  _permissions = { ..._permissions, [role]: sections };
  notify();

  try {
    await restDelete("role_permissions", `role=eq.${role}`);
    await restInsert("role_permissions", { role, sections });
  } catch {
    // Silent — local state still applied
  }
}

/** Check if a role has access to a section */
export function hasAccess(role: UserRole, sectionId: string): boolean {
  if (role === "super_admin") return true;
  const perms = _permissions[role];
  if (!perms) return false;
  return perms.includes(sectionId as SectionId);
}

/**
 * Check access for a specific user. A per-user `sections` override (set when
 * the member was created) wins; otherwise fall back to role permissions.
 * Super admins always have full access.
 */
export function hasUserAccess(
  role: UserRole,
  sectionId: string,
  userSections?: string[] | null,
): boolean {
  if (role === "super_admin") return true;
  if (Array.isArray(userSections) && userSections.length > 0) {
    return userSections.includes(sectionId);
  }
  return hasAccess(role, sectionId);
}

/** Update a single user's section override. Pass null to revert to role defaults. */
export async function setUserSections(userId: string, sections: SectionId[] | null): Promise<void> {
  await restUpdate("profiles", `user_id=eq.${userId}`, { sections });
}
