import { create } from "zustand";
import { supabase } from "@/integrations/supabase/client";
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
  { id: "audit-logs", label: "Audit Logs", group: "Setup" },
  { id: "ai-settings", label: "AI Settings", group: "Setup" },
  { id: "reports", label: "Reports", group: "Setup" },
  { id: "permissions", label: "Permissions", group: "Setup" },
] as const;

export type SectionId = typeof APP_SECTIONS[number]["id"];

// Permission map: role → array of allowed section IDs
export type PermissionMap = Record<UserRole, SectionId[]>;

// Default permissions — super_admin and admin get everything
const ALL_SECTIONS: SectionId[] = APP_SECTIONS.map(s => s.id);

const DEFAULT_PERMISSIONS: PermissionMap = {
  super_admin: [...ALL_SECTIONS],
  admin: [...ALL_SECTIONS],
  agent: ["dashboard", "today", "clients", "cases", "hearings", "tasks", "documents", "notes", "contacts", "expenses"],
  lawyer: ["dashboard", "today", "clients", "advocates", "cases", "hearings", "evidence", "invoices", "documents", "impdocs", "notice-maker", "quick-docs", "expenses", "contacts", "notes", "tasks", "ai-agent"],
};

interface PermissionState {
  permissions: PermissionMap;
  loaded: boolean;
  loading: boolean;
  // Actions
  loadPermissions: () => Promise<void>;
  setRolePermissions: (role: UserRole, sections: SectionId[]) => Promise<void>;
  hasAccess: (role: UserRole, sectionId: string) => boolean;
}

export const usePermissionStore = create<PermissionState>((set, get) => ({
  permissions: DEFAULT_PERMISSIONS,
  loaded: false,
  loading: false,

  loadPermissions: async () => {
    if (get().loaded || get().loading) return;
    set({ loading: true });

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
      const session = (await supabase.auth.getSession()).data.session;
      const authToken = session?.access_token || supabaseKey;

      const res = await fetch(`${supabaseUrl}/rest/v1/role_permissions?select=*`, {
        headers: { "apikey": supabaseKey, "Authorization": `Bearer ${authToken}` },
      });

      if (res.ok) {
        const data = await res.json();
        if (data && data.length > 0) {
          const perms = { ...DEFAULT_PERMISSIONS };
          data.forEach((row: any) => {
            if (row.role && row.sections) {
              perms[row.role as UserRole] = row.sections;
            }
          });
          set({ permissions: perms, loaded: true, loading: false });
          return;
        }
      }
    } catch (e) {
      // Table might not exist yet — use defaults
    }

    set({ loaded: true, loading: false });
  },

  setRolePermissions: async (role: UserRole, sections: SectionId[]) => {
    set((state) => ({
      permissions: { ...state.permissions, [role]: sections },
    }));

    // Save to DB
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
      const session = (await supabase.auth.getSession()).data.session;
      const authToken = session?.access_token || supabaseKey;

      // Upsert
      await fetch(`${supabaseUrl}/rest/v1/role_permissions?role=eq.${role}`, {
        method: "DELETE",
        headers: { "apikey": supabaseKey, "Authorization": `Bearer ${authToken}` },
      });
      await fetch(`${supabaseUrl}/rest/v1/role_permissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": supabaseKey, "Authorization": `Bearer ${authToken}`, "Prefer": "return=minimal" },
        body: JSON.stringify({ role, sections }),
      });
    } catch (e) {
      // Silent — permissions still work from local state
    }
  },

  hasAccess: (role: UserRole, sectionId: string) => {
    // super_admin always has access to everything
    if (role === "super_admin") return true;
    const perms = get().permissions[role];
    if (!perms) return false;
    return perms.includes(sectionId as SectionId);
  },
}));
