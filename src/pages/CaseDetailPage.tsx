import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useMinLoader } from "@/hooks/useMinLoader";
import { PageHeader } from "@/components/PageHeader";
import { PageLoader } from "@/components/PageLoader";
import { format } from "date-fns";
import {
  Gavel, ListTodo, Receipt, FileText, DollarSign, Clock,
  CalendarDays, ChevronLeft, BriefcaseBusiness, User, AlertCircle,
  Bell, BookOpen, StickyNote, Scale
} from "lucide-react";
import { CASE_STATUS_CONFIG, type CaseStatus, CURRENCY } from "@/lib/constants";

// ── Tab definitions ───────────────────────────────────────────────────
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
  { id: "time", label: "Time Entries", icon: Clock },
] as const;

type TabId = typeof TABS[number]["id"];

export default function CaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabId>("history");

  // Fetch Case Details
  const { data: caseData, isLoading: loadingCase } = useQuery({
    queryKey: ["case-detail", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("cases").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch hearings
  const { data: hearings = [] } = useQuery({
    queryKey: ["case-hearings", id],
    queryFn: async () => {
      const { data } = await supabase.from("hearings").select("*").eq("case_id", id).order("hearing_date", { ascending: false });
      return data || [];
    },
    enabled: !!id,
  });

  // Fetch tasks
  const { data: tasks = [] } = useQuery({
    queryKey: ["case-tasks", id],
    queryFn: async () => {
      const { data } = await supabase.from("tasks").select("*").eq("case_id", id).order("due_date", { ascending: false });
      return data || [];
    },
    enabled: !!id,
  });

  // Fetch invoices
  const { data: invoices = [] } = useQuery({
    queryKey: ["case-invoices", id],
    queryFn: async () => {
      const { data } = await supabase.from("invoices").select("*").eq("case_id", id).order("issue_date", { ascending: false });
      return data || [];
    },
    enabled: !!id,
  });

  // Fetch expenses
  const { data: expenses = [] } = useQuery({
    queryKey: ["case-expenses", id],
    queryFn: async () => {
      const { data } = await supabase.from("expenses").select("*").eq("case_id", id).order("expense_date", { ascending: false });
      return data || [];
    },
    enabled: !!id,
  });

  // Fetch documents
  const { data: documents = [] } = useQuery({
    queryKey: ["case-documents", id],
    queryFn: async () => {
      const { data } = await supabase.from("documents").select("*").eq("case_id", id).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!id,
  });

  const showLoader = useMinLoader(loadingCase);
  if (showLoader) return <PageLoader />;

  if (!caseData) {
    return (
      <div className="flex flex-col items-center justify-center py-20 animate-in fade-in">
        <AlertCircle className="w-12 h-12 text-muted-foreground opacity-50 mb-4" />
        <h2 className="text-xl font-bold text-foreground">Case Not Found</h2>
        <p className="text-muted-foreground mt-2 mb-6">The case you are looking for does not exist or was deleted.</p>
        <button onClick={() => navigate("/cases")} className="text-primary hover:underline font-medium">Back to Cases</button>
      </div>
    );
  }

  const sConf = CASE_STATUS_CONFIG[caseData.status as CaseStatus] ?? CASE_STATUS_CONFIG["open"];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate("/cases")} className="p-2 rounded-md hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <PageHeader title={caseData.title} breadcrumbs={[{ label: "Cases", path: "/cases" }, { label: caseData.case_number }]} />
      </div>

      {/* Case Info Card */}
      <div className="bg-card border border-border shadow-sm rounded-xl p-5">
        <div className="flex flex-wrap items-center gap-4 mb-4">
          <div className="font-mono font-medium text-foreground bg-muted/80 px-2.5 py-1 rounded-md text-xs border border-border">{caseData.case_number}</div>
          <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider border ${sConf.bg} ${sConf.text} ${sConf.border}`}>
            {caseData.status}
          </span>
          {caseData.court_type && <span className="text-xs bg-muted px-2 py-0.5 rounded border border-border text-muted-foreground">{caseData.court_type}</span>}
          {caseData.case_side && <span className="text-xs bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300">{caseData.case_side}</span>}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 text-sm">
          <InfoField label="Court Name" value={caseData.court_name} />
          <InfoField label="CNR Number" value={caseData.cnr_number} />
          <InfoField label="File Number" value={caseData.file_number} />
          <InfoField label="Filing Date" value={caseData.filing_date ? format(new Date(caseData.filing_date), "dd/MM/yyyy") : null} />
          <InfoField label="Next Hearing" value={caseData.next_hearing_date ? format(new Date(caseData.next_hearing_date), "dd/MM/yyyy") : null} />
          <InfoField label="Last Hearing" value={caseData.last_hearing_date ? format(new Date(caseData.last_hearing_date), "dd/MM/yyyy") : null} />
          <InfoField label="Case Stage" value={caseData.case_stage} />
          <InfoField label="Stage" value={caseData.stage} />
          <InfoField label="FIR Number" value={caseData.fir_number} />
          <InfoField label="Police Station" value={caseData.police_station} />
          <InfoField label="Case Tags" value={caseData.case_tags} />
          <InfoField label="Disposed Date" value={caseData.disposed_date ? format(new Date(caseData.disposed_date), "dd/MM/yyyy") : null} />
        </div>

        {(caseData.case_notes_1 || caseData.case_notes_2) && (
          <div className="mt-4 pt-4 border-t border-border grid grid-cols-1 md:grid-cols-2 gap-3">
            {caseData.case_notes_1 && <div className="text-xs bg-muted/30 p-2.5 rounded-lg border border-border/50"><span className="font-semibold text-muted-foreground">Note 1:</span> {caseData.case_notes_1}</div>}
            {caseData.case_notes_2 && <div className="text-xs bg-muted/30 p-2.5 rounded-lg border border-border/50"><span className="font-semibold text-muted-foreground">Note 2:</span> {caseData.case_notes_2}</div>}
          </div>
        )}
      </div>

      {/* Tabs Navigation */}
      <div className="border-b border-border overflow-x-auto">
        <nav className="flex gap-0 min-w-max">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-card border border-border shadow-sm rounded-xl p-6 min-h-[400px]">
        {activeTab === "history" && <TabCaseHistory hearings={hearings} tasks={tasks} invoices={invoices} expenses={expenses} documents={documents} />}
        {activeTab === "documents" && <TabDocuments documents={documents} />}
        {activeTab === "notes" && <TabNotes caseData={caseData} />}
        {activeTab === "notify" && <TabNotify />}
        {activeTab === "judgments" && <TabJudgments />}
        {activeTab === "tasks" && <TabTasks tasks={tasks} />}
        {activeTab === "appointments" && <TabAppointments hearings={hearings} />}
        {activeTab === "invoices" && <TabInvoices invoices={invoices} />}
        {activeTab === "expenses" && <TabExpenses expenses={expenses} />}
        {activeTab === "time" && <TabTimeEntries />}
      </div>
    </div>
  );
}

// ── Info Field Component ──────────────────────────────────────────────
function InfoField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className="text-sm font-medium text-foreground mt-0.5">{value || "—"}</p>
    </div>
  );
}

// ── Tab: Case History (Timeline) ──────────────────────────────────────
function TabCaseHistory({ hearings, tasks, invoices, expenses, documents }: any) {
  const events: any[] = [];

  (hearings || []).forEach((h: any) => {
    events.push({ date: new Date(h.hearing_date), title: `Hearing: ${h.purpose || "Scheduled"}`, subtitle: `Court: ${h.court_name || "N/A"}`, type: "hearing", status: h.status });
  });
  (tasks || []).forEach((t: any) => {
    if (t.due_date) events.push({ date: new Date(t.due_date), title: `Task: ${t.title}`, type: "task", status: t.status });
  });
  (invoices || []).forEach((inv: any) => {
    if (inv.issue_date) events.push({ date: new Date(inv.issue_date), title: `Invoice #${inv.invoice_number}`, subtitle: `${CURRENCY}${inv.total}`, type: "invoice", status: inv.status });
  });
  (expenses || []).forEach((e: any) => {
    if (e.expense_date) events.push({ date: new Date(e.expense_date), title: `Expense: ${e.category || "General"}`, subtitle: `${CURRENCY}${e.amount}`, type: "expense" });
  });
  (documents || []).forEach((d: any) => {
    events.push({ date: new Date(d.created_at), title: `Document: ${d.title}`, subtitle: d.file_type, type: "document" });
  });

  events.sort((a, b) => b.date.getTime() - a.date.getTime());

  if (events.length === 0) return <EmptyState icon={Clock} text="No case history yet" />;

  return (
    <div className="space-y-3">
      {events.map((ev, i) => (
        <div key={i} className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-muted/20 transition-colors">
          <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${ev.type === "hearing" ? "bg-amber-500" : ev.type === "task" ? "bg-blue-500" : ev.type === "invoice" ? "bg-rose-500" : ev.type === "expense" ? "bg-orange-500" : "bg-emerald-500"}`} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">{ev.title}</p>
            {ev.subtitle && <p className="text-xs text-muted-foreground">{ev.subtitle}</p>}
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs text-muted-foreground">{format(ev.date, "dd MMM yyyy")}</p>
            {ev.status && <span className="text-[10px] uppercase font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded mt-1 inline-block">{ev.status}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Tab: Documents ────────────────────────────────────────────────────
function TabDocuments({ documents }: { documents: any[] }) {
  if (documents.length === 0) return <EmptyState icon={FileText} text="No documents uploaded for this case" />;
  return (
    <div className="space-y-2">
      {documents.map((d: any) => (
        <div key={d.id} className="flex items-center gap-3 p-3 border border-border rounded-lg hover:bg-muted/20 transition-colors">
          <FileText className="w-5 h-5 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{d.title}</p>
            <p className="text-xs text-muted-foreground">{d.file_type} • {format(new Date(d.created_at), "dd MMM yyyy")}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Tab: Notes ────────────────────────────────────────────────────────
function TabNotes({ caseData }: { caseData: any }) {
  const notes = [caseData.case_notes_1, caseData.case_notes_2, caseData.description].filter(Boolean);
  if (notes.length === 0) return <EmptyState icon={StickyNote} text="No notes added for this case" />;
  return (
    <div className="space-y-3">
      {notes.map((note, i) => (
        <div key={i} className="p-4 bg-muted/20 border border-border rounded-lg">
          <p className="text-sm text-foreground whitespace-pre-wrap">{note}</p>
        </div>
      ))}
    </div>
  );
}

// ── Tab: Notify to Clients ────────────────────────────────────────────
function TabNotify() {
  return (
    <div className="text-center py-12">
      <Bell className="w-12 h-12 text-muted-foreground opacity-30 mx-auto mb-3" />
      <p className="text-sm font-medium text-muted-foreground">Client notification feature</p>
      <p className="text-xs text-muted-foreground mt-1">Send hearing reminders, case updates, and notices to clients via SMS/Email</p>
    </div>
  );
}

// ── Tab: Related Judgments ─────────────────────────────────────────────
function TabJudgments() {
  return (
    <div className="text-center py-12">
      <Scale className="w-12 h-12 text-muted-foreground opacity-30 mx-auto mb-3" />
      <p className="text-sm font-medium text-muted-foreground">Related Judgments</p>
      <p className="text-xs text-muted-foreground mt-1">Link relevant court judgments and precedents to this case</p>
    </div>
  );
}

// ── Tab: Tasks ────────────────────────────────────────────────────────
function TabTasks({ tasks }: { tasks: any[] }) {
  if (tasks.length === 0) return <EmptyState icon={ListTodo} text="No tasks assigned to this case" />;
  return (
    <div className="space-y-2">
      {tasks.map((t: any) => (
        <div key={t.id} className="flex items-center gap-3 p-3 border border-border rounded-lg hover:bg-muted/20 transition-colors">
          <div className={`w-3 h-3 rounded-full shrink-0 ${t.status === "completed" ? "bg-emerald-500" : t.status === "in_progress" ? "bg-blue-500" : "bg-amber-400"}`} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">{t.title}</p>
            {t.description && <p className="text-xs text-muted-foreground truncate">{t.description}</p>}
          </div>
          <div className="text-right shrink-0">
            {t.due_date && <p className="text-xs text-muted-foreground">{format(new Date(t.due_date), "dd MMM yyyy")}</p>}
            <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${t.status === "completed" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" : "bg-muted text-muted-foreground"}`}>
              {t.status}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Tab: Appointments / Hearings ──────────────────────────────────────
function TabAppointments({ hearings }: { hearings: any[] }) {
  if (hearings.length === 0) return <EmptyState icon={CalendarDays} text="No appointments or hearings scheduled" />;
  return (
    <div className="space-y-2">
      {hearings.map((h: any) => (
        <div key={h.id} className="flex items-center gap-3 p-3 border border-border rounded-lg hover:bg-muted/20 transition-colors">
          <Gavel className="w-5 h-5 text-amber-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">{h.purpose || "Hearing"}</p>
            <p className="text-xs text-muted-foreground">{h.court_name || "Court N/A"} • Judge: {h.judge_name || "N/A"}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs font-medium text-foreground">{format(new Date(h.hearing_date), "dd MMM yyyy")}</p>
            <span className="text-[10px] uppercase font-bold bg-muted text-muted-foreground px-1.5 py-0.5 rounded">{h.status}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Tab: Invoices ─────────────────────────────────────────────────────
function TabInvoices({ invoices }: { invoices: any[] }) {
  if (invoices.length === 0) return <EmptyState icon={Receipt} text="No invoices for this case" />;
  return (
    <div className="space-y-2">
      {invoices.map((inv: any) => (
        <div key={inv.id} className="flex items-center gap-3 p-3 border border-border rounded-lg hover:bg-muted/20 transition-colors">
          <Receipt className="w-5 h-5 text-rose-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">Invoice #{inv.invoice_number}</p>
            <p className="text-xs text-muted-foreground">{inv.issue_date ? format(new Date(inv.issue_date), "dd MMM yyyy") : "—"}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-sm font-bold text-foreground">{CURRENCY}{inv.total}</p>
            <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${inv.status === "paid" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"}`}>
              {inv.status}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Tab: Expenses ─────────────────────────────────────────────────────
function TabExpenses({ expenses }: { expenses: any[] }) {
  if (expenses.length === 0) return <EmptyState icon={DollarSign} text="No expenses recorded for this case" />;
  return (
    <div className="space-y-2">
      {expenses.map((e: any) => (
        <div key={e.id} className="flex items-center gap-3 p-3 border border-border rounded-lg hover:bg-muted/20 transition-colors">
          <DollarSign className="w-5 h-5 text-orange-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">{e.category || "Expense"}</p>
            <p className="text-xs text-muted-foreground">{e.description || "—"}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-sm font-bold text-foreground">{CURRENCY}{e.amount}</p>
            {e.expense_date && <p className="text-xs text-muted-foreground">{format(new Date(e.expense_date), "dd MMM yyyy")}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Tab: Time Entries ─────────────────────────────────────────────────
function TabTimeEntries() {
  return (
    <div className="text-center py-12">
      <Clock className="w-12 h-12 text-muted-foreground opacity-30 mx-auto mb-3" />
      <p className="text-sm font-medium text-muted-foreground">Time Entries</p>
      <p className="text-xs text-muted-foreground mt-1">Track billable hours and time spent on this case</p>
    </div>
  );
}

// ── Empty State Helper ────────────────────────────────────────────────
function EmptyState({ icon: Icon, text }: { icon: any; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Icon className="w-12 h-12 text-muted-foreground opacity-20 mb-3" />
      <p className="text-sm font-medium text-muted-foreground">{text}</p>
    </div>
  );
}
