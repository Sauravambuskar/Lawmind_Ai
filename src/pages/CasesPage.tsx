import { useState } from "react";
import { useMinLoader } from "@/hooks/useMinLoader";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Plus, Search, Pencil, Download, BriefcaseBusiness, Filter, Trash2, CheckSquare, Eye } from "lucide-react";
import { CaseFileImport } from "@/components/CaseFileImport";
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
  court_name: string | null;
  court_type: string | null;
  client_id: string | null;
  advocate_id: string | null;
  cnr_number: string | null;
  file_number: string | null;
  case_stage: string | null;
  stage: string | null;
  next_hearing_date: string | null;
  last_hearing_date: string | null;
  case_imported_date: string | null;
  case_tags: string | null;
  case_side: string | null;
  disposed_date: string | null;
  document_size: string | null;
  fir_number: string | null;
  police_station: string | null;
  case_notes_1: string | null;
  case_notes_2: string | null;
  filing_date: string | null;
  created_at: string;
};

const emptyForm = {
  case_number: "", title: "", description: "", status: "open",
  court_name: "", court_type: "", client_id: "", advocate_id: "",
  filing_date: "", template_id: "", matter_id: "",
  cnr_number: "", file_number: "", case_stage: "", stage: "",
  last_hearing_date: "", next_hearing_date: "", case_imported_date: "",
  case_tags: "", case_side: "", disposed_date: "", document_size: "",
  fir_number: "", police_station: "", case_notes_1: "", case_notes_2: "",
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
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
      const session = (await supabase.auth.getSession()).data.session;
      const authToken = session?.access_token || supabaseKey;
      const res = await fetch(`${supabaseUrl}/rest/v1/cases?select=id,case_number,title,status,court_name,court_type,case_stage,stage,case_side,cnr_number,file_number,filing_date,next_hearing_date,last_hearing_date,case_imported_date,case_tags,disposed_date,document_size,fir_number,police_station,case_notes_1,case_notes_2,description,client_id,advocate_id,created_at&order=created_at.desc&limit=5000`, {
        headers: { "apikey": supabaseKey, "Authorization": `Bearer ${authToken}` },
      });
      if (!res.ok) throw new Error("Failed to fetch cases");
      return (await res.json()) as CaseRow[];
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

  // ── Save (create / update) ──────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async () => {
      const { client_id, advocate_id, filing_date, template_id, matter_id,
        last_hearing_date, next_hearing_date, case_imported_date, disposed_date,
        ...rest } = form;
      const payload: Record<string, any> = { 
        ...rest, 
        client_id: client_id || null, 
        advocate_id: advocate_id || null, 
        filing_date: filing_date || null,
        last_hearing_date: last_hearing_date || null,
        next_hearing_date: next_hearing_date || null,
        case_imported_date: case_imported_date || null,
        disposed_date: disposed_date || null,
      };
      // Remove empty string fields to avoid DB issues
      Object.keys(payload).forEach(k => {
        if (payload[k] === "") payload[k] = null;
      });
      // Remove template_id and matter_id from payload (not in DB)
      delete payload.template_id;
      delete payload.matter_id;

      // Use raw fetch to bypass PostgREST schema cache issues
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
      const session = (await supabase.auth.getSession()).data.session;
      const authToken = session?.access_token || supabaseKey;
      const headers = { "Content-Type": "application/json", "apikey": supabaseKey, "Authorization": `Bearer ${authToken}`, "Prefer": "return=representation" };

      if (editId) {
        const res = await fetch(`${supabaseUrl}/rest/v1/cases?id=eq.${editId}`, { method: "PATCH", headers, body: JSON.stringify(payload) });
        if (!res.ok) { const err = await res.json().catch(() => ({ message: res.statusText })); throw new Error(err.message || "Update failed"); }
        await writeAuditLog({ user_id: user!.id, action: "update", table_name: "cases", record_id: editId, new_data: payload });
      } else {
        const insertPayload = { ...payload, created_by: user!.id };
        const res = await fetch(`${supabaseUrl}/rest/v1/cases`, { method: "POST", headers, body: JSON.stringify(insertPayload) });
        if (!res.ok) { const err = await res.json().catch(() => ({ message: res.statusText })); throw new Error(err.message || "Insert failed"); }
        const data = await res.json();
        const newId = Array.isArray(data) ? data[0]?.id : data?.id;
        await writeAuditLog({ user_id: user!.id, action: "insert", table_name: "cases", record_id: newId, new_data: payload });
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
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
      const session = (await supabase.auth.getSession()).data.session;
      const authToken = session?.access_token || supabaseKey;
      const res = await fetch(`${supabaseUrl}/rest/v1/cases?id=eq.${id}`, { method: "DELETE", headers: { "apikey": supabaseKey, "Authorization": `Bearer ${authToken}` } });
      if (!res.ok) { const err = await res.json().catch(() => ({ message: "Delete failed" })); throw new Error(err.message); }
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
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
      const session = (await supabase.auth.getSession()).data.session;
      const authToken = session?.access_token || supabaseKey;
      const idsParam = ids.map(i => `"${i}"`).join(",");
      const res = await fetch(`${supabaseUrl}/rest/v1/cases?id=in.(${idsParam})`, { method: "DELETE", headers: { "apikey": supabaseKey, "Authorization": `Bearer ${authToken}` } });
      if (!res.ok) { const err = await res.json().catch(() => ({ message: "Bulk delete failed" })); throw new Error(err.message); }
      await Promise.all(ids.map(id => writeAuditLog({ user_id: user!.id, action: "delete", table_name: "cases", record_id: id })));
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
      court_name: c.court_name || "",
      court_type: c.court_type || "",
      client_id: c.client_id || "",
      advocate_id: c.advocate_id || "",
      filing_date: c.filing_date || "",
      matter_id: "",
      template_id: "",
      cnr_number: c.cnr_number || "",
      file_number: c.file_number || "",
      case_stage: c.case_stage || "",
      stage: c.stage || "",
      last_hearing_date: c.last_hearing_date || "",
      next_hearing_date: c.next_hearing_date || "",
      case_imported_date: c.case_imported_date || "",
      case_tags: c.case_tags || "",
      case_side: c.case_side || "",
      disposed_date: c.disposed_date || "",
      document_size: c.document_size || "",
      fir_number: c.fir_number || "",
      police_station: c.police_station || "",
      case_notes_1: c.case_notes_1 || "",
      case_notes_2: c.case_notes_2 || "",
    });
    setOpen(true);
  };

  const filtered = cases
    .filter(c =>
      (c.title || "").toLowerCase().includes(search.toLowerCase()) ||
      (c.case_number || "").toLowerCase().includes(search.toLowerCase()),
    )
    .filter(c => {
      if (statusFilter === "all") return true;
      if (statusFilter === "court") return (c.court_type || "").toLowerCase().includes("court") || (c.court_name || "").length > 0;
      if (statusFilter === "affidavit") return (c.case_stage || "").toLowerCase().includes("affidavit") || (c.title || "").toLowerCase().includes("affidavit");
      return c.status === statusFilter;
    });

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
        court: c.court_name || "",
        court_type: c.court_type || "",
        status: c.status,
        case_stage: c.case_stage || "",
        next_hearing_date: c.next_hearing_date || "",
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
          <CaseFileImport />
          <Button
            variant="outline"
            onClick={() =>
              exportToCSV(
                filtered.map(c => ({
                  case_number: c.case_number,
                  title: c.title,
                  court: c.court_name || "",
                  court_type: c.court_type || "",
                  status: c.status,
                  case_stage: c.case_stage || "",
                  next_hearing_date: c.next_hearing_date || "",
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
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle className="text-xl font-bold">{editId ? "Edit Case Detail" : "Create New Case"}</DialogTitle></DialogHeader>
              <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto px-1 custom-scrollbar">
                <div className="grid gap-2"><Label className="font-semibold text-muted-foreground">Case Number *</Label><Input value={form.case_number} onChange={e => setForm(p => ({ ...p, case_number: e.target.value }))} className="bg-muted/50" /></div>
                <div className="grid gap-2"><Label className="font-semibold text-muted-foreground">Title *</Label><Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} className="bg-muted/50" /></div>
                <div className="grid gap-2"><Label className="font-semibold text-muted-foreground">Description</Label><Input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} className="bg-muted/50" /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2"><Label className="font-semibold text-muted-foreground">Court Name</Label><Input value={form.court_name} onChange={e => setForm(p => ({ ...p, court_name: e.target.value }))} className="bg-muted/50" /></div>
                  <div className="grid gap-2"><Label className="font-semibold text-muted-foreground">Court Type</Label><Input value={form.court_type} onChange={e => setForm(p => ({ ...p, court_type: e.target.value }))} placeholder="e.g. JMFC / ACJM / Civil" className="bg-muted/50" /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2"><Label className="font-semibold text-muted-foreground">Filing Date</Label><Input type="date" value={form.filing_date} onChange={e => setForm(p => ({ ...p, filing_date: e.target.value }))} className="bg-muted/50" /></div>
                  <div className="grid gap-2"><Label className="font-semibold text-muted-foreground">File Number</Label><Input value={form.file_number} onChange={e => setForm(p => ({ ...p, file_number: e.target.value }))} placeholder="e.g. 123/2024" className="bg-muted/50" /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2"><Label className="font-semibold text-muted-foreground">CNR Number</Label><Input value={form.cnr_number} onChange={e => setForm(p => ({ ...p, cnr_number: e.target.value }))} placeholder="e.g. MHAK010012345" className="bg-muted/50" /></div>
                  <div className="grid gap-2"><Label className="font-semibold text-muted-foreground">Case Side</Label><Input value={form.case_side} onChange={e => setForm(p => ({ ...p, case_side: e.target.value }))} placeholder="e.g. Complainant / Respondent" className="bg-muted/50" /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2"><Label className="font-semibold text-muted-foreground">Case Stage</Label><Input value={form.case_stage} onChange={e => setForm(p => ({ ...p, case_stage: e.target.value }))} placeholder="e.g. Evidence / Arguments" className="bg-muted/50" /></div>
                  <div className="grid gap-2"><Label className="font-semibold text-muted-foreground">Stage</Label><Input value={form.stage} onChange={e => setForm(p => ({ ...p, stage: e.target.value }))} placeholder="e.g. Pending / Final" className="bg-muted/50" /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2"><Label className="font-semibold text-muted-foreground">Next Hearing Date</Label><Input type="date" value={form.next_hearing_date} onChange={e => setForm(p => ({ ...p, next_hearing_date: e.target.value }))} className="bg-muted/50" /></div>
                  <div className="grid gap-2"><Label className="font-semibold text-muted-foreground">Last Hearing Date</Label><Input type="date" value={form.last_hearing_date} onChange={e => setForm(p => ({ ...p, last_hearing_date: e.target.value }))} className="bg-muted/50" /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2"><Label className="font-semibold text-muted-foreground">FIR Number</Label><Input value={form.fir_number} onChange={e => setForm(p => ({ ...p, fir_number: e.target.value }))} placeholder="e.g. FIR 456/2024" className="bg-muted/50" /></div>
                  <div className="grid gap-2"><Label className="font-semibold text-muted-foreground">Police Station</Label><Input value={form.police_station} onChange={e => setForm(p => ({ ...p, police_station: e.target.value }))} placeholder="e.g. Ramdaspeth, Akola" className="bg-muted/50" /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2"><Label className="font-semibold text-muted-foreground">Disposed Date</Label><Input type="date" value={form.disposed_date} onChange={e => setForm(p => ({ ...p, disposed_date: e.target.value }))} className="bg-muted/50" /></div>
                  <div className="grid gap-2"><Label className="font-semibold text-muted-foreground">Case Tags</Label><Input value={form.case_tags} onChange={e => setForm(p => ({ ...p, case_tags: e.target.value }))} placeholder="e.g. NI Act, 138, Cheque" className="bg-muted/50" /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2"><Label className="font-semibold text-muted-foreground">Document Size</Label><Input value={form.document_size} onChange={e => setForm(p => ({ ...p, document_size: e.target.value }))} placeholder="e.g. 25 pages" className="bg-muted/50" /></div>
                  <div className="grid gap-2"><Label className="font-semibold text-muted-foreground">Case Imported Date</Label><Input type="date" value={form.case_imported_date} onChange={e => setForm(p => ({ ...p, case_imported_date: e.target.value }))} className="bg-muted/50" /></div>
                </div>
                <div className="grid gap-2">
                  <Label className="font-semibold text-muted-foreground">Status</Label>
                  <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v }))}>
                    <SelectTrigger className="bg-muted/50"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CASE_STATUSES.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2"><Label className="font-semibold text-muted-foreground">Case Notes 1</Label><Input value={form.case_notes_1} onChange={e => setForm(p => ({ ...p, case_notes_1: e.target.value }))} placeholder="Additional notes..." className="bg-muted/50" /></div>
                <div className="grid gap-2"><Label className="font-semibold text-muted-foreground">Case Notes 2</Label><Input value={form.case_notes_2} onChange={e => setForm(p => ({ ...p, case_notes_2: e.target.value }))} placeholder="Additional notes..." className="bg-muted/50" /></div>
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
                    <SelectItem key={s} value={s} className="capitalize">{s === "all" ? "All" : s === "not applicable" ? "Not Applicable" : s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
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
                <th className="text-left py-3.5 px-5 font-semibold text-[11px] uppercase tracking-widest">Title</th>
                <th className="text-left py-3.5 px-5 font-semibold text-[11px] uppercase tracking-widest">Stage / Side</th>
                <th className="text-left py-3.5 px-5 font-semibold text-[11px] uppercase tracking-widest">Court</th>
                <th className="text-left py-3.5 px-5 font-semibold text-[11px] uppercase tracking-widest">Next Hearing</th>
                <th className="text-left py-3.5 px-5 font-semibold text-[11px] uppercase tracking-widest">Status</th>
                <th className="text-right py-3.5 px-5 font-semibold text-[11px] uppercase tracking-widest">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center">
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
                      {c.court_type && <p className="text-xs text-muted-foreground mt-0.5">{c.court_type}</p>}
                    </td>
                    <td className="py-4 px-5">
                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-medium text-foreground flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500/50" />
                          {c.case_stage || <span className="text-muted-foreground italic text-xs">—</span>}
                        </span>
                        <span className="text-xs text-muted-foreground flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-purple-500/50" />
                          {c.case_side || <span className="italic">—</span>}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-5 text-muted-foreground font-medium">{c.court_name || "—"}</td>
                    <td className="py-4 px-5 text-muted-foreground text-xs font-medium">{c.next_hearing_date || "—"}</td>
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
