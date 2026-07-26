import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, Shield, Users, UserCheck, Scale, UserCog, ChevronDown, Pencil, KeyRound, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { UserProfile, UserRole } from "@/hooks/auth.types";
import { useRole, getRoleLabel, getRoleBadge, getRoleDot } from "@/hooks/useRole";
import { toast } from "sonner";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EditUserModal, ResetPasswordModal, DeleteUserModal } from "@/components/UserActions";

const ROLES: UserRole[] = ['super_admin', 'admin', 'agent', 'lawyer'];
const FILTER_TABS = ['all', ...ROLES] as const;

const statCards = [
  { role: 'super_admin' as UserRole, label: 'Super Admins', icon: Shield, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-500/10' },
  { role: 'admin' as UserRole, label: 'Admins', icon: UserCog, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-500/10' },
  { role: 'agent' as UserRole, label: 'Agents', icon: UserCheck, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-500/10' },
  { role: 'lawyer' as UserRole, label: 'Lawyers', icon: Scale, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-500/10' },
];

function AddUserModal({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<UserRole>("agent");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Save the current admin session BEFORE creating user
      const { data: sessionData } = await supabase.auth.getSession();
      const adminSession = sessionData.session;

      if (!adminSession) {
        throw new Error("No active session. Please login again.");
      }

      // Create the new user (this will switch session to new user)
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName, role } },
      });

      if (error) {
        if (error.message.toLowerCase().includes("rate limit") || error.message.includes("429")) {
          throw new Error("Email rate limit reached. Wait a few minutes and try again.");
        }
        throw new Error(error.message);
      }

      // IMMEDIATELY restore the admin session (prevents switching to new user)
      const { error: restoreError } = await supabase.auth.setSession({
        access_token: adminSession.access_token,
        refresh_token: adminSession.refresh_token,
      });

      if (restoreError) {
        console.warn("Session restore warning:", restoreError.message);
        // Force reload to get admin back
        window.location.reload();
        return;
      }

      toast.success("User created successfully!");
      setOpen(false);
      onSuccess();
      setEmail("");
      setPassword("");
      setFullName("");
      setRole("agent");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="shrink-0 gap-2 h-9 text-sm">
          <UserCog className="w-4 h-4" />
          Add Member
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Member</DialogTitle>
          <DialogDescription>
            Create a new member and assign them a role. They will receive an email to verify their account.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input id="fullName" value={fullName} onChange={e => setFullName(e.target.value)} required placeholder="John Doe" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email address</Label>
            <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="john@example.com" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Temporary Password</Label>
            <Input id="password" type="text" value={password} onChange={e => setPassword(e.target.value)} required placeholder="Must be at least 6 characters" minLength={6} />
          </div>
          <div className="space-y-2">
            <Label>Role</Label>
            <Select value={role} onValueChange={(val) => setRole(val as UserRole)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="super_admin">Super Admin</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="lawyer">Lawyer</SelectItem>
                <SelectItem value="agent">Agent</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Creating..." : "Create Member"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function UsersPage() {
  const { user } = useAuth();
  const { isAdminOrAbove, isSuperAdmin, canManageUser, canAssignRole } = useRole();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<typeof FILTER_TABS[number]>('all');

  // Super admin modal states
  const [editMember, setEditMember] = useState<UserProfile | null>(null);
  const [resetMember, setResetMember] = useState<UserProfile | null>(null);
  const [deleteMember, setDeleteMember] = useState<UserProfile | null>(null);
  const refreshUsers = () => queryClient.invalidateQueries({ queryKey: ["users-profiles"] });

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["users-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as UserProfile[];
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: UserRole }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ role })
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users-profiles"] });
      toast.success("Role updated");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ userId, status }: { userId: string; status: 'active' | 'inactive' }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ status })
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users-profiles"] });
      toast.success("Status updated");
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (!isAdminOrAbove) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center gap-4">
        <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
          <Shield className="w-6 h-6 text-muted-foreground" />
        </div>
        <div>
          <h2 className="font-serif text-xl text-foreground mb-1">Access Restricted</h2>
          <p className="text-muted-foreground text-sm max-w-xs">
            User management is available to Admins and Super Admins only.
          </p>
        </div>
      </div>
    );
  }

  const counts = {
    all: users.length,
    super_admin: users.filter(u => u.role === 'super_admin').length,
    admin: users.filter(u => u.role === 'admin').length,
    agent: users.filter(u => u.role === 'agent').length,
    lawyer: users.filter(u => u.role === 'lawyer').length,
  };

  const filtered = users.filter(u => {
    const matchesFilter = filter === 'all' || u.role === filter;
    const q = search.toLowerCase();
    const matchesSearch = !q
      || (u.full_name || '').toLowerCase().includes(q)
      || (u.email || '').toLowerCase().includes(q);
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="User Management"
        breadcrumbs={[{ label: "Dashboard", path: "/" }, { label: "Staff" }, { label: "Users" }]}
      />

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-card border border-border rounded-lg p-4 flex items-center gap-3">
          <div className="p-2.5 bg-muted rounded-md shrink-0">
            <Users className="w-4 h-4 text-muted-foreground" />
          </div>
          <div>
            <p className="text-2xl font-serif text-foreground">{counts.all}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">Total</p>
          </div>
        </div>
        {statCards.map(sc => (
          <div key={sc.role} className="bg-card border border-border rounded-lg p-4 flex items-center gap-3">
            <div className={`p-2.5 rounded-md shrink-0 ${sc.bg}`}>
              <sc.icon className={`w-4 h-4 ${sc.color}`} />
            </div>
            <div>
              <p className="text-2xl font-serif text-foreground">{counts[sc.role]}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">{sc.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Table card */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">

        {/* Toolbar */}
        <div className="p-4 border-b border-border flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="flex items-center gap-1 bg-muted/40 rounded-md p-1 flex-wrap">
            {FILTER_TABS.map(tab => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`px-3 py-1.5 rounded-sm text-[12px] font-medium transition-colors whitespace-nowrap ${
                  filter === tab
                    ? 'bg-background shadow-sm text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab === 'all' ? 'All Members' : getRoleLabel(tab as UserRole)}
                <span className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full ${
                  filter === tab ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                }`}>
                  {counts[tab]}
                </span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative w-full sm:w-64 shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Search members..."
                className="pl-9 h-9 text-sm"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            {isSuperAdmin && (
              <AddUserModal onSuccess={() => queryClient.invalidateQueries({ queryKey: ["users-profiles"] })} />
            )}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 border-b border-border">
              <tr>
                <th className="text-left py-3 px-4 w-10">#</th>
                <th className="text-left py-3 px-4">Member</th>
                <th className="text-left py-3 px-4 hidden sm:table-cell">Role</th>
                <th className="text-left py-3 px-4 hidden lg:table-cell">Status</th>
                <th className="text-left py-3 px-4 hidden lg:table-cell">Joined</th>
                <th className="text-right py-3 px-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-sm text-muted-foreground">
                    Loading members...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-14 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Users className="w-8 h-8 text-muted-foreground/30" />
                      <p className="text-sm text-muted-foreground">No members found</p>
                    </div>
                  </td>
                </tr>
              ) : filtered.map((member, i) => {
                const isMe = member.user_id === user?.id;
                const canEdit = !isMe && canManageUser(member.role);

                return (
                  <tr key={member.id} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="py-4 px-4 text-muted-foreground text-xs font-mono">{i + 1}</td>

                    {/* Member */}
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 ${
                          isMe
                            ? 'bg-primary/10 text-primary border-2 border-primary/30'
                            : 'bg-muted text-muted-foreground border border-border'
                        }`}>
                          {(member.full_name || member.email || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-foreground text-[13px]">
                              {member.full_name || 'Unnamed'}
                            </span>
                            {isMe && (
                              <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-semibold uppercase tracking-wide">
                                You
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-muted-foreground">{member.email || member.user_id.slice(0, 12) + '...'}</span>
                        </div>
                      </div>
                    </td>

                    {/* Role */}
                    <td className="py-4 px-4 hidden sm:table-cell">
                      <div className="flex items-center gap-2">
                        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${getRoleDot(member.role)}`} />
                        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-md border ${getRoleBadge(member.role)}`}>
                          {getRoleLabel(member.role)}
                        </span>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="py-4 px-4 hidden lg:table-cell">
                      <span className={`text-[11px] font-medium px-2 py-0.5 rounded-md ${
                        member.status === 'active'
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                          : 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400'
                      }`}>
                        {member.status === 'active' ? '● Active' : '○ Inactive'}
                      </span>
                    </td>

                    {/* Joined */}
                    <td className="py-4 px-4 hidden lg:table-cell text-[12px] text-muted-foreground">
                      {new Date(member.created_at).toLocaleDateString('en-IN', {
                        day: 'numeric', month: 'short', year: 'numeric'
                      })}
                    </td>

                    {/* Actions */}
                    <td className="py-4 px-4 text-right">
                      {canEdit ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[12px] text-muted-foreground hover:bg-muted hover:text-foreground border border-transparent hover:border-border transition-colors">
                              Manage <ChevronDown className="w-3 h-3" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52">
                            {/* Super Admin: Edit & Reset */}
                            {isSuperAdmin && (
                              <>
                                <DropdownMenuLabel className="text-[11px] text-muted-foreground">User Actions</DropdownMenuLabel>
                                <DropdownMenuItem onClick={() => setEditMember(member)} className="text-[12px] gap-2 cursor-pointer">
                                  <Pencil className="w-3.5 h-3.5" /> Edit Profile
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setResetMember(member)} className="text-[12px] gap-2 cursor-pointer">
                                  <KeyRound className="w-3.5 h-3.5" /> Reset Password
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                              </>
                            )}
                            <DropdownMenuLabel className="text-[11px] text-muted-foreground">Assign Role</DropdownMenuLabel>
                            {ROLES.filter(r => canAssignRole(r)).map(r => (
                              <DropdownMenuItem
                                key={r}
                                onClick={() => updateRoleMutation.mutate({ userId: member.user_id, role: r })}
                                className={`text-[12px] gap-2 cursor-pointer ${member.role === r ? 'bg-muted/50' : ''}`}
                              >
                                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${getRoleDot(r)}`} />
                                {getRoleLabel(r)}
                                {member.role === r && (
                                  <span className="ml-auto text-[10px] text-muted-foreground">current</span>
                                )}
                              </DropdownMenuItem>
                            ))}
                            <DropdownMenuSeparator />
                            <DropdownMenuLabel className="text-[11px] text-muted-foreground">Status</DropdownMenuLabel>
                            <DropdownMenuItem
                              onClick={() => updateStatusMutation.mutate({ userId: member.user_id, status: 'active' })}
                              className="text-[12px] cursor-pointer"
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-2 shrink-0" />
                              Set Active
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => updateStatusMutation.mutate({ userId: member.user_id, status: 'inactive' })}
                              className="text-[12px] text-rose-600 cursor-pointer"
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mr-2 shrink-0" />
                              Set Inactive
                            </DropdownMenuItem>
                            {/* Super Admin: Deactivate */}
                            {isSuperAdmin && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => setDeleteMember(member)} className="text-[12px] gap-2 cursor-pointer text-rose-600 focus:text-rose-600">
                                  <Trash2 className="w-3.5 h-3.5" /> Deactivate User
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : (
                        <span className="text-[11px] text-muted-foreground italic">
                          {isMe ? 'Current user' : 'No access'}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-border bg-muted/10 flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">
            <span className="text-foreground font-medium">{filtered.length}</span> of{' '}
            <span className="text-foreground font-medium">{users.length}</span> members shown
          </span>
          {isSuperAdmin && (
            <div className="flex items-center gap-1.5 text-[11px] text-purple-600 dark:text-purple-400">
              <Shield className="w-3 h-3" />
              <span>Super Admin — full control</span>
            </div>
          )}
        </div>
      </div>

      {/* Onboarding tip */}
      <div className="bg-amber-50 dark:bg-amber-500/8 border border-amber-200/70 dark:border-amber-400/20 rounded-lg p-4 flex gap-3 items-start">
        <div className="w-5 h-5 rounded-full bg-amber-400/20 flex items-center justify-center shrink-0 mt-0.5">
          <span className="text-amber-600 text-[10px] font-bold">i</span>
        </div>
        <div>
          <p className="text-[12px] font-semibold text-amber-800 dark:text-amber-300">How to add new members</p>
          <p className="text-[11px] text-amber-700/80 dark:text-amber-400/70 mt-0.5 leading-relaxed">
            New members sign up at the login page using their email. Once registered they appear here with the default role <strong>Agent</strong>.
            Use the <strong>Manage</strong> dropdown to assign the correct role — Admin, Lawyer, or Agent.
          </p>
        </div>
      </div>

      {/* Super Admin Modals */}
      {editMember && (
        <EditUserModal
          member={editMember}
          open={!!editMember}
          onOpenChange={(v) => { if (!v) setEditMember(null); }}
          onSuccess={refreshUsers}
        />
      )}
      {resetMember && (
        <ResetPasswordModal
          member={resetMember}
          open={!!resetMember}
          onOpenChange={(v) => { if (!v) setResetMember(null); }}
        />
      )}
      {deleteMember && (
        <DeleteUserModal
          member={deleteMember}
          open={!!deleteMember}
          onOpenChange={(v) => { if (!v) setDeleteMember(null); }}
          onSuccess={refreshUsers}
        />
      )}
    </div>
  );
}
