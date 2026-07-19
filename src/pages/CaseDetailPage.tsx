import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMinLoader } from "@/hooks/useMinLoader";
import { PageHeader } from "@/components/PageHeader";
import { PageLoader } from "@/components/PageLoader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  Gavel, ListTodo, Receipt, FileText, DollarSign, Clock, Plus, Trash2,
  CalendarDays, ChevronLeft, AlertCircle, Bell, Scale, StickyNote, Pencil,
  Sparkles, ExternalLink, BookOpen, AlarmClock, Check, X
} from "lucide-react";
import { CASE_STATUS_CONFIG, CASE_STATUSES, type CaseStatus, CURRENCY } from "@/lib/constants";
import { CloudinaryUpload } from "@/components/CloudinaryUpload";
import { useAIConfig } from "@/hooks/useAIConfig";
import { sendAIMessage } from "@/lib/ai-providers";

const TABS = [
  { id: "history", label: "Case History", icon: Clock },
  { id: "documents", label: "Case Documents", icon: FileText },
  { id: "notes", label: "Notes", icon: StickyNote },
  { id: "notify", label: "Notify to Clients", icon: Bell },
  { id: "judgments", label: "Related Judgments", icon: Scale },
  { id: "tasks", label: "Tasks", icon: ListTodo },
  { id: "appointments", label: "Appointments", icon: CalendarDays },
  { id: "invoices", label: "Invoice", icon: Receipt },
  { id: "expenses", label: "Expenses", icon: DollarSign },
  { id: "time", label: "AI Drafting", icon: Sparkles },
] as const;
type TabId = typeof TABS[number]["id"];

