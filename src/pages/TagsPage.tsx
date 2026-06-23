import { useState } from "react";
import { useMinLoader } from "@/hooks/useMinLoader";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Pencil } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { usePagination } from "@/hooks/usePagination";
import { TablePagination } from "@/components/TablePagination";
import { DeleteConfirm } from "@/components/DeleteConfirm";
import { PageLoader } from "@/components/PageLoader";

const emptyForm = { name: "", color: "#6366f1" };
const presetColors = ["#6366f1", "#ef4444", "#f59e0b", "#22c55e", "#3b82f6", "#ec4899", "#8b5cf6", "#14b8a6"];

export default function TagsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: tags = [], isLoading } = useQuery({
    queryKey: ["tags"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tags").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editId) {
        const { error } = await supabase.from("tags").update(form).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("tags").insert({ ...form, user_id: user!.id });
        if (error) throw error;
      }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["tags"] }); closeDialog(); toast.success(editId ? "Tag updated" : "Tag added"); },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("tags").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["tags"] }); toast.success("Deleted"); },
  });

  const closeDialog = () => { setOpen(false); setEditId(null); setForm(emptyForm); };
  const openEdit = (t: any) => { setEditId(t.id); setForm({ name: t.name, color: t.color || "#6366f1" }); setOpen(true); };

  const filtered = tags.filter(t => (t.name || "").toLowerCase().includes(search.toLowerCase()));
  const { paginatedItems, currentPage, totalPages, totalItems, startIndex, nextPage, prevPage, goToPage } = usePagination(filtered);

  const showLoader = useMinLoader(isLoading);
  if (showLoader) return <PageLoader />;

  return (
    <div>
      <PageHeader title="Tags" breadcrumbs={[{ label: "Dashboard", path: "/" }, { label: "System Setup" }, { label: "Tags" }]} />
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-center justify-end gap-3 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search..." className="pl-9 w-64" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Dialog open={open} onOpenChange={v => { if (!v) closeDialog(); else setOpen(true); }}>
            <DialogTrigger asChild>
              <Button onClick={() => { setEditId(null); setForm(emptyForm); }}><Plus className="w-4 h-4 mr-2" /> Add Tag</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editId ? "Edit Tag" : "Add Tag"}</DialogTitle></DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2"><Label>Name *</Label><Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div>
                <div className="grid gap-2">
                  <Label>Color</Label>
                  <div className="flex gap-2 flex-wrap">
                    {presetColors.map(c => (
                      <button key={c} onClick={() => setForm(p => ({ ...p, color: c }))} className={`w-8 h-8 rounded-full border-2 transition-all ${form.color === c ? "border-foreground scale-110" : "border-transparent"}`} style={{ backgroundColor: c }} />
                    ))}
                  </div>
                </div>
              </div>
              <Button onClick={() => saveMutation.mutate()} disabled={!form.name || saveMutation.isPending}>
                {saveMutation.isPending ? "Saving..." : editId ? "Update" : "Add Tag"}
              </Button>
            </DialogContent>
          </Dialog>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">#</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Tag</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Created</th>
                <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Action</th>
              </tr>
            </thead>
            <tbody>
              {paginatedItems.length === 0 ? (
                <tr><td colSpan={4} className="py-8 text-center text-muted-foreground">No tags found</td></tr>
              ) : paginatedItems.map((t, i) => (
                <tr key={t.id} className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors">
                  <td className="py-3 px-4 text-sm">{startIndex + i + 1}</td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: t.color || "#6366f1" }} />
                      <span className="text-sm font-medium">{t.name}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-sm">{new Date(t.created_at).toLocaleDateString()}</td>
                  <td className="py-3 px-4 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(t)}><Pencil className="w-4 h-4 text-primary" /></Button>
                      <DeleteConfirm onConfirm={() => deleteMutation.mutate(t.id)} />
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
