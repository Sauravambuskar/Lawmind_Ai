import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Plus, Trash2, Phone, Scale, UserCheck, Shield, Users, BellRing, BellOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { restGet, restInsert, restUpdate, restDelete } from "@/lib/restClient";

interface CaseContact {
  id: string;
  case_id: string;
  name: string;
  phone: string;
  role: string;
  notify: boolean;
}

const ROLES = [
  { value: "party", label: "Party", icon: Users },
  { value: "advocate", label: "Advocate", icon: Scale },
  { value: "admin", label: "Admin", icon: Shield },
  { value: "other", label: "Other", icon: UserCheck },
];

function roleMeta(role: string) {
  return ROLES.find((r) => r.value === role) || ROLES[3];
}

export function CaseContactsPanel({ caseId, userId, caseData, qc }: { caseId: string; userId: string; caseData: any; qc: any }) {
  const [form, setForm] = useState({ name: "", phone: "", role: "party" });

  const { data: contacts = [] } = useQuery({
    queryKey: ["case-contacts", caseId],
    queryFn: () => restGet<CaseContact>(`case_contacts?select=*&case_id=eq.${caseId}&order=created_at.asc`),
  });

  // Linked client / advocate names (they also receive automatic SMS)
  const { data: linked } = useQuery({
    queryKey: ["case-linked-parties", caseId, caseData.client_id, caseData.advocate_id],
    queryFn: async () => {
      const [client] = caseData.client_id ? await restGet<{ name: string; phone: string | null }>(`clients?select=name,phone&id=eq.${caseData.client_id}&limit=1`) : [];
      const [advocate] = caseData.advocate_id ? await restGet<{ name: string; phone: string | null }>(`advocates?select=name,phone&id=eq.${caseData.advocate_id}&limit=1`) : [];
      return { client, advocate };
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Enter a name");
      if (!/\d{10}/.test(form.phone.replace(/\D/g, "").slice(-10))) throw new Error("Enter a valid 10-digit mobile number");
      await restInsert("case_contacts", { case_id: caseId, name: form.name.trim(), phone: form.phone.trim(), role: form.role, notify: true, created_by: userId });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["case-contacts", caseId] }); setForm({ name: "", phone: "", role: "party" }); toast.success("Recipient added"); },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Could not add recipient"),
  });

  const toggleNotify = useMutation({
    mutationFn: (c: CaseContact) => restUpdate("case_contacts", `id=eq.${c.id}`, { notify: !c.notify, updated_at: new Date().toISOString() }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["case-contacts", caseId] }),
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Could not update"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => restDelete("case_contacts", `id=eq.${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["case-contacts", caseId] }); toast.success("Recipient removed"); },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Could not remove"),
  });

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-bold text-foreground">SMS Recipients</h3>
        <p className="text-sm text-muted-foreground">Everyone here (with the bell on) gets automatic hearing-date and status SMS for this case — parties, advocates and admins.</p>
      </div>

      {/* Linked client / advocate (auto-included) */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-muted/15 p-4">
          <p className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground"><UserCheck className="h-3.5 w-3.5" />Linked client (auto-notified)</p>
          <p className="text-sm font-semibold text-foreground">{linked?.client?.name || "Not linked"}</p>
          <p className="text-xs text-muted-foreground">{linked?.client?.phone || "No phone on file"}</p>
        </div>
        <div className="rounded-xl border border-border bg-muted/15 p-4">
          <p className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground"><Scale className="h-3.5 w-3.5" />Linked advocate (auto-notified)</p>
          <p className="text-sm font-semibold text-foreground">{linked?.advocate?.name || "Not linked"}</p>
          <p className="text-xs text-muted-foreground">{linked?.advocate?.phone || "No phone on file"}</p>
        </div>
      </div>

      {/* Add form */}
      <div className="rounded-xl border border-border p-4">
        <p className="mb-3 text-sm font-semibold">Add a recipient</p>
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_140px_auto]">
          <div><Label className="text-xs">Name</Label><Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="Full name" /></div>
          <div><Label className="text-xs">Mobile</Label><Input value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} placeholder="9876543210" inputMode="numeric" /></div>
          <div>
            <Label className="text-xs">Role</Label>
            <Select value={form.role} onValueChange={(v) => setForm((p) => ({ ...p, role: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex items-end"><Button onClick={() => add.mutate()} disabled={add.isPending} className="w-full gap-1.5"><Plus className="h-4 w-4" />Add</Button></div>
        </div>
      </div>

      {/* List */}
      <div className="rounded-xl border border-border">
        <div className="border-b border-border px-4 py-3"><h4 className="text-sm font-bold">Added recipients ({contacts.length})</h4></div>
        <div className="divide-y divide-border">
          {contacts.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">No extra recipients yet. The linked client and advocate above are already notified.</p>
          ) : contacts.map((c) => {
            const meta = roleMeta(c.role);
            const Icon = meta.icon;
            return (
              <div key={c.id} className="flex items-center gap-3 p-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="h-4 w-4" /></div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{c.name} <span className="ml-1 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase text-muted-foreground">{meta.label}</span></p>
                  <p className="flex items-center gap-1 text-xs text-muted-foreground"><Phone className="h-3 w-3" />{c.phone}</p>
                </div>
                <button
                  onClick={() => toggleNotify.mutate(c)}
                  title={c.notify ? "Notifications on — click to mute" : "Muted — click to enable"}
                  className={`rounded-lg p-2 transition-colors ${c.notify ? "text-emerald-600 hover:bg-emerald-500/10" : "text-muted-foreground hover:bg-muted"}`}
                >
                  {c.notify ? <BellRing className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
                </button>
                <button onClick={() => remove.mutate(c.id)} className="rounded-lg p-2 text-muted-foreground hover:bg-red-500/10 hover:text-red-500 transition-colors" title="Remove"><Trash2 className="h-4 w-4" /></button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