export default function CaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabId>("history");

  const { data: caseData, isLoading } = useQuery({
    queryKey: ["case-detail", id],
    queryFn: async () => {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
      const session = (await supabase.auth.getSession()).data.session;
      const authToken = session?.access_token || supabaseKey;
      const res = await fetch(`${supabaseUrl}/rest/v1/cases?id=eq.${id}&select=*`, {
        headers: { "apikey": supabaseKey, "Authorization": `Bearer ${authToken}`, "Accept": "application/vnd.pgrst.object+json" },
      });
      if (!res.ok) throw new Error("Failed to fetch case");
      return await res.json();
    },
    enabled: !!id,
  });
  const { data: hearings = [] } = useQuery({ queryKey: ["case-hearings", id], queryFn: async () => { const { data } = await supabase.from("hearings").select("*").eq("case_id", id).order("hearing_date", { ascending: false }); return data || []; }, enabled: !!id });
  const { data: tasks = [] } = useQuery({ queryKey: ["case-tasks", id], queryFn: async () => { const { data } = await supabase.from("tasks").select("*").eq("case_id", id).order("created_at", { ascending: false }); return data || []; }, enabled: !!id });
  const { data: invoices = [] } = useQuery({ queryKey: ["case-invoices", id], queryFn: async () => { const { data } = await supabase.from("invoices").select("*").eq("case_id", id).order("created_at", { ascending: false }); return data || []; }, enabled: !!id });
  const { data: expenses = [] } = useQuery({ queryKey: ["case-expenses", id], queryFn: async () => { const { data } = await supabase.from("expenses").select("*").eq("case_id", id).order("expense_date", { ascending: false }); return data || []; }, enabled: !!id });
  const { data: documents = [] } = useQuery({ queryKey: ["case-documents", id], queryFn: async () => { const { data } = await supabase.from("documents").select("*").eq("case_id", id).order("created_at", { ascending: false }); return data || []; }, enabled: !!id });

  const showLoader = useMinLoader(isLoading);
  if (showLoader) return <PageLoader />;
  if (!caseData) return <div className="flex flex-col items-center justify-center py-20"><AlertCircle className="w-12 h-12 text-muted-foreground opacity-50 mb-4" /><h2 className="text-xl font-bold">Case Not Found</h2><button onClick={() => navigate("/cases")} className="text-primary hover:underline mt-4">Back to Cases</button></div>;

  const sConf = CASE_STATUS_CONFIG[caseData.status as CaseStatus] ?? CASE_STATUS_CONFIG["open"];

  return (
    <div className="space-y-5 animate-in fade-in duration-500">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate("/cases")} className="p-2 rounded-md hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground"><ChevronLeft className="w-5 h-5" /></button>
        <PageHeader title={caseData.title} breadcrumbs={[{ label: "Cases", path: "/cases" }, { label: caseData.case_number }]} />
      </div>

      {/* Case Info */}
      <div className="bg-card border border-border shadow-sm rounded-xl p-5">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <span className="font-mono font-medium bg-muted/80 px-2.5 py-1 rounded-md text-xs border border-border">{caseData.case_number}</span>
          <StatusChanger caseId={id!} currentStatus={caseData.status} sConf={sConf} queryClient={queryClient} />
          {caseData.court_type && <span className="text-xs bg-muted px-2 py-0.5 rounded border border-border">{caseData.court_type}</span>}
          {caseData.case_side && <span className="text-xs bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300">{caseData.case_side}</span>}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 text-sm">
          <InfoField label="Court" value={caseData.court_name} />
          <InfoField label="CNR" value={caseData.cnr_number} />
          <InfoField label="File No." value={caseData.file_number} />
          <InfoField label="Filing Date" value={caseData.filing_date ? format(new Date(caseData.filing_date), "dd/MM/yyyy") : null} />
          <InfoField label="Next Hearing" value={caseData.next_hearing_date ? format(new Date(caseData.next_hearing_date), "dd/MM/yyyy") : null} />
          <InfoField label="Last Hearing" value={caseData.last_hearing_date ? format(new Date(caseData.last_hearing_date), "dd/MM/yyyy") : null} />
          <InfoField label="Stage" value={caseData.case_stage || caseData.stage} />
          <InfoField label="FIR No." value={caseData.fir_number} />
          <InfoField label="Police Stn" value={caseData.police_station} />
          <InfoField label="Tags" value={caseData.case_tags} />
          <InfoField label="Disposed" value={caseData.disposed_date ? format(new Date(caseData.disposed_date), "dd/MM/yyyy") : null} />
          <InfoField label="Doc Size" value={caseData.document_size} />
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border overflow-x-auto"><nav className="flex gap-0 min-w-max">{TABS.map(tab => { const Icon = tab.icon; return (<button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === tab.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"}`}><Icon className="w-4 h-4" />{tab.label}</button>); })}</nav></div>

      {/* Tab Content */}
      <div className="bg-card border border-border shadow-sm rounded-xl p-6 min-h-[400px]">
        {activeTab === "history" && <TabHistory hearings={hearings} tasks={tasks} invoices={invoices} expenses={expenses} documents={documents} />}
        {activeTab === "documents" && <TabDocuments caseId={id!} userId={user?.id || ""} documents={documents} qc={queryClient} />}
        {activeTab === "notes" && <TabNotes caseId={id!} userId={user?.id || ""} caseData={caseData} qc={queryClient} />}
        {activeTab === "notify" && <TabNotify caseId={id!} userId={user?.id || ""} caseData={caseData} qc={queryClient} />}
        {activeTab === "judgments" && <TabJudgments caseId={id!} userId={user?.id || ""} qc={queryClient} />}
        {activeTab === "tasks" && <TabTasks caseId={id!} userId={user?.id || ""} tasks={tasks} qc={queryClient} />}
        {activeTab === "appointments" && <TabAppointments caseId={id!} userId={user?.id || ""} hearings={hearings} qc={queryClient} />}
        {activeTab === "invoices" && <TabInvoices caseId={id!} userId={user?.id || ""} invoices={invoices} qc={queryClient} />}
        {activeTab === "expenses" && <TabExpenses caseId={id!} userId={user?.id || ""} expenses={expenses} qc={queryClient} />}
        {activeTab === "time" && <TabTimeEntries caseId={id!} userId={user?.id || ""} caseData={caseData} qc={queryClient} />}
      </div>
    </div>
  );
}

function InfoField({ label, value }: { label: string; value: string | null | undefined }) {
  return <div><p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</p><p className="text-sm font-medium text-foreground mt-0.5 truncate">{value || "—"}</p></div>;
}
function EmptyState({ icon: Icon, text }: { icon: any; text: string }) {
  return <div className="flex flex-col items-center justify-center py-16"><Icon className="w-12 h-12 text-muted-foreground opacity-20 mb-3" /><p className="text-sm font-medium text-muted-foreground">{text}</p></div>;
}

// ══════════════════════════════════════════════════════════════
// Status Changer — quick status update dropdown
// ══════════════════════════════════════════════════════════════
function StatusChanger({ caseId, currentStatus, sConf, queryClient }: { caseId: string; currentStatus: string; sConf: any; queryClient: any }) {
  const [changing, setChanging] = useState(false);

  const handleChange = async (newStatus: string) => {
    if (newStatus === currentStatus) return;
    setChanging(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
      const session = (await supabase.auth.getSession()).data.session;
      const authToken = session?.access_token || supabaseKey;
      const res = await fetch(`${supabaseUrl}/rest/v1/cases?id=eq.${caseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "apikey": supabaseKey, "Authorization": `Bearer ${authToken}` },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      queryClient.invalidateQueries({ queryKey: ["case-detail", caseId] });
      queryClient.invalidateQueries({ queryKey: ["cases"] });
      toast.success(`Status changed to ${newStatus}`);
    } catch (e: any) {
      toast.error(e.message || "Failed to change status");
    } finally {
      setChanging(false);
    }
  };

  return (
    <Select value={currentStatus} onValueChange={handleChange} disabled={changing}>
      <SelectTrigger className={`w-auto h-auto px-2.5 py-1 rounded-md text-xs font-bold uppercase border gap-1.5 ${sConf.bg} ${sConf.text} ${sConf.border}`}>
        <SelectValue>{changing ? "..." : currentStatus}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {CASE_STATUSES.map(s => {
          const conf = CASE_STATUS_CONFIG[s] ?? CASE_STATUS_CONFIG["open"];
          return (
            <SelectItem key={s} value={s} className="capitalize">
              <span className={`inline-flex items-center gap-2`}>
                <span className={`w-2 h-2 rounded-full ${conf.bg.replace("/10", "")}`} />
                {s === "not applicable" ? "Not Applicable" : s.charAt(0).toUpperCase() + s.slice(1)}
              </span>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}

// ══════════════════════════════════════════════════════════════
// TAB: Case History (read-only timeline)
// ══════════════════════════════════════════════════════════════
function TabHistory({ hearings, tasks, invoices, expenses, documents }: any) {
  const events: any[] = [];
  (hearings || []).forEach((h: any) => events.push({ date: new Date(h.hearing_date), title: `Hearing: ${h.purpose || "Scheduled"}`, sub: h.court_name, type: "hearing", status: h.status }));
  (tasks || []).forEach((t: any) => { if (t.due_date) events.push({ date: new Date(t.due_date), title: `Task: ${t.title}`, type: "task", status: t.status }); });
  (invoices || []).forEach((inv: any) => { if (inv.issue_date) events.push({ date: new Date(inv.issue_date), title: `Invoice #${inv.invoice_number}`, sub: `${CURRENCY}${inv.total}`, type: "invoice", status: inv.status }); });
  (expenses || []).forEach((e: any) => { if (e.expense_date) events.push({ date: new Date(e.expense_date), title: `Expense: ${e.title}`, sub: `${CURRENCY}${e.amount}`, type: "expense" }); });
  (documents || []).forEach((d: any) => events.push({ date: new Date(d.created_at), title: `Doc: ${d.title}`, sub: d.document_type, type: "document" }));
  events.sort((a, b) => b.date.getTime() - a.date.getTime());
  if (!events.length) return <EmptyState icon={Clock} text="No case history yet" />;
  return <div className="space-y-2">{events.map((ev, i) => (
    <div key={i} className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-muted/20 transition-colors">
      <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${ev.type === "hearing" ? "bg-amber-500" : ev.type === "task" ? "bg-blue-500" : ev.type === "invoice" ? "bg-rose-500" : ev.type === "expense" ? "bg-orange-500" : "bg-emerald-500"}`} />
      <div className="flex-1 min-w-0"><p className="text-sm font-medium">{ev.title}</p>{ev.sub && <p className="text-xs text-muted-foreground">{ev.sub}</p>}</div>
      <div className="text-right shrink-0"><p className="text-xs text-muted-foreground">{format(ev.date, "dd MMM yyyy")}</p>{ev.status && <span className="text-[10px] uppercase font-bold bg-muted text-muted-foreground px-1.5 py-0.5 rounded">{ev.status}</span>}</div>
    </div>
  ))}</div>;
}

// ══════════════════════════════════════════════════════════════
// TAB: Appointments / Hearings — FULL CRUD
// ══════════════════════════════════════════════════════════════
function TabAppointments({ caseId, userId, hearings, qc }: { caseId: string; userId: string; hearings: any[]; qc: any }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ hearing_date: "", court_name: "", judge_name: "", purpose: "", status: "scheduled", notes: "" });
  const [editId, setEditId] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      const payload = { ...form, case_id: caseId, user_id: userId, hearing_date: form.hearing_date || new Date().toISOString() };
      if (editId) { await supabase.from("hearings").update(payload).eq("id", editId); }
      else { await supabase.from("hearings").insert(payload); }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["case-hearings", caseId] }); qc.invalidateQueries({ queryKey: ["case-detail", caseId] }); setOpen(false); setEditId(null); setForm({ hearing_date: "", court_name: "", judge_name: "", purpose: "", status: "scheduled", notes: "" }); toast.success(editId ? "Updated" : "Hearing added"); },
    onError: (e: any) => toast.error(e.message),
  });
  const del = useMutation({ mutationFn: async (hid: string) => { await supabase.from("hearings").delete().eq("id", hid); }, onSuccess: () => { qc.invalidateQueries({ queryKey: ["case-hearings", caseId] }); toast.success("Deleted"); } });

  const openEdit = (h: any) => { setEditId(h.id); setForm({ hearing_date: h.hearing_date?.slice(0, 16) || "", court_name: h.court_name || "", judge_name: h.judge_name || "", purpose: h.purpose || "", status: h.status || "scheduled", notes: h.notes || "" }); setOpen(true); };

  return (
    <div>
      <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-foreground">Hearings / Appointments</h3><Button size="sm" onClick={() => { setEditId(null); setForm({ hearing_date: "", court_name: "", judge_name: "", purpose: "", status: "scheduled", notes: "" }); setOpen(true); }}><Plus className="w-4 h-4 mr-1" />Add Hearing</Button></div>
      {hearings.length === 0 ? <EmptyState icon={Gavel} text="No hearings scheduled" /> : <div className="space-y-2">{hearings.map((h: any) => (
        <div key={h.id} className="flex items-center gap-3 p-3 border border-border rounded-lg hover:bg-muted/20">
          <Gavel className="w-5 h-5 text-amber-500 shrink-0" />
          <div className="flex-1 min-w-0"><p className="text-sm font-medium">{h.purpose || "Hearing"}</p><p className="text-xs text-muted-foreground">{h.court_name || "—"} • Judge: {h.judge_name || "—"}</p></div>
          <div className="text-right shrink-0"><p className="text-xs font-medium">{h.hearing_date ? format(new Date(h.hearing_date), "dd MMM yyyy") : "—"}</p><span className="text-[10px] uppercase font-bold bg-muted px-1.5 py-0.5 rounded">{h.status}</span></div>
          <div className="flex gap-1"><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(h)}><Pencil className="w-3.5 h-3.5" /></Button><Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => del.mutate(h.id)}><Trash2 className="w-3.5 h-3.5" /></Button></div>
        </div>
      ))}</div>}
      <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>{editId ? "Edit Hearing" : "Add Hearing"}</DialogTitle></DialogHeader>
        <div className="grid gap-3 py-3">
          <div className="grid grid-cols-2 gap-3"><div><Label>Date & Time *</Label><Input type="datetime-local" value={form.hearing_date} onChange={e => setForm(p => ({ ...p, hearing_date: e.target.value }))} /></div><div><Label>Status</Label><Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="scheduled">Scheduled</SelectItem><SelectItem value="completed">Completed</SelectItem><SelectItem value="adjourned">Adjourned</SelectItem><SelectItem value="cancelled">Cancelled</SelectItem></SelectContent></Select></div></div>
          <div className="grid grid-cols-2 gap-3"><div><Label>Court Name</Label><Input value={form.court_name} onChange={e => setForm(p => ({ ...p, court_name: e.target.value }))} /></div><div><Label>Judge Name</Label><Input value={form.judge_name} onChange={e => setForm(p => ({ ...p, judge_name: e.target.value }))} /></div></div>
          <div><Label>Purpose</Label><Input value={form.purpose} onChange={e => setForm(p => ({ ...p, purpose: e.target.value }))} placeholder="e.g. Evidence, Arguments, Order" /></div>
          <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} /></div>
          <Button onClick={() => save.mutate()} disabled={save.isPending} className="w-full">{save.isPending ? "Saving..." : editId ? "Update" : "Add Hearing"}</Button>
        </div>
      </DialogContent></Dialog>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// TAB: Tasks — FULL CRUD
// ══════════════════════════════════════════════════════════════
function TabTasks({ caseId, userId, tasks, qc }: { caseId: string; userId: string; tasks: any[]; qc: any }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", status: "todo", priority: "medium", due_date: "" });
  const [editId, setEditId] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      const payload = { ...form, case_id: caseId, user_id: userId, due_date: form.due_date || null };
      if (editId) { await supabase.from("tasks").update(payload).eq("id", editId); }
      else { await supabase.from("tasks").insert(payload); }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["case-tasks", caseId] }); setOpen(false); setEditId(null); setForm({ title: "", description: "", status: "todo", priority: "medium", due_date: "" }); toast.success(editId ? "Updated" : "Task added"); },
    onError: (e: any) => toast.error(e.message),
  });
  const del = useMutation({ mutationFn: async (tid: string) => { await supabase.from("tasks").delete().eq("id", tid); }, onSuccess: () => { qc.invalidateQueries({ queryKey: ["case-tasks", caseId] }); toast.success("Deleted"); } });

  const openEdit = (t: any) => { setEditId(t.id); setForm({ title: t.title || "", description: t.description || "", status: t.status || "todo", priority: t.priority || "medium", due_date: t.due_date || "" }); setOpen(true); };

  return (
    <div>
      <div className="flex justify-between items-center mb-4"><h3 className="font-bold">Tasks</h3><Button size="sm" onClick={() => { setEditId(null); setForm({ title: "", description: "", status: "todo", priority: "medium", due_date: "" }); setOpen(true); }}><Plus className="w-4 h-4 mr-1" />Add Task</Button></div>
      {tasks.length === 0 ? <EmptyState icon={ListTodo} text="No tasks" /> : <div className="space-y-2">{tasks.map((t: any) => (
        <div key={t.id} className="flex items-center gap-3 p-3 border border-border rounded-lg hover:bg-muted/20">
          <div className={`w-3 h-3 rounded-full shrink-0 ${t.status === "done" ? "bg-emerald-500" : t.status === "in_progress" ? "bg-blue-500" : "bg-amber-400"}`} />
          <div className="flex-1 min-w-0"><p className="text-sm font-medium">{t.title}</p>{t.description && <p className="text-xs text-muted-foreground truncate">{t.description}</p>}</div>
          <div className="text-right shrink-0">{t.due_date && <p className="text-xs text-muted-foreground">{format(new Date(t.due_date), "dd MMM yyyy")}</p>}<span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${t.priority === "high" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" : "bg-muted text-muted-foreground"}`}>{t.priority}</span></div>
          <div className="flex gap-1"><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(t)}><Pencil className="w-3.5 h-3.5" /></Button><Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => del.mutate(t.id)}><Trash2 className="w-3.5 h-3.5" /></Button></div>
        </div>
      ))}</div>}
      <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>{editId ? "Edit Task" : "Add Task"}</DialogTitle></DialogHeader>
        <div className="grid gap-3 py-3">
          <div><Label>Title *</Label><Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} /></div>
          <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} /></div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Status</Label><Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todo">To Do</SelectItem><SelectItem value="in_progress">In Progress</SelectItem><SelectItem value="done">Done</SelectItem></SelectContent></Select></div>
            <div><Label>Priority</Label><Select value={form.priority} onValueChange={v => setForm(p => ({ ...p, priority: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="high">High</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="low">Low</SelectItem></SelectContent></Select></div>
            <div><Label>Due Date</Label><Input type="date" value={form.due_date} onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))} /></div>
          </div>
          <Button onClick={() => save.mutate()} disabled={!form.title || save.isPending} className="w-full">{save.isPending ? "Saving..." : editId ? "Update" : "Add Task"}</Button>
        </div>
      </DialogContent></Dialog>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// TAB: Documents — FULL CRUD
// ══════════════════════════════════════════════════════════════
function TabDocuments({ caseId, userId, documents, qc }: { caseId: string; userId: string; documents: any[]; qc: any }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", document_type: "", file_url: "" });
  const [editId, setEditId] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      const payload = { ...form, case_id: caseId, user_id: userId };
      if (editId) { await supabase.from("documents").update(payload).eq("id", editId); }
      else { await supabase.from("documents").insert(payload); }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["case-documents", caseId] }); setOpen(false); setEditId(null); setForm({ title: "", description: "", document_type: "", file_url: "" }); toast.success(editId ? "Updated" : "Document added"); },
    onError: (e: any) => toast.error(e.message),
  });
  const del = useMutation({ mutationFn: async (did: string) => { await supabase.from("documents").delete().eq("id", did); }, onSuccess: () => { qc.invalidateQueries({ queryKey: ["case-documents", caseId] }); toast.success("Deleted"); } });

  const openEdit = (d: any) => { setEditId(d.id); setForm({ title: d.title || "", description: d.description || "", document_type: d.document_type || "", file_url: d.file_url || "" }); setOpen(true); };

  return (
    <div>
      <div className="flex justify-between items-center mb-4"><h3 className="font-bold">Case Documents</h3><Button size="sm" onClick={() => { setEditId(null); setForm({ title: "", description: "", document_type: "", file_url: "" }); setOpen(true); }}><Plus className="w-4 h-4 mr-1" />Add Document</Button></div>
      {documents.length === 0 ? <EmptyState icon={FileText} text="No documents" /> : <div className="space-y-2">{documents.map((d: any) => (
        <div key={d.id} className="flex items-center gap-3 p-3 border border-border rounded-lg hover:bg-muted/20">
          <FileText className="w-5 h-5 text-primary shrink-0" />
          <div className="flex-1 min-w-0"><p className="text-sm font-medium">{d.title}</p><p className="text-xs text-muted-foreground">{d.document_type || "General"} • {format(new Date(d.created_at), "dd MMM yyyy")}</p></div>
          {d.file_url && <a href={d.file_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">View</a>}
          <div className="flex gap-1"><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(d)}><Pencil className="w-3.5 h-3.5" /></Button><Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => del.mutate(d.id)}><Trash2 className="w-3.5 h-3.5" /></Button></div>
        </div>
      ))}</div>}
      <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>{editId ? "Edit Document" : "Add Document"}</DialogTitle></DialogHeader>
        <div className="grid gap-3 py-3">
          <div><Label>Title *</Label><Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} /></div>
          <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} /></div>
          <div className="grid grid-cols-2 gap-3"><div><Label>Document Type</Label><Input value={form.document_type} onChange={e => setForm(p => ({ ...p, document_type: e.target.value }))} placeholder="e.g. Affidavit, Petition" /></div><div><Label>File URL</Label><Input value={form.file_url} onChange={e => setForm(p => ({ ...p, file_url: e.target.value }))} placeholder="https://..." /></div></div>
          <CloudinaryUpload label="Upload Document (PDF, DOCX, Image)" onUpload={(url, name) => setForm(p => ({ ...p, file_url: url, title: p.title || name }))} />
          {form.file_url && <p className="text-xs text-emerald-600 truncate">✓ File: {form.file_url}</p>}
          <Button onClick={() => save.mutate()} disabled={!form.title || save.isPending} className="w-full">{save.isPending ? "Saving..." : editId ? "Update" : "Add Document"}</Button>
        </div>
      </DialogContent></Dialog>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// TAB: Invoices — FULL CRUD
