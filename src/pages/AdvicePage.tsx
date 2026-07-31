import { useState } from "react";
import { useMinLoader } from "@/hooks/useMinLoader";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Pencil, Download } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AITextarea } from "@/components/AITextarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { usePagination } from "@/hooks/usePagination";
import { TablePagination } from "@/components/TablePagination";
import { DeleteConfirm } from "@/components/DeleteConfirm";
import { exportToCSV } from "@/lib/export";
import { PageLoader } from "@/components/PageLoader";
import { format } from "date-fns";

const emptyForm = { subject: "", description: "", client_id: "", case_id: "", status: "pending" };

export default function AdvicePage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: advice = [], isLoading } = useQuery({
    queryKey: ["advice"],
    queryFn: async () => {
      const { data, error } = await supabase.from("advice").select("*, clients(name), cases(title)").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: clients = [] } = useQuery({ queryKey: ["clients"], queryFn: async () => { const { data } = await supabase.from("clients").select("id, name"); return data || []; } });
  const { data: cases = [] } = useQuery({ queryKey: ["cases"], queryFn: async () => { const { data } = await supabase.from("cases").select("id, title"); return data || []; } });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { client_id, case_id, ...rest } = form;
      const payload = { ...rest, client_id: client_id || null, case_id: case_id || null };
      if (editId) {
        const { error } = await supabase.from("advice").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("advice").insert({ ...payload, created_by: user!.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["advice"] });
      closeDialog();
      toast.success(editId ? "Advice updated" : "Advice added");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("advice").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["advice"] }); toast.success("Deleted"); },
  });

  const closeDialog = () => { setOpen(false); setEditId(null); setForm(emptyForm); };
  const openEdit = (a: any) => { setEditId(a.id); setForm({ subject: a.subject, description: a.description || "", client_id: a.client_id || "", case_id: a.case_id || "", status: a.status }); setOpen(true); };

  const filtered = advice.filter(a => (a.subject || "").toLowerCase().includes(search.toLowerCase()) || (a as any).clients?.name?.toLowerCase().includes(search.toLowerCase()));
  const { paginatedItems, currentPage, totalPages, totalItems, startIndex, nextPage, prevPage, goToPage } = usePagination(filtered);

  const showLoader = useMinLoader(isLoading);
  if (showLoader) return <PageLoader />;

  const statusVariant = (s: string) => {
    if (s === "completed") return "default";
    if (s === "given") return "outline";
    return "secondary";
  };

  return (
    <div>
      <PageHeader title="Legal Advice" breadcrumbs={[{ label: "Dashboard", path: "/" }, { label: "Advice" }]} />
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-center justify-end gap-3 mb-6 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => exportToCSV(filtered.map(a => ({ subject: a.subject, client: (a as any).clients?.name || "", case: (a as any).cases?.title || "", date: a.advice_date, status: a.status, description: a.description || "" })), "advice")}>
            <Download className="w-4 h-4 mr-2" /> Export CSV
          </Button>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search by subject or client..." className="pl-9 w-64" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Dialog open={open} onOpenChange={v => { if (!v) closeDialog(); else setOpen(true); }}>
            <DialogTrigger asChild><Button onClick={() => { setEditId(null); setForm(emptyForm); }}><Plus className="w-4 h-4 mr-2" /> Add Advice</Button></DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>{editId ? "Edit Advice" : "Add New Advice"}</DialogTitle></DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label>Subject *</Label>
                  <Input value={form.subject} onChange={e => setForm(p => ({ ...p, subject: e.target.value }))} placeholder="Enter advice subject" />
                </div>
                <div className="grid gap-2">
                  <Label>Description</Label>
                  <AITextarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Detailed advice description..." rows={3} context="Legal advice description" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Client</Label>
                    <Select value={form.client_id} onValueChange={v => setForm(p => ({ ...p, client_id: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                      <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Case</Label>
                    <Select value={form.case_id} onValueChange={v => setForm(p => ({ ...p, case_id: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select case" /></SelectTrigger>
                      <SelectContent>{cases.map(c => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["pending", "given", "completed"].map(s => <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={() => saveMutation.mutate()} disabled={!form.subject || saveMutation.isPending}>
                {saveMutation.isPending ? "Saving..." : editId ? "Update Advice" : "Add Advice"}
              </Button>
            </DialogContent>
          </Dialog>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">#</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Subject</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Client</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Case</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Date</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Status</th>
                <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Action</th>
              </tr>
            </thead>
            <tbody>
              {paginatedItems.length === 0 ? (
                <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">No advice records found</td></tr>
              ) : paginatedItems.map((a, i) => (
                <tr key={a.id} className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors">
                  <td className="py-3 px-4 text-sm">{startIndex + i + 1}</td>
                  <td className="py-3 px-4">
                    <div>
                      <span className="text-sm font-medium">{a.subject}</span>
                      {a.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{a.description}</p>}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-sm">{(a as any).clients?.name || "—"}</td>
                  <td className="py-3 px-4 text-sm">{(a as any).cases?.title || "—"}</td>
                  <td className="py-3 px-4 text-sm">{format(new Date(a.advice_date), "MMM dd, yyyy")}</td>
                  <td className="py-3 px-4"><Badge variant={statusVariant(a.status)}>{a.status}</Badge></td>
                  <td className="py-3 px-4 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(a)}><Pencil className="w-4 h-4 text-primary" /></Button>
                      <DeleteConfirm onConfirm={() => deleteMutation.mutate(a.id)} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <TablePagination currentPage={currentPage} totalPages={totalPages} totalItems={totalItems} startIndex={startIndex} pageSize={10} onPrev={prevPage} onNext={nextPage} onGoTo={goToPage} />
      </div>
    </div>
  );
}