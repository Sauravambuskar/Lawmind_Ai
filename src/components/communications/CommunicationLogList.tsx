import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Phone, Mail, Users, MessageSquare, FileText, MoreHorizontal, Pencil } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { DeleteConfirm } from "@/components/DeleteConfirm";

interface Props {
  clientId?: string;
  caseId?: string;
}

const emptyForm = { type: "call", date: new Date().toISOString().slice(0, 16), summary: "", notes: "" };

const commIcons: Record<string, any> = {
  call: Phone,
  email: Mail,
  meeting: Users,
  message: MessageSquare,
  letter: FileText,
  other: MoreHorizontal,
};

export function CommunicationLogList({ clientId, caseId }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["communication_logs", clientId, caseId],
    queryFn: async () => {
      let q = supabase.from("communication_logs").select("*").order("date", { ascending: false });
      if (clientId) q = q.eq("client_id", clientId);
      if (caseId) q = q.eq("case_id", caseId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    enabled: !!clientId || !!caseId,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        client_id: clientId || null,
        case_id: caseId || null,
        type: form.type,
        date: new Date(form.date).toISOString(),
        summary: form.summary,
        notes: form.notes,
        user_id: user!.id,
      };

      if (editId) {
        const { error } = await supabase.from("communication_logs").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("communication_logs").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["communication_logs"] });
      setOpen(false);
      toast.success(editId ? "Log updated" : "Log added");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("communication_logs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["communication_logs"] });
      toast.success("Log deleted");
    },
  });

  const openEdit = (log: any) => {
    setEditId(log.id);
    const d = new Date(log.date);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    setForm({
      type: log.type,
      date: d.toISOString().slice(0, 16),
      summary: log.summary,
      notes: log.notes || "",
    });
    setOpen(true);
  };

  const openNew = () => {
    setEditId(null);
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    setForm({ ...emptyForm, date: d.toISOString().slice(0, 16) });
    setOpen(true);
  };

  return (
    <div className="bg-card border border-border shadow-sm rounded-xl overflow-hidden">
      <div className="p-4 border-b border-border bg-muted/10 flex items-center justify-between">
        <h3 className="font-semibold text-foreground">Communication Log</h3>
        <Button size="sm" onClick={openNew}>
          <Plus className="w-3.5 h-3.5 mr-1" /> Add Log
        </Button>
      </div>

      <div className="p-0">
        {isLoading ? (
          <div className="p-8 flex justify-center"><div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div></div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <MessageSquare className="w-8 h-8 opacity-20 mx-auto mb-2" />
            <p className="text-sm font-medium">No communication logs found.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {logs.map(log => {
              const Icon = commIcons[log.type] || MoreHorizontal;
              return (
                <div key={log.id} className="p-4 hover:bg-muted/30 transition-colors group">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 shrink-0 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mt-1">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-semibold text-sm text-foreground">{log.summary}</h4>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            <span className="capitalize font-medium text-primary/80">{log.type}</span> • {format(new Date(log.date), "MMM d, yyyy h:mm a")}
                          </p>
                        </div>
                        <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary" onClick={() => openEdit(log)}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <DeleteConfirm onConfirm={() => deleteMutation.mutate(log.id)} />
                        </div>
                      </div>
                      {log.notes && (
                        <div className="mt-3 text-sm text-muted-foreground bg-muted/40 p-3 rounded-md border border-border/50">
                          {log.notes}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={v => { if (!v) setOpen(false); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editId ? "Edit Log" : "New Communication Log"}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Type *</Label>
                <Select value={form.type} onValueChange={v => setForm(p => ({ ...p, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="call">Phone Call</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="meeting">Meeting</SelectItem>
                    <SelectItem value="message">Message/SMS</SelectItem>
                    <SelectItem value="letter">Letter</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Date & Time *</Label>
                <Input type="datetime-local" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Summary / Subject *</Label>
              <Input value={form.summary} onChange={e => setForm(p => ({ ...p, summary: e.target.value }))} placeholder="e.g. Discussed settlement terms" />
            </div>
            <div className="grid gap-2">
              <Label>Detailed Notes</Label>
              <Textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={4} placeholder="Key takeaways from the communication..." />
            </div>
          </div>
          <Button onClick={() => saveMutation.mutate()} disabled={!form.summary || saveMutation.isPending} className="w-full">
            {saveMutation.isPending ? "Saving..." : "Save Log"}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