// ══════════════════════════════════════════════════════════════
function TabInvoices({ caseId, userId, invoices, qc }: { caseId: string; userId: string; invoices: any[]; qc: any }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ invoice_number: "", amount: "", tax: "0", total: "", status: "draft", due_date: "", notes: "" });
  const [editId, setEditId] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      const payload = { invoice_number: form.invoice_number, amount: Number(form.amount) || 0, tax: Number(form.tax) || 0, total: Number(form.total) || Number(form.amount) || 0, status: form.status, due_date: form.due_date || null, notes: form.notes || null, case_id: caseId, user_id: userId };
      if (editId) { await supabase.from("invoices").update(payload).eq("id", editId); }
      else { await supabase.from("invoices").insert(payload); }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["case-invoices", caseId] }); setOpen(false); setEditId(null); setForm({ invoice_number: "", amount: "", tax: "0", total: "", status: "draft", due_date: "", notes: "" }); toast.success(editId ? "Updated" : "Invoice added"); },
    onError: (e: any) => toast.error(e.message),
  });
  const del = useMutation({ mutationFn: async (iid: string) => { await supabase.from("invoices").delete().eq("id", iid); }, onSuccess: () => { qc.invalidateQueries({ queryKey: ["case-invoices", caseId] }); toast.success("Deleted"); } });

  const openEdit = (inv: any) => { setEditId(inv.id); setForm({ invoice_number: inv.invoice_number || "", amount: String(inv.amount || ""), tax: String(inv.tax || "0"), total: String(inv.total || ""), status: inv.status || "draft", due_date: inv.due_date || "", notes: inv.notes || "" }); setOpen(true); };

  return (
    <div>
      <div className="flex justify-between items-center mb-4"><h3 className="font-bold">Invoices</h3><Button size="sm" onClick={() => { setEditId(null); setForm({ invoice_number: "", amount: "", tax: "0", total: "", status: "draft", due_date: "", notes: "" }); setOpen(true); }}><Plus className="w-4 h-4 mr-1" />Add Invoice</Button></div>
      {invoices.length === 0 ? <EmptyState icon={Receipt} text="No invoices" /> : <div className="space-y-2">{invoices.map((inv: any) => (
        <div key={inv.id} className="flex items-center gap-3 p-3 border border-border rounded-lg hover:bg-muted/20">
          <Receipt className="w-5 h-5 text-rose-500 shrink-0" />
          <div className="flex-1 min-w-0"><p className="text-sm font-medium">#{inv.invoice_number}</p><p className="text-xs text-muted-foreground">{inv.due_date ? format(new Date(inv.due_date), "dd MMM yyyy") : "No due date"}</p></div>
          <div className="text-right shrink-0"><p className="text-sm font-bold">{CURRENCY}{inv.total}</p><span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${inv.status === "paid" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"}`}>{inv.status}</span></div>
          <div className="flex gap-1"><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(inv)}><Pencil className="w-3.5 h-3.5" /></Button><Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => del.mutate(inv.id)}><Trash2 className="w-3.5 h-3.5" /></Button></div>
        </div>
      ))}</div>}
      <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>{editId ? "Edit Invoice" : "Add Invoice"}</DialogTitle></DialogHeader>
        <div className="grid gap-3 py-3">
          <div className="grid grid-cols-2 gap-3"><div><Label>Invoice Number *</Label><Input value={form.invoice_number} onChange={e => setForm(p => ({ ...p, invoice_number: e.target.value }))} /></div><div><Label>Status</Label><Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="draft">Draft</SelectItem><SelectItem value="sent">Sent</SelectItem><SelectItem value="paid">Paid</SelectItem><SelectItem value="overdue">Overdue</SelectItem></SelectContent></Select></div></div>
          <div className="grid grid-cols-3 gap-3"><div><Label>Amount</Label><Input type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value, total: String(Number(e.target.value) + Number(p.tax)) }))} /></div><div><Label>Tax</Label><Input type="number" value={form.tax} onChange={e => setForm(p => ({ ...p, tax: e.target.value, total: String(Number(p.amount) + Number(e.target.value)) }))} /></div><div><Label>Total</Label><Input type="number" value={form.total} onChange={e => setForm(p => ({ ...p, total: e.target.value }))} /></div></div>
          <div className="grid grid-cols-2 gap-3"><div><Label>Due Date</Label><Input type="date" value={form.due_date} onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))} /></div></div>
          <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} /></div>
          <Button onClick={() => save.mutate()} disabled={!form.invoice_number || save.isPending} className="w-full">{save.isPending ? "Saving..." : editId ? "Update" : "Add Invoice"}</Button>
        </div>
      </DialogContent></Dialog>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// TAB: Expenses — FULL CRUD
