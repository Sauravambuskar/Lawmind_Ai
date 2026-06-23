import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMinLoader } from "@/hooks/useMinLoader";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Pencil, Download, CheckCircle, Eye, Users } from "lucide-react";
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
import { exportToCSV } from "@/lib/export";
import { CSVImport } from "@/components/CSVImport";
import { PageLoader } from "@/components/PageLoader";

const emptyForm = { name: "", email: "", phone: "", city: "", state: "", country: "" };
const fields = [
  { key: "name", label: "Name", required: true },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "city", label: "City" },
  { key: "state", label: "State" },
  { key: "country", label: "Country" },
];

export default function ClientsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editId) {
        const { error } = await supabase.from("clients").update(form).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("clients").insert({ ...form, user_id: user!.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      closeDialog();
      toast.success(editId ? "Client profile updated" : "Client profile added");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("clients").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["clients"] }); toast.success("Client profile deleted"); },
  });

  const closeDialog = () => { setOpen(false); setEditId(null); setForm(emptyForm); };
  const openEdit = (client: any) => { setEditId(client.id); setForm({ name: client.name, email: client.email || "", phone: client.phone || "", city: client.city || "", state: client.state || "", country: client.country || "" }); setOpen(true); };

  const filtered = clients.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || (c.email || "").toLowerCase().includes(search.toLowerCase()));
  const { paginatedItems, currentPage, totalPages, totalItems, startIndex, nextPage, prevPage, goToPage } = usePagination(filtered);

  const showLoader = useMinLoader(isLoading);

  if (showLoader) return <PageLoader />;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <PageHeader title="Client Directory" breadcrumbs={[{ label: "Dashboard", path: "/" }, { label: "Clients" }]} />
        <div className="flex gap-2 w-full sm:w-auto">
          <CSVImport table="clients" fields={["name", "email", "phone", "city", "state", "country"]} queryKey="clients" label="Import" />
          <Button variant="outline" onClick={() => exportToCSV(filtered.map(c => ({ name: c.name, email: c.email || "", phone: c.phone || "", city: c.city || "", state: c.state || "", country: c.country || "" })), "clients")} className="bg-background">
            <Download className="w-4 h-4 mr-2" /> Export
          </Button>
          
          <Dialog open={open} onOpenChange={v => { if (!v) closeDialog(); else setOpen(true); }}>
            <DialogTrigger asChild>
              <Button onClick={() => { setEditId(null); setForm(emptyForm); }} className="bg-primary text-primary-foreground shadow-sm hover:shadow-md transition-all">
                <Plus className="w-4 h-4 mr-2" /> New Client
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle className="text-xl font-bold">{editId ? "Edit Client Profile" : "Register New Client"}</DialogTitle></DialogHeader>
              <div className="grid gap-4 py-4 px-1">
                {fields.map(f => (
                  <div key={f.key} className="grid gap-2">
                    <Label className="font-semibold text-muted-foreground">{f.label}{f.required && " *"}</Label>
                    <Input value={(form as any)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} className="bg-muted/50" />
                  </div>
                ))}
              </div>
              <Button onClick={() => saveMutation.mutate()} disabled={!form.name || saveMutation.isPending} className="w-full">
                {saveMutation.isPending ? "Saving..." : editId ? "Update Profile" : "Register Client"}
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
            <Input placeholder="Search by client name or email..." className="pl-9 bg-background" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium px-2">
            Showing <span className="text-foreground">{paginatedItems.length}</span> of <span className="text-foreground">{totalItems}</span> clients
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b border-border text-muted-foreground">
              <tr>
                <th className="text-left py-3.5 px-5 font-semibold text-[11px] uppercase tracking-widest w-12">#</th>
                <th className="text-left py-3.5 px-5 font-semibold text-[11px] uppercase tracking-widest">Client Profile</th>
                <th className="text-left py-3.5 px-5 font-semibold text-[11px] uppercase tracking-widest">Contact Details</th>
                <th className="text-left py-3.5 px-5 font-semibold text-[11px] uppercase tracking-widest">Location</th>
                <th className="text-right py-3.5 px-5 font-semibold text-[11px] uppercase tracking-widest">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                        <Users className="w-8 h-8 text-muted-foreground opacity-50" />
                      </div>
                      <p className="text-base font-semibold text-foreground">No clients found</p>
                      <p className="text-sm text-muted-foreground mt-1 max-w-sm">There are no client profiles matching your search criteria. You can add a new client to get started.</p>
                    </div>
                  </td>
                </tr>
              ) : paginatedItems.map((client, i) => (
                <tr key={client.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors group">
                  <td className="py-4 px-5 text-muted-foreground font-mono">{startIndex + i + 1}</td>
                  <td className="py-4 px-5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-sm font-bold text-primary shadow-sm">
                        {client.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-foreground">{client.name}</span>
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                        </div>
                        <span className="text-xs text-muted-foreground mt-0.5">{client.email || <span className="italic opacity-50">No email</span>}</span>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-5">
                    <p className="font-medium text-foreground">{client.phone || "—"}</p>
                  </td>
                  <td className="py-4 px-5">
                    <p className="text-foreground font-medium">{client.city || "—"}</p>
                    <p className="text-xs text-muted-foreground">{[client.state, client.country].filter(Boolean).join(", ") || "—"}</p>
                  </td>
                  <td className="py-4 px-5 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" onClick={() => navigate(`/clients/${client.id}`)} title="View Client Dashboard" className="h-8 w-8 hover:bg-blue-500/10 hover:text-blue-500 transition-colors">
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(client)} className="h-8 w-8 hover:bg-primary/10 hover:text-primary transition-colors">
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <DeleteConfirm onConfirm={() => deleteMutation.mutate(client.id)} />
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
