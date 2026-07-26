import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Shield, Check, X, Save } from "lucide-react";
import { useRole } from "@/hooks/useRole";
import { usePermissions } from "@/hooks/usePermissions";
import { APP_SECTIONS, type SectionId } from "@/lib/permissionStore";
import type { UserRole } from "@/hooks/auth.types";

const ROLES: { id: UserRole; label: string; color: string }[] = [
  { id: "super_admin", label: "Super Admin", color: "text-purple-600" },
  { id: "admin", label: "Admin", color: "text-blue-600" },
  { id: "agent", label: "Agent", color: "text-emerald-600" },
  { id: "lawyer", label: "Lawyer", color: "text-amber-600" },
];

const GROUPS = [...new Set(APP_SECTIONS.map(s => s.group))];

export default function PermissionsPage() {
  const { isAdminOrAbove } = useRole();
  const { permissions, setRolePermissions } = usePermissions();
  const [localPerms, setLocalPerms] = useState(permissions);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setLocalPerms(permissions); }, [permissions]);

  const toggle = (role: UserRole, sectionId: SectionId) => {
    if (role === "super_admin") return; // Can't restrict super admin
    setLocalPerms(prev => {
      const current = prev[role] || [];
      const next = current.includes(sectionId)
        ? current.filter(s => s !== sectionId)
        : [...current, sectionId];
      return { ...prev, [role]: next };
    });
  };

  const toggleAll = (role: UserRole, group: string) => {
    if (role === "super_admin") return;
    const groupSections = APP_SECTIONS.filter(s => s.group === group).map(s => s.id);
    const current = localPerms[role] || [];
    const allSelected = groupSections.every(s => current.includes(s));
    setLocalPerms(prev => {
      const next = allSelected
        ? current.filter(s => !groupSections.includes(s as SectionId))
        : [...new Set([...current, ...groupSections])];
      return { ...prev, [role]: next as SectionId[] };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    for (const role of ROLES) {
      if (role.id === "super_admin") continue;
      await setRolePermissions(role.id, localPerms[role.id]);
    }
    setSaving(false);
    toast.success("Permissions saved successfully");
  };

  if (!isAdminOrAbove) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Shield className="w-16 h-16 text-muted-foreground opacity-30 mb-4" />
        <h2 className="text-xl font-bold text-foreground">Access Denied</h2>
        <p className="text-muted-foreground mt-2">Only Admins can manage permissions.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <PageHeader title="Role Permissions" breadcrumbs={[{ label: "Dashboard", path: "/" }, { label: "Setup", path: "/setup" }, { label: "Permissions" }]} />
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          <Save className="w-4 h-4" />{saving ? "Saving..." : "Save Permissions"}
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">Control which sections each role can access. Super Admin always has full access.</p>

      {/* Permission Matrix */}
      <Card className="border border-border shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Shield className="w-5 h-5 text-primary" />Access Control Matrix</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 border-b border-border">
                <tr>
                  <th className="text-left py-3 px-4 font-semibold text-[11px] uppercase tracking-widest min-w-[180px]">Section</th>
                  {ROLES.map(r => (
                    <th key={r.id} className={`text-center py-3 px-3 font-semibold text-[11px] uppercase tracking-widest ${r.color}`}>{r.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {GROUPS.map(group => (
                  <>
                    {/* Group header row */}
                    <tr key={`group-${group}`} className="bg-muted/20">
                      <td className="py-2 px-4 font-bold text-xs text-muted-foreground uppercase tracking-widest">{group}</td>
                      {ROLES.map(r => (
                        <td key={`${group}-${r.id}`} className="text-center py-2">
                          {r.id !== "super_admin" && (
                            <button
                              onClick={() => toggleAll(r.id, group)}
                              className="text-[9px] text-primary hover:underline font-semibold"
                            >
                              Toggle All
                            </button>
                          )}
                        </td>
                      ))}
                    </tr>
                    {/* Section rows */}
                    {APP_SECTIONS.filter(s => s.group === group).map(section => (
                      <tr key={section.id} className="border-b border-border/50 hover:bg-muted/10">
                        <td className="py-2.5 px-4 font-medium text-foreground">{section.label}</td>
                        {ROLES.map(r => {
                          const hasIt = r.id === "super_admin" ? true : (localPerms[r.id] || []).includes(section.id);
                          return (
                            <td key={`${section.id}-${r.id}`} className="text-center py-2.5">
                              <button
                                onClick={() => toggle(r.id, section.id)}
                                disabled={r.id === "super_admin"}
                                className={`w-7 h-7 rounded-md inline-flex items-center justify-center transition-colors ${
                                  hasIt
                                    ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600"
                                    : "bg-red-50 dark:bg-red-900/20 text-red-400"
                                } ${r.id === "super_admin" ? "opacity-50 cursor-not-allowed" : "hover:opacity-80 cursor-pointer"}`}
                              >
                                {hasIt ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