// ══════════════════════════════════════════════════════════════
function TabExpenses({ caseId, userId, expenses, qc }: { caseId: string; userId: string; expenses: any[]; qc: any }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", amount: "", category: "", expense_date: new Date().toISOString().slice(0, 10) });
  const [editId, setEditId] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      const payload = { title: form.title, description: form.description || null, amount: Number(form.amount) || 0, category: form.category || null, expense_date: form.expense_date, case_id: caseId, user_id: userId };
      if (editId) { await supabase.from("expenses").update(payload).eq("id", editId); }
      else { await supabase.from("expenses").insert(payload); }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["case-expenses", caseId] }); setOpen(false); setEditId(null); setForm({ title: "", description: "", amount: "", category: "", expense_date: new Date().toISOString().slice(0, 10) }); toast.success(editId ? "Updated" : "Expense added"); },
    onError: (e: any) => toast.error(e.message),
  });
  const del = useMutation({ mutationFn: async (eid: string) => { await supabase.from("expenses").delete().eq("id", eid); }, onSuccess: () => { qc.invalidateQueries({ queryKey: ["case-expenses", caseId] }); toast.success("Deleted"); } });

  const openEdit = (e: any) => { setEditId(e.id); setForm({ title: e.title || "", description: e.description || "", amount: String(e.amount || ""), category: e.category || "", expense_date: e.expense_date || "" }); setOpen(true); };

  return (
    <div>
      <div className="flex justify-between items-center mb-4"><h3 className="font-bold">Expenses</h3><Button size="sm" onClick={() => { setEditId(null); setForm({ title: "", description: "", amount: "", category: "", expense_date: new Date().toISOString().slice(0, 10) }); setOpen(true); }}><Plus className="w-4 h-4 mr-1" />Add Expense</Button></div>
      {expenses.length === 0 ? <EmptyState icon={DollarSign} text="No expenses" /> : <div className="space-y-2">{expenses.map((e: any) => (
        <div key={e.id} className="flex items-center gap-3 p-3 border border-border rounded-lg hover:bg-muted/20">
          <DollarSign className="w-5 h-5 text-orange-500 shrink-0" />
          <div className="flex-1 min-w-0"><p className="text-sm font-medium">{e.title}</p><p className="text-xs text-muted-foreground">{e.category || "General"} • {e.expense_date ? format(new Date(e.expense_date), "dd MMM yyyy") : "—"}</p></div>
          <p className="text-sm font-bold shrink-0">{CURRENCY}{e.amount}</p>
          <div className="flex gap-1"><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(e)}><Pencil className="w-3.5 h-3.5" /></Button><Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => del.mutate(e.id)}><Trash2 className="w-3.5 h-3.5" /></Button></div>
        </div>
      ))}</div>}
      <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>{editId ? "Edit Expense" : "Add Expense"}</DialogTitle></DialogHeader>
        <div className="grid gap-3 py-3">
          <div><Label>Title *</Label><Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Court Filing Fee" /></div>
          <div className="grid grid-cols-3 gap-3"><div><Label>Amount *</Label><Input type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} /></div><div><Label>Category</Label><Input value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} placeholder="e.g. Filing, Travel" /></div><div><Label>Date</Label><Input type="date" value={form.expense_date} onChange={e => setForm(p => ({ ...p, expense_date: e.target.value }))} /></div></div>
          <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} /></div>
          <Button onClick={() => save.mutate()} disabled={!form.title || save.isPending} className="w-full">{save.isPending ? "Saving..." : editId ? "Update" : "Add Expense"}</Button>
        </div>
      </DialogContent></Dialog>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// TAB: Notes — CRUD via communication_logs
