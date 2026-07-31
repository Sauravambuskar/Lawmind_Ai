import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KeyRound, Trash2, Pencil, Loader2, AlertTriangle } from "lucide-react";
import { restUpdate } from "@/lib/restClient";
import { APP_SECTIONS, DEFAULT_PERMISSIONS, type SectionId } from "@/lib/permissionStore";
import type { UserProfile } from "@/hooks/auth.types";

/* ═══════════════ Edit User Modal ═══════════════ */

interface EditUserModalProps {
  member: UserProfile;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: () => void;
}

export function EditUserModal({ member, open, onOpenChange, onSuccess }: EditUserModalProps) {
  const [fullName, setFullName] = useState(member.full_name || "");
  const [email, setEmail] = useState(member.email || "");
  const [phone, setPhone] = useState(member.phone || "");
  const [useCustomSections, setUseCustomSections] = useState(
    Array.isArray(member.sections) && member.sections.length > 0,
  );
  const [sections, setSections] = useState<SectionId[]>(
    (member.sections as SectionId[] | null) ?? (DEFAULT_PERMISSIONS[member.role] as SectionId[]),
  );
  const [loading, setLoading] = useState(false);

  const toggleSection = (id: SectionId) =>
    setSections(prev => (prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await restUpdate("profiles", `user_id=eq.${member.user_id}`, {
        full_name: fullName,
        email,
        phone: phone || null,
        // null => inherit the role's permissions
        sections: useCustomSections ? sections : null,
      });
      toast.success("User profile updated");
      onOpenChange(false);
      onSuccess();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  const groups = [...new Set(APP_SECTIONS.map(s => s.group))];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="w-4 h-4" /> Edit User Profile
          </DialogTitle>
          <DialogDescription>
            Update details for <strong>{member.full_name || member.email}</strong>
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSave} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>Full Name</Label>
            <Input value={fullName} onChange={e => setFullName(e.target.value)} required placeholder="John Doe" />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="john@example.com" />
          </div>
          <div className="space-y-2">
            <Label>Phone <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91 9876543210" />
          </div>

          {/* Section privileges */}
          <div className="border border-border rounded-lg p-3 space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={useCustomSections}
                onChange={e => setUseCustomSections(e.target.checked)}
                className="rounded border-border accent-primary w-3.5 h-3.5"
              />
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Custom section access
              </span>
            </label>
            <p className="text-[10px] text-muted-foreground">
              {useCustomSections
                ? `${sections.length}/${APP_SECTIONS.length} sections allowed for this user only.`
                : `Inheriting the ${member.role.replace("_", " ")} role permissions.`}
            </p>

            {useCustomSections && (
              <div className="space-y-3 max-h-[200px] overflow-y-auto custom-scrollbar pt-1">
                {groups.map(group => (
                  <div key={group}>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">{group}</p>
                    <div className="grid grid-cols-2 gap-1">
                      {APP_SECTIONS.filter(s => s.group === group).map(section => (
                        <label key={section.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted/30 cursor-pointer text-xs">
                          <input
                            type="checkbox"
                            checked={sections.includes(section.id)}
                            onChange={() => toggleSection(section.id)}
                            className="rounded border-border accent-primary w-3.5 h-3.5"
                          />
                          <span className="text-foreground">{section.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Saving...</> : "Save Changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ═══════════════ Password Reset ═══════════════ */

interface ResetPasswordModalProps {
  member: UserProfile;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function ResetPasswordModal({ member, open, onOpenChange }: ResetPasswordModalProps) {
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    const email = member.email;
    if (!email) {
      toast.error("No email address found for this user");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/login`,
      });
      if (error) throw error;
      toast.success(`Password reset email sent to ${email}`);
      onOpenChange(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to send reset link");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-amber-500" /> Reset Password
          </DialogTitle>
          <DialogDescription>
            Send a password reset email to <strong>{member.email}</strong>?
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-2 pt-4">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleReset} disabled={loading} className="flex-1 bg-amber-500 hover:bg-amber-600 text-white">
            {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Sending...</> : "Send Reset Link"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ═══════════════ Delete User Confirmation ═══════════════ */

interface DeleteUserModalProps {
  member: UserProfile;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: () => void;
}

export function DeleteUserModal({ member, open, onOpenChange, onSuccess }: DeleteUserModalProps) {
  const [loading, setLoading] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const handleDelete = async () => {
    setLoading(true);
    try {
      // Soft delete: revoke access without destroying history
      await restUpdate("profiles", `user_id=eq.${member.user_id}`, { status: "inactive", role: "agent" });
      toast.success(`${member.full_name || "User"} has been deactivated`);
      onOpenChange(false);
      setConfirmText("");
      onSuccess();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to deactivate user");
    } finally {
      setLoading(false);
    }
  };

  const memberName = member.full_name || member.email || "this user";

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setConfirmText(""); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-rose-600">
            <AlertTriangle className="w-4 h-4" /> Deactivate User
          </DialogTitle>
          <DialogDescription>
            This will set <strong>{memberName}</strong> to <strong>inactive</strong> and revoke their access. They will not be able to log in.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">
              Type <strong className="text-foreground">DEACTIVATE</strong> to confirm
            </Label>
            <Input
              value={confirmText}
              onChange={e => setConfirmText(e.target.value)}
              placeholder="DEACTIVATE"
              className="font-mono"
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button
              onClick={handleDelete}
              disabled={loading || confirmText !== "DEACTIVATE"}
              variant="destructive"
              className="flex-1"
            >
              {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Processing...</> : "Deactivate User"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
