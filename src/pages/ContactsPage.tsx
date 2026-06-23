import { useState } from "react";
import { useMinLoader } from "@/hooks/useMinLoader";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Pencil, Download, Phone as PhoneIcon, Users } from "lucide-react";
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
import { exportToCSV } from "@/lib/export";
import { CSVImport } from "@/components/CSVImport";
import { PageLoader } from "@/components/PageLoader";

const emptyForm = { name: "", email: "", phone: "", company: "", designation: "", contact_type: "general", notes: "" };
const contactTypes = ["general", "client", "witness", "expert", "court", "other"];

export default function ContactsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ["contacts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("contacts").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editId) {
        const { error } = await supabase.from("contacts").update(form).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("contacts").insert({ ...form, user_id: user!.id });
        if (error) throw error;
      }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["contacts"] }); closeDialog(); toast.success(editId ? "Contact updated successfully" : "Contact added successfully"); },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("contacts").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["contacts"] }); toast.success("Contact deleted"); },
  });

  const closeDialog = () => { setOpen(false); setEditId(null); setForm(emptyForm); };
  const openEdit = (c: any) => { setEditId(c.id); setForm({ name: c.name, email: c.email || "", phone: c.phone || "", company: c.company || "", designation: c.designation || "", contact_type: c.contact_type, notes: c.notes || "" }); setOpen(true); };

  const filtered = contacts.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || (c.email || "").toLowerCase().includes(search.toLowerCase()) || (c.company || "").toLowerCase().includes(search.toLowerCase()));
  const { paginatedItems, currentPage, totalPages, totalItems, startIndex, nextPage, prevPage, goToPage } = usePagination(filtered);

  const showLoader = useMinLoader(isLoading);
  if (showLoader) return <PageLoader />;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <PageHeader title="Contact Directory" breadcrumbs={[{ label: "Dashboard", path: "/" }, { label: "Contacts" }]} />
        <div className="flex gap-2 w-full sm:w-auto flex-wrap">
          <CSVImport table="contacts" fields={["name", "email", "phone", "company", "designation", "contact_type"]} queryKey="contacts" label="Import" />
          <Button variant="outline" onClick={() => exportToCSV(filtered.map(c => ({ name: c.name, email: c.email || "", phone: c.phone || "", company: c.company || "", designation: c.designation || "", type: c.contact_type })), "contacts")} className="bg-background">
            <Download className="w-4 h-4 mr-2" /> Export
          </Button>
          <Dialog open={open} onOpenChange={v => { if (!v) closeDialog(); else setOpen(true); }}>
            <DialogTrigger asChild>
              <Button onClick={() => { setEditId(null); setForm(emptyForm); }} className="bg-primary text-primary-foreground shadow-sm hover:shadow-md transition-all">
                <Plus className="w-4 h-4 mr-2" /> Add Contact
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle className="text-xl font-bold">{editId ? "Edit Contact" : "Add New Contact"}</DialogTitle></DialogHeader>
              <div className="grid gap-4 py-4 px-1 custom-scrollbar">
                <div className="grid gap-2"><Label className="font-semibold text-muted-foreground">Name *</Label><Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="bg-muted/50" /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2"><Label className="font-semibold text-muted-foreground">Email</Label><Input value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} className="bg-muted/50" /></div>
                  <div className="grid gap-2"><Label className="font-semibold text-muted-foreground">Phone</Label><Input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} className="bg-muted/50" /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2"><Label className="font-semibold text-muted-foreground">Company</Label><Input value={form.company} onChange={e => setForm(p => ({ ...p, company: e.target.value }))} className="bg-muted/50" /></div>
                  <div className="grid gap-2"><Label className="font-semibold text-muted-foreground">Designation</Label><Input value={form.designation} onChange={e => setForm(p => ({ ...p, designation: e.target.value }))} className="bg-muted/50" /></div>
                </div>
                <div className="grid gap-2">
                  <Label className="font-semibold text-muted-foreground">Type</Label>
                  <Select value={form.contact_type} onValueChange={v => setForm(p => ({ ...p, contact_type: v }))}>
                    <SelectTrigger className="bg-muted/50"><SelectValue /></SelectTrigger>
                    <SelectContent>{contactTypes.map(t => <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2"><Label className="font-semibold text-muted-foreground">Notes</Label><Input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} className="bg-muted/50" /></div>
              </div>
              <Button onClick={() => saveMutation.mutate()} disabled={!form.name || saveMutation.isPending} className="w-full">
                {saveMutation.isPending ? "Saving..." : editId ? "Update Contact" : "Save Contact"}
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
            <Input placeholder="Search contacts by name, email, or company..." className="pl-9 bg-background" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium px-2">
            Showing <span className="text-foreground">{paginatedItems.length}</span> of <span className="text-foreground">{totalItems}</span> contacts
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b border-border text-muted-foreground">
              <tr>
                <th className="text-left py-3.5 px-5 font-semibold text-[11px] uppercase tracking-widest w-12">#</th>
                <th className="text-left py-3.5 px-5 font-semibold text-[11px] uppercase tracking-widest">Contact Info</th>
                <th className="text-left py-3.5 px-5 font-semibold text-[11px] uppercase tracking-widest">Professional Details</th>
                <th className="text-left py-3.5 px-5 font-semibold text-[11px] uppercase tracking-widest">Type</th>
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
                      <p className="text-base font-semibold text-foreground">No contacts found</p>
                      <p className="text-sm text-muted-foreground mt-1 max-w-sm">Manage your professional network and case contacts.</p>
                    </div>
                  </td>
                </tr>
              ) : paginatedItems.map((c, i) => (
                <tr key={c.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors group">
                  <td className="py-4 px-5 text-muted-foreground font-mono">{startIndex + i + 1}</td>
                  <td className="py-4 px-5">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20 text-primary font-bold text-xs">
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-semibold text-foreground">{c.name}</div>
                        {(c.email || c.phone) && (
                          <div className="flex flex-col gap-0.5 mt-0.5">
                            {c.phone && <span className="text-xs text-muted-foreground flex items-center gap-1"><PhoneIcon className="w-3 h-3" /> {c.phone}</span>}
                            {c.email && <span className="text-xs text-muted-foreground">{c.email}</span>}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-5">
                    <div className="font-medium text-foreground">{c.company || "—"}</div>
                    {c.designation && <div className="text-xs text-muted-foreground">{c.designation}</div>}
                  </td>
                  <td className="py-4 px-5">
                    <span className="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border bg-muted text-muted-foreground border-border/50">
                      {c.contact_type}
                    </span>
                  </td>
                  <td className="py-4 px-5 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(c)} className="h-8 w-8 hover:bg-primary/10 hover:text-primary transition-colors">
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <DeleteConfirm onConfirm={() => deleteMutation.mutate(c.id)} />
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