// ══════════════════════════════════════════════════════════════
function TabNotes({ caseId, userId, caseData, qc }: { caseId: string; userId: string; caseData: any; qc: any }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ summary: "", notes: "", type: "other" as string });

  const { data: logs = [] } = useQuery({
    queryKey: ["case-comms", caseId],
    queryFn: async () => { const { data } = await supabase.from("communication_logs").select("*").eq("case_id", caseId).order("date", { ascending: false }); return data || []; },
  });

  const save = useMutation({
    mutationFn: async () => { await supabase.from("communication_logs").insert({ summary: form.summary, notes: form.notes || null, type: form.type, case_id: caseId, user_id: userId }); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["case-comms", caseId] }); setOpen(false); setForm({ summary: "", notes: "", type: "other" }); toast.success("Note added"); },
    onError: (e: any) => toast.error(e.message),
  });
  const del = useMutation({ mutationFn: async (lid: string) => { await supabase.from("communication_logs").delete().eq("id", lid); }, onSuccess: () => { qc.invalidateQueries({ queryKey: ["case-comms", caseId] }); toast.success("Deleted"); } });

  const allNotes = [...(caseData.case_notes_1 ? [{ id: "n1", summary: caseData.case_notes_1, type: "note", date: caseData.created_at, fixed: true }] : []), ...(caseData.case_notes_2 ? [{ id: "n2", summary: caseData.case_notes_2, type: "note", date: caseData.created_at, fixed: true }] : []), ...logs];

  return (
    <div>
      <div className="flex justify-between items-center mb-4"><h3 className="font-bold">Notes & Communications</h3><Button size="sm" onClick={() => { setForm({ summary: "", notes: "", type: "other" }); setOpen(true); }}><Plus className="w-4 h-4 mr-1" />Add Note</Button></div>
      {allNotes.length === 0 ? <EmptyState icon={StickyNote} text="No notes" /> : <div className="space-y-2">{allNotes.map((n: any) => (
        <div key={n.id} className="flex items-start gap-3 p-3 border border-border rounded-lg hover:bg-muted/20">
          <StickyNote className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0"><p className="text-sm">{n.summary}</p>{n.notes && <p className="text-xs text-muted-foreground mt-1">{n.notes}</p>}</div>
          <div className="text-right shrink-0"><span className="text-[10px] uppercase font-bold bg-muted px-1.5 py-0.5 rounded">{n.type}</span>{n.date && <p className="text-xs text-muted-foreground mt-1">{format(new Date(n.date), "dd MMM yyyy")}</p>}</div>
          {!n.fixed && <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive shrink-0" onClick={() => del.mutate(n.id)}><Trash2 className="w-3.5 h-3.5" /></Button>}
        </div>
      ))}</div>}
      <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>Add Note</DialogTitle></DialogHeader>
        <div className="grid gap-3 py-3">
          <div><Label>Summary *</Label><Input value={form.summary} onChange={e => setForm(p => ({ ...p, summary: e.target.value }))} placeholder="Brief note..." /></div>
          <div><Label>Details</Label><Textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} /></div>
          <div><Label>Type</Label><Select value={form.type} onValueChange={v => setForm(p => ({ ...p, type: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="call">Call</SelectItem><SelectItem value="email">Email</SelectItem><SelectItem value="meeting">Meeting</SelectItem><SelectItem value="message">Message</SelectItem><SelectItem value="letter">Letter</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent></Select></div>
          <Button onClick={() => save.mutate()} disabled={!form.summary || save.isPending} className="w-full">{save.isPending ? "Saving..." : "Add Note"}</Button>
        </div>
      </DialogContent></Dialog>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// TAB: Notify to Clients (placeholder with action button)
// ══════════════════════════════════════════════════════════════
// TAB: Notify to Clients — Hearing Reminders
// ══════════════════════════════════════════════════════════════
function TabNotify({ caseId, userId, caseData, qc }: { caseId: string; userId: string; caseData: any; qc: any }) {
  const { data: reminders = [] } = useQuery({
    queryKey: ["case-reminders", caseId],
    queryFn: async () => {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
      const session = (await supabase.auth.getSession()).data.session;
      const authToken = session?.access_token || supabaseKey;
      const res = await fetch(`${supabaseUrl}/rest/v1/hearing_reminders?case_id=eq.${caseId}&order=hearing_date.asc`, {
        headers: { "apikey": supabaseKey, "Authorization": `Bearer ${authToken}` },
      });
      if (!res.ok) return [];
      return await res.json();
    },
  });

  const dismiss = useMutation({
    mutationFn: async (rid: string) => {
      await supabase.from("hearing_reminders" as any).update({ is_dismissed: true } as any).eq("id", rid);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["case-reminders", caseId] }); },
  });

  // Auto-generate reminders from next_hearing_date
  const createReminder = useMutation({
    mutationFn: async () => {
      if (!caseData.next_hearing_date) throw new Error("No next hearing date set on this case");
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
      const session = (await supabase.auth.getSession()).data.session;
      const authToken = session?.access_token || supabaseKey;
      const payload = [{
        case_id: caseId,
        case_number: caseData.case_number,
        title: `Hearing Reminder: ${caseData.title}`,
        hearing_date: caseData.next_hearing_date,
        remind_days_before: 1,
        is_dismissed: false,
        user_id: userId,
      }, {
        case_id: caseId,
        case_number: caseData.case_number,
        title: `Hearing Reminder (3 days): ${caseData.title}`,
        hearing_date: caseData.next_hearing_date,
        remind_days_before: 3,
        is_dismissed: false,
        user_id: userId,
      }];
      const res = await fetch(`${supabaseUrl}/rest/v1/hearing_reminders`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": supabaseKey, "Authorization": `Bearer ${authToken}`, "Prefer": "return=minimal" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message || "Failed"); }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["case-reminders", caseId] }); toast.success("Reminders created for next hearing date"); },
    onError: (e: any) => toast.error(e.message),
  });

  const today = new Date();
  const nextHearingDate = caseData.next_hearing_date ? new Date(caseData.next_hearing_date) : null;
  const daysUntilHearing = nextHearingDate ? Math.ceil((nextHearingDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) : null;

  return (
    <div className="space-y-5">
      <div className="flex justify-between items-center">
        <h3 className="font-bold text-foreground">Hearing Reminders</h3>
        <Button size="sm" onClick={() => createReminder.mutate()} disabled={createReminder.isPending || !caseData.next_hearing_date}>
          <AlarmClock className="w-4 h-4 mr-1" />{createReminder.isPending ? "Creating..." : "Set Reminders"}
        </Button>
      </div>

      {/* Next hearing info */}
      {nextHearingDate && (
        <div className={`p-4 rounded-xl border ${daysUntilHearing !== null && daysUntilHearing <= 3 ? "bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700" : "bg-muted/30 border-border"}`}>
          <div className="flex items-center gap-3">
            <CalendarDays className={`w-5 h-5 ${daysUntilHearing !== null && daysUntilHearing <= 3 ? "text-amber-600" : "text-muted-foreground"}`} />
            <div>
              <p className="text-sm font-semibold text-foreground">Next Hearing: {format(nextHearingDate, "dd MMMM yyyy")}</p>
              {daysUntilHearing !== null && (
                <p className={`text-xs font-medium ${daysUntilHearing <= 0 ? "text-red-600" : daysUntilHearing <= 3 ? "text-amber-600" : "text-muted-foreground"}`}>
                  {daysUntilHearing <= 0 ? "Today / Overdue" : `${daysUntilHearing} day(s) remaining`}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {!caseData.next_hearing_date && (
        <div className="p-4 rounded-lg bg-muted/30 border border-border text-sm text-muted-foreground">
          No next hearing date set. Edit the case to add a hearing date first.
        </div>
      )}

      {/* Reminder list */}
      {reminders.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Active Reminders</p>
          {reminders.map((r: any) => (
            <div key={r.id} className={`flex items-center gap-3 p-3 rounded-lg border ${r.is_dismissed ? "opacity-50 border-border bg-muted/10" : "border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10"}`}>
              <AlarmClock className={`w-4 h-4 shrink-0 ${r.is_dismissed ? "text-muted-foreground" : "text-amber-600"}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{r.title}</p>
                <p className="text-xs text-muted-foreground">
                  Hearing: {r.hearing_date} • Remind {r.remind_days_before} day(s) before
                  {r.is_dismissed && " • Dismissed"}
                </p>
              </div>
              {!r.is_dismissed && (
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => dismiss.mutate(r.id)} title="Dismiss">
                  <X className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {reminders.length === 0 && caseData.next_hearing_date && (
        <EmptyState icon={AlarmClock} text='Click "Set Reminders" to create automatic hearing reminders' />
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// TAB: Related Judgments — FULL CRUD
// ══════════════════════════════════════════════════════════════
function TabJudgments({ caseId, userId, qc }: { caseId: string; userId: string; qc: any }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", citation: "", court: "", year: "", summary: "", url: "", relevance: "" });
  const [editId, setEditId] = useState<string | null>(null);

  const { data: judgments = [] } = useQuery({
    queryKey: ["case-judgments", caseId],
    queryFn: async () => {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
      const session = (await supabase.auth.getSession()).data.session;
      const authToken = session?.access_token || supabaseKey;
      const res = await fetch(`${supabaseUrl}/rest/v1/case_judgments?case_id=eq.${caseId}&order=created_at.desc`, {
        headers: { "apikey": supabaseKey, "Authorization": `Bearer ${authToken}` },
      });
      if (!res.ok) return [];
      return await res.json();
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
      const session = (await supabase.auth.getSession()).data.session;
      const authToken = session?.access_token || supabaseKey;
      const payload = { ...form, case_id: caseId, user_id: userId };
      const url = editId ? `${supabaseUrl}/rest/v1/case_judgments?id=eq.${editId}` : `${supabaseUrl}/rest/v1/case_judgments`;
      const method = editId ? "PATCH" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json", "apikey": supabaseKey, "Authorization": `Bearer ${authToken}`, "Prefer": "return=minimal" }, body: JSON.stringify(payload) });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message || "Failed"); }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["case-judgments", caseId] }); setOpen(false); setEditId(null); setForm({ title: "", citation: "", court: "", year: "", summary: "", url: "", relevance: "" }); toast.success(editId ? "Updated" : "Judgment linked"); },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (jid: string) => {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
      const session = (await supabase.auth.getSession()).data.session;
      const authToken = session?.access_token || supabaseKey;
      await fetch(`${supabaseUrl}/rest/v1/case_judgments?id=eq.${jid}`, { method: "DELETE", headers: { "apikey": supabaseKey, "Authorization": `Bearer ${authToken}` } });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["case-judgments", caseId] }); toast.success("Removed"); },
  });

  const openEdit = (j: any) => { setEditId(j.id); setForm({ title: j.title || "", citation: j.citation || "", court: j.court || "", year: j.year || "", summary: j.summary || "", url: j.url || "", relevance: j.relevance || "" }); setOpen(true); };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-foreground">Related Judgments & Precedents</h3>
        <Button size="sm" onClick={() => { setEditId(null); setForm({ title: "", citation: "", court: "", year: "", summary: "", url: "", relevance: "" }); setOpen(true); }}>
          <Plus className="w-4 h-4 mr-1" />Link Judgment
        </Button>
      </div>

      {judgments.length === 0 ? <EmptyState icon={Scale} text="No judgments linked. Add relevant case laws and precedents." /> : (
        <div className="space-y-3">
          {judgments.map((j: any) => (
            <div key={j.id} className="p-4 border border-border rounded-xl hover:bg-muted/20 transition-colors">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold text-foreground">{j.title}</p>
                    {j.citation && <span className="text-[10px] font-mono bg-primary/10 text-primary px-1.5 py-0.5 rounded">{j.citation}</span>}
                    {j.year && <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded">{j.year}</span>}
                  </div>
                  {j.court && <p className="text-xs text-muted-foreground mt-0.5">{j.court}</p>}
                  {j.relevance && <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 font-medium">Relevance: {j.relevance}</p>}
                  {j.summary && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{j.summary}</p>}
                  {j.url && <a href={j.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1 mt-1"><ExternalLink className="w-3 h-3" />View Judgment</a>}
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(j)}><Pencil className="w-3.5 h-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => del.mutate(j.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editId ? "Edit Judgment" : "Link Judgment / Precedent"}</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-3">
            <div><Label>Case Title / Judgment Name *</Label><Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Cheque Dishonour — 138 NI Act" /></div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Citation</Label><Input value={form.citation} onChange={e => setForm(p => ({ ...p, citation: e.target.value }))} placeholder="e.g. AIR 2020 SC 123" /></div>
              <div><Label>Court</Label><Input value={form.court} onChange={e => setForm(p => ({ ...p, court: e.target.value }))} placeholder="e.g. Supreme Court" /></div>
              <div><Label>Year</Label><Input value={form.year} onChange={e => setForm(p => ({ ...p, year: e.target.value }))} placeholder="e.g. 2020" /></div>
            </div>
            <div><Label>Relevance to This Case</Label><Input value={form.relevance} onChange={e => setForm(p => ({ ...p, relevance: e.target.value }))} placeholder="e.g. Supports accused's defence on dishonour" /></div>
            <div><Label>Summary</Label><Textarea value={form.summary} onChange={e => setForm(p => ({ ...p, summary: e.target.value }))} placeholder="Brief summary of the judgment..." /></div>
            <div><Label>Judgment URL (optional)</Label><Input value={form.url} onChange={e => setForm(p => ({ ...p, url: e.target.value }))} placeholder="https://indiankanoon.org/..." /></div>
            <Button onClick={() => save.mutate()} disabled={!form.title || save.isPending} className="w-full">{save.isPending ? "Saving..." : editId ? "Update" : "Link Judgment"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// TAB: AI Document Drafting
// ══════════════════════════════════════════════════════════════
function TabTimeEntries({ caseId, userId, caseData, qc }: { caseId: string; userId: string; caseData: any; qc: any }) {
  const { getActiveConfig, hasActiveKey } = useAIConfig();
  const [docType, setDocType] = useState("adjournment");
  const [customPrompt, setCustomPrompt] = useState("");
  const [generatedDoc, setGeneratedDoc] = useState("");
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const DOC_TYPES = [
    { id: "adjournment", label: "Adjournment Application" },
    { id: "pursis", label: "Pursis" },
    { id: "issue_process", label: "Application for Issue Process (Sec. 204 CrPC)" },
    { id: "show_cause", label: "Show Cause Notice Reply" },
    { id: "bail_application", label: "Bail Application" },
    { id: "vakalatnama", label: "Vakalatnama" },
    { id: "custom", label: "Custom Document" },
  ];

  const handleGenerate = async () => {
    if (!hasActiveKey) { toast.error("Configure an AI provider in AI Settings first"); return; }
    setGenerating(true);
    setGeneratedDoc("");

    const caseContext = `
Case Number: ${caseData.case_number}
Case Title: ${caseData.title}
Court: ${caseData.court_name || "Not specified"}
Court Type: ${caseData.court_type || "Not specified"}
CNR Number: ${caseData.cnr_number || "Not specified"}
Filing Date: ${caseData.filing_date || "Not specified"}
Next Hearing Date: ${caseData.next_hearing_date || "Not specified"}
Last Hearing Date: ${caseData.last_hearing_date || "Not specified"}
Case Stage: ${caseData.case_stage || "Not specified"}
Case Side: ${caseData.case_side || "Not specified"}
FIR Number: ${caseData.fir_number || "Not specified"}
Police Station: ${caseData.police_station || "Not specified"}
Status: ${caseData.status}
Notes: ${caseData.case_notes_1 || ""} ${caseData.case_notes_2 || ""}
    `.trim();

    const docLabel = DOC_TYPES.find(d => d.id === docType)?.label || docType;

    const prompt = docType === "custom"
      ? `${customPrompt}\n\nCase Details:\n${caseContext}`
      : `Draft a formal ${docLabel} for the following case in professional legal language suitable for Indian courts (Akola/Washim, Maharashtra). Use the case details provided. Keep all fixed legal text verbatim. Leave blanks as ____ where specific data is missing.\n\nCase Details:\n${caseContext}`;

    try {
      const config = getActiveConfig();
      const response = await sendAIMessage(config, [
        { role: "system", content: "You are a legal document drafting assistant for advocates in Maharashtra, India. You draft precise, formal court documents. Never invent facts. Leave blanks as ____ for missing information." },
        { role: "user", content: prompt },
      ]);
      setGeneratedDoc(response.content);
      toast.success(`${docLabel} drafted successfully`);
    } catch (e: any) {
      toast.error(e.message || "AI generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedDoc);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="w-5 h-5 text-primary" />
        <h3 className="font-bold text-foreground">AI Document Drafting</h3>
      </div>

      {!hasActiveKey && (
        <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl text-sm">
          <p className="font-semibold text-amber-800 dark:text-amber-300">AI not configured</p>
          <p className="text-amber-700 dark:text-amber-400 mt-1">Go to <strong>AI Settings</strong> in the sidebar and add a Groq / OpenAI / Gemini API key to use this feature.</p>
        </div>
      )}

      <div className="grid gap-4">
        <div>
          <Label className="font-semibold text-muted-foreground">Select Document Type</Label>
          <Select value={docType} onValueChange={setDocType}>
            <SelectTrigger className="bg-muted/50 mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {DOC_TYPES.map(d => <SelectItem key={d.id} value={d.id}>{d.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {docType === "custom" && (
          <div>
            <Label className="font-semibold text-muted-foreground">Custom Instructions</Label>
            <Textarea value={customPrompt} onChange={e => setCustomPrompt(e.target.value)} placeholder="Describe what document you want drafted and any specific instructions..." className="bg-muted/50 mt-1 min-h-[80px]" />
          </div>
        )}

        {/* Case context preview */}
        <div className="p-3 bg-muted/30 border border-border rounded-lg">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Case Context (auto-filled)</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            {[
              ["Case No.", caseData.case_number],
              ["Court", caseData.court_name || "—"],
              ["Next Hearing", caseData.next_hearing_date || "—"],
              ["Stage", caseData.case_stage || "—"],
            ].map(([k, v]) => (
              <div key={k} className="flex gap-2">
                <span className="text-[11px] text-muted-foreground w-24 shrink-0">{k}:</span>
                <span className="text-[11px] font-medium text-foreground truncate">{v}</span>
              </div>
            ))}
          </div>
        </div>

        <Button onClick={handleGenerate} disabled={generating || !hasActiveKey} className="w-full" size="lg">
          {generating ? (
            <><span className="animate-spin mr-2">⟳</span>Drafting document...</>
          ) : (
            <><Sparkles className="w-4 h-4 mr-2" />Generate {DOC_TYPES.find(d => d.id === docType)?.label}</>
          )}
        </Button>
      </div>

      {/* Generated document */}
      {generatedDoc && (
        <div className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-sm font-semibold text-foreground">Generated Document</p>
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={handleCopy}>
                {copied ? <><Check className="w-3.5 h-3.5 mr-1 text-emerald-500" />Copied</> : "Copy"}
              </Button>
              <Button variant="outline" size="sm" onClick={() => handlePrintDoc(generatedDoc, caseData)}>
                🖨️ Print
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleDownloadPDF(generatedDoc, caseData)}>
                📄 PDF
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleDownloadWord(generatedDoc, caseData)}>
                📝 Word
              </Button>
            </div>
          </div>
          <div className="bg-white dark:bg-muted/20 border border-border rounded-xl p-5 max-h-[500px] overflow-y-auto custom-scrollbar" id="ai-doc-preview">
            <pre className="whitespace-pre-wrap text-xs font-mono text-foreground leading-relaxed">{generatedDoc}</pre>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Print Document ────────────────────────────────────────────────────
function handlePrintDoc(content: string, caseData: any) {
  const printWindow = window.open("", "_blank");
  if (!printWindow) { toast.error("Popup blocked. Allow popups to print."); return; }
  printWindow.document.write(`<!DOCTYPE html><html><head><title>${caseData.case_number} - Document</title>
<style>
  body { font-family: 'Times New Roman', serif; font-size: 13pt; line-height: 1.8; margin: 40px 60px; color: #000; }
  pre { white-space: pre-wrap; word-wrap: break-word; font-family: 'Times New Roman', serif; font-size: 13pt; margin: 0; }
  @media print { body { margin: 20mm 25mm; } }
</style></head><body><pre>${content}</pre>
<script>window.onload = function() { window.print(); }</script></body></html>`);
  printWindow.document.close();
}

// ── Download as PDF ───────────────────────────────────────────────────
async function handleDownloadPDF(content: string, caseData: any) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 25;
  const usableWidth = pageWidth - margin * 2;
  const lineHeight = 6;
  let y = margin;

  doc.setFont("times", "normal");
  doc.setFontSize(12);

  const lines = content.split("\n");
  for (const line of lines) {
    if (y + lineHeight > pageHeight - margin) { doc.addPage(); y = margin; }
    if (line.trim() === "") { y += lineHeight * 0.4; continue; }
    const wrapped = doc.splitTextToSize(line, usableWidth);
    for (const wLine of wrapped) {
      if (y + lineHeight > pageHeight - margin) { doc.addPage(); y = margin; }
      doc.text(wLine, margin, y);
      y += lineHeight;
    }
  }

  // Page numbers
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) { doc.setPage(i); doc.setFontSize(9); doc.setTextColor(120); doc.text(`Page ${i} of ${total}`, pageWidth / 2, pageHeight - 10, { align: "center" }); doc.setTextColor(0); }

  doc.save(`${caseData.case_number}_document.pdf`);
  toast.success("PDF downloaded");
}

// ── Download as Word (.doc) ───────────────────────────────────────────
function handleDownloadWord(content: string, caseData: any) {
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>${caseData.case_number}</title>
<style>
  body { font-family: 'Times New Roman', serif; font-size: 13pt; line-height: 1.8; margin: 1in; }
  pre { white-space: pre-wrap; word-wrap: break-word; font-family: 'Times New Roman', serif; font-size: 13pt; }
</style></head><body><pre>${content.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre></body></html>`;

  const blob = new Blob([html], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${caseData.case_number}_document.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast.success("Word document downloaded");
}
