import { useState } from "react";
import { useMinLoader } from "@/hooks/useMinLoader";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Pencil, FolderKanban } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { usePagination } from "@/hooks/usePagination";
import { TablePagination } from "@/components/TablePagination";
import { DeleteConfirm } from "@/components/DeleteConfirm";
import { PageLoader } from "@/components/PageLoader";

const emptyForm = { name: "", description: "", status: "active" };

export default function MattersPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: matters = [], isLoading } = useQuery({
    queryKey: ["matters"],
    queryFn: async () => {
      const { data, error } = await supabase.from("matters").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editId) {
        const { error } = await supabase.from("matters").update(form).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("matters").insert({ ...form, user_id: user!.id });
        if (error) throw error;
      }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["matters"] }); closeDialog(); toast.success(editId ? "Matter updated successfully" : "Matter added successfully"); },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("matters").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["matters"] }); toast.success("Matter deleted"); },
  });

  const closeDialog = () => { setOpen(false); setEditId(null); setForm(emptyForm); };
  const openEdit = (m: any) => { setEditId(m.id); setForm({ name: m.name, description: m.description || "", status: m.status }); setOpen(true); };

  const filtered = matters.filter(m => (m.name || "").toLowerCase().includes(search.toLowerCase()));
  const { paginatedItems, currentPage, totalPages, totalItems, startIndex, nextPage, prevPage, goToPage } = usePagination(filtered);

  const showLoader = useMinLoader(isLoading);
  if (showLoader) return <PageLoader />;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <PageHeader title="Legal Matters" breadcrumbs={[{ label: "Dashboard", path: "/" }, { label: "System Setup" }, { label: "Matters" }]} />
        <div className="flex gap-2 w-full sm:w-auto">
          <Dialog open={open} onOpenChange={v => { if (!v) closeDialog(); else setOpen(true); }}>
            <DialogTrigger asChild>
              <Button onClick={() => { setEditId(null); setForm(emptyForm); }} className="bg-primary text-primary-foreground shadow-sm hover:shadow-md transition-all">
                <Plus className="w-4 h-4 mr-2" /> Add Matter
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle className="text-xl font-bold">{editId ? "Edit Matter" : "Create New Matter"}</DialogTitle></DialogHeader>
              <div className="grid gap-4 py-4 px-1 custom-scrollbar">
                <div className="grid gap-2"><Label className="font-semibold text-muted-foreground">Name *</Label><Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="bg-muted/50" /></div>
                <div className="grid gap-2"><Label className="font-semibold text-muted-foreground">Description</Label><Input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} className="bg-muted/50" /></div>
                <div className="grid gap-2">
                  <Label className="font-semibold text-muted-foreground">Status</Label>
                  <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v }))}>
                    <SelectTrigger className="bg-muted/50"><SelectValue /></SelectTrigger>
                    <SelectContent>{["active", "inactive"].map(s => <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={() => saveMutation.mutate()} disabled={!form.name || saveMutation.isPending} className="w-full">
                {saveMutation.isPending ? "Saving..." : editId ? "Update Matter" : "Save Matter"}
              </Button>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="bg-card border border-border shadow-sm rounded-xl overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 border-b border-border bg-muted/10 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search matters by name..." className="pl-9 bg-background" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium px-2">
            Showing <span className="text-foreground">{paginatedItems.length}</span> of <span className="text-foreground">{totalItems}</span> matters
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b border-border text-muted-foreground">
              <tr>
                <th className="text-left py-3.5 px-5 font-semibold text-[11px] uppercase tracking-widest w-12">#</th>
                <th className="text-left py-3.5 px-5 font-semibold text-[11px] uppercase tracking-widest">Matter Profile</th>
                <th className="text-left py-3.5 px-5 font-semibold text-[11px] uppercase tracking-widest">Status</th>
                <th className="text-right py-3.5 px-5 font-semibold text-[11px] uppercase tracking-widest">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-16 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                        <FolderKanban className="w-8 h-8 text-muted-foreground opacity-50" />
                      </div>
                      <p className="text-base font-semibold text-foreground">No matters configured</p>
                      <p className="text-sm text-muted-foreground mt-1 max-w-sm">Set up your firm's practice areas and matter types here.</p>
                    </div>
                  </td>
                </tr>
              ) : paginatedItems.map((m, i) => (
                <tr key={m.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors group">
                  <td className="py-4 px-5 text-muted-foreground font-mono">{startIndex + i + 1}</td>
                  <td className="py-4 px-5">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 w-8 h-8 rounded-md bg-indigo-500/10 flex items-center justify-center shrink-0 border border-indigo-500/20">
                        <FolderKanban className="w-4 h-4 text-indigo-600" />
                      </div>
                      <div>
                        <div className="font-semibold text-foreground">{m.name}</div>
                        {m.description && <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{m.description}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-5">
                    <span className={`inline-flex items-center px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${m.status === 'active' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-muted text-muted-foreground border-border/50'}`}>
                      {m.status}
                    </span>
                  </td>
                  <td className="py-4 px-5 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(m)} className="h-8 w-8 hover:bg-primary/10 hover:text-primary transition-colors">
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <DeleteConfirm onConfirm={() => deleteMutation.mutate(m.id)} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Footer */}
        {paginatedItems.length > 0 && (
          <div className="border-t border-border p-4 bg-muted/10">
            <TablePagination currentPage={currentPage} totalPages={totalPages} totalItems={totalItems} startIndex={startIndex} pageSize={10} onPrev={prevPage} onNext={nextPage} onGoTo={goToPage} />
          </div>
        )}
      </div>
    </div>
  );
}
