import { useState } from "react";
import { useMinLoader } from "@/hooks/useMinLoader";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Pencil, StickyNote } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AITextarea } from "@/components/AITextarea";
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

const emptyForm = { title: "", content: "", case_id: "", client_id: "" };

export default function NotesPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ["notes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("notes").select("*, cases(title, case_number), clients(name)").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: cases = [] } = useQuery({ queryKey: ["cases"], queryFn: async () => { const { data } = await supabase.from("cases").select("id, title, case_number"); return data || []; } });
  const { data: clients = [] } = useQuery({ queryKey: ["clients"], queryFn: async () => { const { data } = await supabase.from("clients").select("id, name"); return data || []; } });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = { title: form.title, content: form.content, case_id: form.case_id || null, client_id: form.client_id || null };
      if (editId) {
        const { error } = await supabase.from("notes").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("notes").insert({ ...payload, created_by: user!.id });
        if (error) throw error;
      }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["notes"] }); closeDialog(); toast.success(editId ? "Note updated successfully" : "Note added successfully"); },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("notes").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["notes"] }); toast.success("Note deleted"); },
  });

  const closeDialog = () => { setOpen(false); setEditId(null); setForm(emptyForm); };
  const openEdit = (n: any) => { setEditId(n.id); setForm({ title: n.title, content: n.content || "", case_id: n.case_id || "", client_id: n.client_id || "" }); setOpen(true); };

  const filtered = notes.filter(n => (n.title || "").toLowerCase().includes(search.toLowerCase()));
  const { paginatedItems, currentPage, totalPages, totalItems, startIndex, nextPage, prevPage, goToPage } = usePagination(filtered);

  const showLoader = useMinLoader(isLoading);
  if (showLoader) return <PageLoader />;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <PageHeader title="Internal Notes" breadcrumbs={[{ label: "Dashboard", path: "/" }, { label: "Notes" }]} />
        <div className="flex gap-2 w-full sm:w-auto">
          <Dialog open={open} onOpenChange={v => { if (!v) closeDialog(); else setOpen(true); }}>
            <DialogTrigger asChild>
              <Button onClick={() => { setEditId(null); setForm(emptyForm); }} className="bg-primary text-primary-foreground shadow-sm hover:shadow-md transition-all">
                <Plus className="w-4 h-4 mr-2" /> Add Note
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle className="text-xl font-bold">{editId ? "Edit Note" : "Create New Note"}</DialogTitle></DialogHeader>
              <div className="grid gap-4 py-4 px-1 custom-scrollbar">
                <div className="grid gap-2"><Label className="font-semibold text-muted-foreground">Title *</Label><Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} className="bg-muted/50" /></div>
                <div className="grid gap-2"><Label className="font-semibold text-muted-foreground">Content</Label><AITextarea rows={6} value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))} className="bg-muted/50 resize-y" context="Legal case note content" /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label className="font-semibold text-muted-foreground">Case Link</Label>
                    <Select value={form.case_id} onValueChange={v => setForm(p => ({ ...p, case_id: v }))}>
                      <SelectTrigger className="bg-muted/50"><SelectValue placeholder="Select case" /></SelectTrigger>
                      <SelectContent>{cases.map(c => <SelectItem key={c.id} value={c.id}>{c.case_number}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label className="font-semibold text-muted-foreground">Client Link</Label>
                    <Select value={form.client_id} onValueChange={v => setForm(p => ({ ...p, client_id: v }))}>
                      <SelectTrigger className="bg-muted/50"><SelectValue placeholder="Select client" /></SelectTrigger>
                      <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <Button onClick={() => saveMutation.mutate()} disabled={!form.title || saveMutation.isPending} className="w-full">
                {saveMutation.isPending ? "Saving..." : editId ? "Update Note" : "Save Note"}
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
            <Input placeholder="Search notes by title..." className="pl-9 bg-background" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium px-2">
            Showing <span className="text-foreground">{paginatedItems.length}</span> of <span className="text-foreground">{totalItems}</span> notes
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b border-border text-muted-foreground">
              <tr>
                <th className="text-left py-3.5 px-5 font-semibold text-[11px] uppercase tracking-widest w-12">#</th>
                <th className="text-left py-3.5 px-5 font-semibold text-[11px] uppercase tracking-widest">Note Detail</th>
                <th className="text-left py-3.5 px-5 font-semibold text-[11px] uppercase tracking-widest">Linked Entities</th>
                <th className="text-left py-3.5 px-5 font-semibold text-[11px] uppercase tracking-widest">Date Created</th>
                <th className="text-right py-3.5 px-5 font-semibold text-[11px] uppercase tracking-widest">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                        <StickyNote className="w-8 h-8 text-muted-foreground opacity-50" />
                      </div>
                      <p className="text-base font-semibold text-foreground">No notes available</p>
                      <p className="text-sm text-muted-foreground mt-1 max-w-sm">Jot down your thoughts, case observations, or client memos.</p>
                    </div>
                  </td>
                </tr>
              ) : paginatedItems.map((n, i) => (
                <tr key={n.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors group">
                  <td className="py-4 px-5 text-muted-foreground font-mono">{startIndex + i + 1}</td>
                  <td className="py-4 px-5">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 w-8 h-8 rounded-md bg-amber-500/10 flex items-center justify-center shrink-0 border border-amber-500/20">
                        <StickyNote className="w-4 h-4 text-amber-600" />
                      </div>
                      <div>
                        <div className="font-semibold text-foreground">{n.title}</div>
                        {n.content && <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2 max-w-sm">{n.content}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-5">
                    <div className="flex flex-col gap-1.5">
                      {n.case_id ? (
                        <span className="font-mono font-medium text-foreground bg-muted/50 px-2 py-0.5 rounded text-xs border border-border/50 w-fit">
                          C: {(n as any).cases?.case_number || "Unknown Case"}
                        </span>
                      ) : null}
                      {n.client_id ? (
                        <span className="font-medium text-foreground bg-muted/50 px-2 py-0.5 rounded text-xs border border-border/50 w-fit">
                          U: {(n as any).clients?.name || "Unknown Client"}
                        </span>
                      ) : null}
                      {!n.case_id && !n.client_id && <span className="text-muted-foreground italic text-xs">Unlinked</span>}
                    </div>
                  </td>
                  <td className="py-4 px-5 text-muted-foreground font-medium">
                    {new Date(n.created_at).toLocaleDateString()}
                  </td>
                  <td className="py-4 px-5 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(n)} className="h-8 w-8 hover:bg-primary/10 hover:text-primary transition-colors">
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <DeleteConfirm onConfirm={() => deleteMutation.mutate(n.id)} />
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
