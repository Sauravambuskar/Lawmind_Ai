import { useState } from "react";
import { useMinLoader } from "@/hooks/useMinLoader";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Plus, Search, Pencil, Download, BriefcaseBusiness, Filter, Trash2, CheckSquare, Eye } from "lucide-react";
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
import { PageLoader } from "@/components/PageLoader";
import { writeAuditLog } from "@/lib/auditLog";
import { logCaughtError } from "@/lib/errorLog";
import { CASE_STATUSES, CASE_STATUS_FILTER, CASE_STATUS_CONFIG, type CaseStatus } from "@/lib/constants";

type CaseRow = {
  id: string;
  case_number: string;
  title: string;
  description: string | null;
  status: string;
  case_type: string | null;
  court_name: string | null;
  client_id: string | null;
  advocate_id: string | null;
  created_at: string;
  clients?: { name: string } | null;
  advocates?: { name: string } | null;
};

const emptyForm = {
  case_number: "", title: "", description: "", status: "open",
  case_type: "", court_name: "", client_id: "", advocate_id: "", filing_date: "", template_id: "", matter_id: "",
};

export default function CasesPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { data: cases = [], isLoading } = useQuery({
    queryKey: ["cases"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cases")
        .select("*, clients(name), advocates(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as CaseRow[];
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id, name");
      return data || [];
    },
  });
  const { data: advocates = [] } = useQuery({
    queryKey: ["advocates"],
    queryFn: async () => {
      const { data } = await supabase.from("advocates").select("id, name");
      return data || [];
    },
  });

  const { data: templates = [] } = useQuery({
    queryKey: ["case_templates"],
    queryFn: async () => {
      const { data } = await supabase.from("case_templates").select("id, name");
      return data || [];
    },
  });

  const { data: matters = [] } = useQuery({
    queryKey: ["matters"],
    queryFn: async () => {
      const { data } = await supabase.from("matters").select("id, name");
      return data || [];
    },
  });

  // ── Save (create / update) ──────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async () => {
      const { client_id, advocate_id, filing_date, template_id, matter_id, ...rest } = form;
      const payload = { 
        ...rest, 
        client_id: client_id || null, 
        advocate_id: advocate_id || null, 
        filing_date: filing_date || null, 
        matter_id: matter_id === "none" ? null : (matter_id || null) 
      };
      
      if (editId) {
        const { error } = await supabase.from("cases").update(payload).eq("id", editId);
        if (error) throw error;
        await writeAuditLog({ user_id: user!.id, action: "update", table_name: "cases", record_id: editId, new_data: payload });
      } else {
        const { data, error } = await supabase.from("cases").insert({ ...payload, user_id: user!.id }).select().single();
        if (error) throw error;
        await writeAuditLog({ user_id: user!.id, action: "insert", table_name: "cases", record_id: data?.id, new_data: payload });
        
        // Auto-generate tasks from template
        if (template_id && template_id !== "none" && data?.id) {
          const { data: templateTasks } = await supabase.from("case_template_tasks").select("*").eq("template_id", template_id);
          if (templateTasks && templateTasks.length > 0) {
            const newTasks = templateTasks.map(t => {
              const due = new Date();
              due.setDate(due.getDate() + (t.days_offset || 0));
              return {
                case_id: data.id,
                title: t.title,
                description: t.description,
                priority: t.priority,
                due_date: due.toISOString().slice(0, 10),
                status: "pending",
                user_id: user!.id,
              };
            });
            await supabase.from("tasks").insert(newTasks);
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cases"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-cases"] });
      closeDialog();
      toast.success(editId ? "Case updated successfully" : "Case created successfully");
    },
    onError: (e: Error) => {
      logCaughtError(e, "CasesPage.saveMutation", user?.id);
      toast.error(e.message);
    },
  });

  // ── Delete single (optimistic) ──────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cases").delete().eq("id", id);
      if (error) throw error;
      await writeAuditLog({ user_id: user!.id, action: "delete", table_name: "cases", record_id: id });
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["cases"] });
      const prev = queryClient.getQueryData<CaseRow[]>(["cases"]);
      queryClient.setQueryData<CaseRow[]>(["cases"], old => (old || []).filter(c => c.id !== id));
      return { prev };
    },
    onError: (e: Error, _, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["cases"], ctx.prev);
      logCaughtError(e, "CasesPage.deleteMutation", user?.id);
      toast.error(e.message);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["cases"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-cases"] });
    },
    onSuccess: () => toast.success("Case deleted"),
  });

  // ── Bulk delete (optimistic) ────────────────────────────────────────────
  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("cases").delete().in("id", ids);
      if (error) throw error;
      await Promise.all(ids.map(id =>
        writeAuditLog({ user_id: user!.id, action: "delete", table_name: "cases", record_id: id }),
      ));
    },
    onMutate: async (ids) => {
      await queryClient.cancelQueries({ queryKey: ["cases"] });
      const prev = queryClient.getQueryData<CaseRow[]>(["cases"]);
      const idSet = new Set(ids);
      queryClient.setQueryData<CaseRow[]>(["cases"], old => (old || []).filter(c => !idSet.has(c.id)));
      setSelectedIds(new Set());
      return { prev };
    },
    onError: (e: Error, _, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["cases"], ctx.prev);
      logCaughtError(e, "CasesPage.bulkDeleteMutation", user?.id);
      toast.error(e.message);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["cases"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-cases"] });
    },
    onSuccess: (_, ids) => toast.success(`${ids.length} case(s) deleted`),
  });

  const closeDialog = () => { setOpen(false); setEditId(null); setForm(emptyForm); };
  const openEdit = (c: CaseRow) => {
    setEditId(c.id);
    setForm({
      case_number: c.case_number,
      title: c.title,
      description: c.description || "",
      status: c.status,
      case_type: c.case_type || "",
      court_name: c.court_name || "",
      client_id: c.client_id || "",
      advocate_id: c.advocate_id || "",
      filing_date: c.filing_date || "",
      matter_id: (c as any).matter_id || "",
      template_id: "", // Don't show template on edit
    });
    setOpen(true);
  };

  const filtered = cases
    .filter(c =>
      (c.title || "").toLowerCase().includes(search.toLowerCase()) ||
      (c.case_number || "").toLowerCase().includes(search.toLowerCase()),
    )
    .filter(c => statusFilter === "all" || c.status === statusFilter);

  const { paginatedItems, currentPage, totalPages, totalItems, startIndex, nextPage, prevPage, goToPage } = usePagination(filtered);

  // ── Selection helpers ───────────────────────────────────────────────────
  const allPageSelected = paginatedItems.length > 0 && paginatedItems.every(c => selectedIds.has(c.id));

  const toggleAll = () => {
    if (allPageSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        paginatedItems.forEach(c => next.delete(c.id));
        return next;
      });
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev);
        paginatedItems.forEach(c => next.add(c.id));
        return next;
      });
    }
  };

  const toggleRow = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  };

  const handleBulkExport = () => {
    const selected = filtered.filter(c => selectedIds.has(c.id));
    exportToCSV(
      selected.map(c => ({
        case_number: c.case_number,
        title: c.title,
        client: c.clients?.name || "",
        advocate: c.advocates?.name || "",
        court: c.court_name || "",
        status: c.status,
      })),
      "cases-export",
    );
  };

  const showLoader = useMinLoader(isLoading);
  if (showLoader) return <PageLoader />;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <PageHeader title="Case Management" breadcrumbs={[{ label: "Dashboard", path: "/" }, { label: "Cases" }]} />
        <div className="flex gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            onClick={() =>
              exportToCSV(
                filtered.map(c => ({
                  case_number: c.case_number,
                  title: c.title,
                  client: c.clients?.name || "",
                  advocate: c.advocates?.name || "",
                  court: c.court_name || "",
                  status: c.status,
                })),
                "cases",
              )
            }
            className="bg-background"
          >
            <Download className="w-4 h-4 mr-2" /> Export
          </Button>

          <Dialog open={open} onOpenChange={v => { if (!v) closeDialog(); else setOpen(true); }}>
            <DialogTrigger asChild>
              <Button onClick={() => { setEditId(null); setForm(emptyForm); }} className="bg-primary text-primary-foreground shadow-sm hover:shadow-md transition-all">
                <Plus className="w-4 h-4 mr-2" /> New Case
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle className="text-xl font-bold">{editId ? "Edit Case Detail" : "Create New Case"}</DialogTitle></DialogHeader>
              <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto px-1 custom-scrollbar">
                <div className="grid gap-2"><Label className="font-semibold text-muted-foreground">Case Number *</Label><Input value={form.case_number} onChange={e => setForm(p => ({ ...p, case_number: e.target.value }))} className="bg-muted/50" /></div>
                <div className="grid gap-2"><Label className="font-semibold text-muted-foreground">Title *</Label><Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} className="bg-muted/50" /></div>
                <div className="grid gap-2"><Label className="font-semibold text-muted-foreground">Description</Label><Input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} className="bg-muted/50" /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2"><Label className="font-semibold text-muted-foreground">Case Type</Label><Input value={form.case_type} onChange={e => setForm(p => ({ ...p, case_type: e.target.value }))} className="bg-muted/50" /></div>
                  <div className="grid gap-2"><Label className="font-semibold text-muted-foreground">Court Name</Label><Input value={form.court_name} onChange={e => setForm(p => ({ ...p, court_name: e.target.value }))} className="bg-muted/50" /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2"><Label className="font-semibold text-muted-foreground">Filing Date</Label><Input type="date" value={form.filing_date} onChange={e => setForm(p => ({ ...p, filing_date: e.target.value }))} className="bg-muted/50" /></div>
                  <div className="grid gap-2">
                    <Label className="font-semibold text-muted-foreground">Matter Classification</Label>
                    <Select value={form.matter_id} onValueChange={v => setForm(p => ({ ...p, matter_id: v }))}>
                      <SelectTrigger className="bg-muted/50"><SelectValue placeholder="Select matter" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {matters.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label className="font-semibold text-muted-foreground">Client</Label>
                  <Select value={form.client_id} onValueChange={v => setForm(p => ({ ...p, client_id: v }))}>
                    <SelectTrigger className="bg-muted/50"><SelectValue placeholder="Select client" /></SelectTrigger>
                    <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label className="font-semibold text-muted-foreground">Advocate</Label>
                  <Select value={form.advocate_id} onValueChange={v => setForm(p => ({ ...p, advocate_id: v }))}>
                    <SelectTrigger className="bg-muted/50"><SelectValue placeholder="Select advocate" /></SelectTrigger>
                    <SelectContent>{advocates.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                {!editId && templates.length > 0 && (
                  <div className="grid gap-2 p-3 bg-primary/5 border border-primary/20 rounded-lg">
                    <Label className="font-semibold text-primary">Apply Workflow Template</Label>
                    <Select value={form.template_id} onValueChange={v => setForm(p => ({ ...p, template_id: v }))}>
                      <SelectTrigger className="bg-background"><SelectValue placeholder="Select template (Optional)" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {templates.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <p className="text-[10px] text-muted-foreground">Automatically generates workflow tasks.</p>
                  </div>
                )}
                <div className="grid gap-2">
                  <Label className="font-semibold text-muted-foreground">Status</Label>
                  <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v }))}>
                    <SelectTrigger className="bg-muted/50"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CASE_STATUSES.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={() => saveMutation.mutate()} disabled={!form.case_number || !form.title || saveMutation.isPending} className="w-full">
                {saveMutation.isPending ? "Saving..." : editId ? "Update Case" : "Create Case"}
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
            <Input placeholder="Search case number or title..." className="pl-9 bg-background" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="flex items-center gap-2 bg-background border border-input rounded-md px-3 py-2 text-sm">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground font-medium hidden sm:inline">Status:</span>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-32 h-6 border-0 p-0 focus:ring-0 shadow-none bg-transparent font-semibold capitalize">
                  <SelectValue placeholder="Filter status" />
                </SelectTrigger>
                <SelectContent>
                  {CASE_STATUS_FILTER.map(s => (
                    <SelectItem key={s} value={s} className="capitalize">{s === "all" ? "All" : s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Bulk action bar */}
        {selectedIds.size > 0 && (
          <div className="px-4 py-2.5 bg-primary/5 border-b border-border flex items-center gap-3">
            <CheckSquare className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-primary">{selectedIds.size} selected</span>
            <div className="flex items-center gap-2 ml-auto">
              <Button size="sm" variant="outline" onClick={handleBulkExport}>
                <Download className="w-3.5 h-3.5 mr-1.5" /> Export Selected
              </Button>
              <Button
                size="sm"
                variant="destructive"
                disabled={bulkDeleteMutation.isPending}
                onClick={() => bulkDeleteMutation.mutate(Array.from(selectedIds))}
              >
                <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                {bulkDeleteMutation.isPending ? "Deleting..." : "Delete Selected"}
              </Button>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b border-border text-muted-foreground">
              <tr>
                <th className="py-3.5 px-4 w-10">
                  <input
                    type="checkbox"
                    checked={allPageSelected}
                    onChange={toggleAll}
                    className="rounded border-border accent-primary cursor-pointer"
                  />
                </th>
                <th className="text-left py-3.5 px-5 font-semibold text-[11px] uppercase tracking-widest">Case ID</th>
                <th className="text-left py-3.5 px-5 font-semibold text-[11px] uppercase tracking-widest">Details</th>
                <th className="text-left py-3.5 px-5 font-semibold text-[11px] uppercase tracking-widest">Client / Advocate</th>
                <th className="text-left py-3.5 px-5 font-semibold text-[11px] uppercase tracking-widest">Court</th>
                <th className="text-left py-3.5 px-5 font-semibold text-[11px] uppercase tracking-widest">Status</th>
                <th className="text-right py-3.5 px-5 font-semibold text-[11px] uppercase tracking-widest">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                        <BriefcaseBusiness className="w-8 h-8 text-muted-foreground opacity-50" />
                      </div>
                      <p className="text-base font-semibold text-foreground">No cases found</p>
                      <p className="text-sm text-muted-foreground mt-1 max-w-sm">We couldn't find any cases matching your criteria. Try adjusting your search filters or create a new case.</p>
                    </div>
                  </td>
                </tr>
              ) : paginatedItems.map(c => {
                const sConf = CASE_STATUS_CONFIG[c.status as CaseStatus] ?? CASE_STATUS_CONFIG["open"];
                const isSelected = selectedIds.has(c.id);
                return (
                  <tr
                    key={c.id}
                    className={`border-b border-border last:border-0 hover:bg-muted/30 transition-colors group ${isSelected ? "bg-primary/5" : ""}`}
                  >
                    <td className="py-4 px-4">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleRow(c.id)}
                        className="rounded border-border accent-primary cursor-pointer"
                      />
                    </td>
                    <td className="py-4 px-5">
                      <Link to={`/cases/${c.id}`} className="font-mono font-medium text-primary hover:bg-primary/10 transition-colors bg-primary/5 px-2 py-1 rounded inline-block text-xs border border-primary/20">
                        {c.case_number}
                      </Link>
                    </td>
                    <td className="py-4 px-5">
                      <Link to={`/cases/${c.id}`} className="font-semibold text-foreground hover:text-primary transition-colors hover:underline">
                        {c.title}
                      </Link>
                      {c.case_type && <p className="text-xs text-muted-foreground mt-0.5">{c.case_type}</p>}
                    </td>
                    <td className="py-4 px-5">
                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-medium text-foreground flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500/50" />
                          {c.clients?.name || <span className="text-muted-foreground italic text-xs">Unassigned</span>}
                        </span>
                        <span className="text-xs text-muted-foreground flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-purple-500/50" />
                          {c.advocates?.name || <span className="italic">Unassigned</span>}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-5 text-muted-foreground font-medium">{c.court_name || "—"}</td>
                    <td className="py-4 px-5">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider border ${sConf.bg} ${sConf.text} ${sConf.border}`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="py-4 px-5 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <Link to={`/cases/${c.id}`} className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-primary/10 hover:text-primary transition-colors text-muted-foreground">
                          <Eye className="w-4 h-4" />
                        </Link>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(c)} className="h-8 w-8 hover:bg-primary/10 hover:text-primary transition-colors">
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <DeleteConfirm onConfirm={() => deleteMutation.mutate(c.id)} />
                      </div>
                    </td>
                  </tr>
                );
              })}
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
