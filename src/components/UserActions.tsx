import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KeyRound, Trash2, Pencil, Loader2, AlertTriangle } from "lucide-react";
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
  const [loading, setLoading] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName,
          email,
          phone: phone || null,
        })
        .eq("user_id", member.user_id);
      if (error) throw error;
      toast.success("User profile updated");
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
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
    } catch (err: any) {
      toast.error(err.message);
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
      // Deactivate the user profile (soft delete)
      const { error } = await supabase
        .from("profiles")
        .update({ status: "inactive", role: "agent" })
        .eq("user_id", member.user_id);
      if (error) throw error;
      toast.success(`${member.full_name || "User"} has been deactivated`);
      onOpenChange(false);
      setConfirmText("");
      onSuccess();
    } catch (err: any) {
      toast.error(err.message);
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
