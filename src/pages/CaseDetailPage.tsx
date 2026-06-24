import { useQuery } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useMinLoader } from "@/hooks/useMinLoader";
import { PageHeader } from "@/components/PageHeader";
import { PageLoader } from "@/components/PageLoader";
import { format } from "date-fns";
import {
  Gavel, ListTodo, Receipt, FileText, DollarSign,
  CalendarDays, ChevronLeft, BriefcaseBusiness, User, AlertCircle
} from "lucide-react";
import { CASE_STATUS_CONFIG, type CaseStatus, CURRENCY } from "@/lib/constants";
import { CommunicationLogList } from "@/components/communications/CommunicationLogList";

type TimelineEvent = {
  id: string;
  type: "hearing" | "task" | "invoice" | "expense" | "document";
  date: Date;
  title: string;
  subtitle?: string;
  status?: string;
  icon: any;
  color: string;
};

export default function CaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Fetch Case Details
  const { data: caseData, isLoading: loadingCase } = useQuery({
    queryKey: ["case-detail", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cases")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch all related entities for the timeline
  const { data: timelineData, isLoading: loadingTimeline } = useQuery({
    queryKey: ["case-timeline", id],
    queryFn: async () => {
      const [hearings, tasks, invoices, expenses, documents] = await Promise.all([
        supabase.from("hearings").select("*").eq("case_id", id),
        supabase.from("tasks").select("*").eq("case_id", id),
        supabase.from("invoices").select("*").eq("case_id", id),
        supabase.from("expenses").select("*").eq("case_id", id),
        supabase.from("documents").select("*").eq("case_id", id),
      ]);

      const events: TimelineEvent[] = [];

      (hearings.data || []).forEach(h => {
        events.push({
          id: `h-${h.id}`,
          type: "hearing",
          date: new Date(h.hearing_date),
          title: `Hearing: ${h.purpose || "Scheduled"}`,
          subtitle: `Court: ${h.court_name || "N/A"}, Judge: ${h.judge_name || "N/A"}`,
          status: h.status,
          icon: Gavel,
          color: "bg-amber-500",
        });
      });

      (tasks.data || []).forEach(t => {
        if (t.due_date) {
          events.push({
            id: `t-${t.id}`,
            type: "task",
            date: new Date(t.due_date),
            title: `Task Due: ${t.title}`,
            status: t.status,
            icon: ListTodo,
            color: "bg-blue-500",
          });
        }
      });

      (invoices.data || []).forEach(inv => {
        if (inv.issue_date) {
          events.push({
            id: `i-${inv.id}`,
            type: "invoice",
            date: new Date(inv.issue_date),
            title: `Invoice #${inv.invoice_number} Issued`,
            subtitle: `Amount: ${CURRENCY}${inv.total}`,
            status: inv.status,
            icon: Receipt,
            color: "bg-rose-500",
          });
        }
      });

      (expenses.data || []).forEach(e => {
        if (e.expense_date) {
          events.push({
            id: `e-${e.id}`,
            type: "expense",
            date: new Date(e.expense_date),
            title: `Expense: ${e.category || "General"}`,
            subtitle: `Amount: ${CURRENCY}${e.amount}`,
            icon: DollarSign,
            color: "bg-orange-500",
          });
        }
      });

      (documents.data || []).forEach(d => {
        events.push({
          id: `d-${d.id}`,
          type: "document",
          date: new Date(d.created_at),
          title: `Document Uploaded: ${d.title}`,
          subtitle: `Type: ${d.file_type}`,
          icon: FileText,
          color: "bg-emerald-500",
        });
      });

      // Sort chronological descending (newest first)
      events.sort((a, b) => b.date.getTime() - a.date.getTime());
      return events;
    },
    enabled: !!id,
  });

  const showLoader = useMinLoader(loadingCase || loadingTimeline);
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
      <div className="flex items-center gap-3">
        <button onClick={() => navigate("/cases")} className="p-2 rounded-md hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <PageHeader title="Case Detail & Timeline" breadcrumbs={[{ label: "Cases", path: "/cases" }, { label: caseData.case_number }]} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Case Information */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-card border border-border shadow-sm rounded-xl p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="font-mono font-medium text-foreground bg-muted/80 px-2.5 py-1 rounded-md text-xs border border-border">{caseData.case_number}</div>
              <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider border ${sConf.bg} ${sConf.text} ${sConf.border}`}>
                {caseData.status}
              </span>
            </div>
            <h2 className="text-xl font-bold text-foreground mb-1">{caseData.title}</h2>
            {caseData.case_type && <p className="text-sm font-medium text-muted-foreground mb-4">{caseData.case_type}</p>}
            
            {caseData.description && (
              <div className="text-sm text-foreground/80 mb-6 bg-muted/20 p-3 rounded-lg border border-border/50">
                {caseData.description}
              </div>
            )}

            <div className="space-y-4 pt-4 border-t border-border">
              <div className="grid grid-cols-[100px_1fr] gap-2 items-start">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider pt-0.5">Court</span>
                <span className="text-sm font-medium text-foreground">{caseData.court_name || "—"}</span>
              </div>
              <div className="grid grid-cols-[100px_1fr] gap-2 items-start">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider pt-0.5">Filing Date</span>
                <span className="text-sm font-medium text-foreground">
                  {caseData.filing_date ? (
                    <span className="flex items-center gap-1.5"><CalendarDays className="w-4 h-4 text-muted-foreground" /> {format(new Date(caseData.filing_date), "MMM d, yyyy")}</span>
                  ) : "—"}
                </span>
              </div>
              <div className="grid grid-cols-[100px_1fr] gap-2 items-start">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider pt-0.5">Client</span>
                <span className="text-sm font-medium text-foreground flex items-center gap-2">
                  <User className="w-4 h-4 text-blue-500" />
                  {caseData.description || "—"}
                </span>
              </div>
              <div className="grid grid-cols-[100px_1fr] gap-2 items-start">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider pt-0.5">Advocate</span>
                <span className="text-sm font-medium text-foreground flex items-center gap-2">
                  <BriefcaseBusiness className="w-4 h-4 text-purple-500" />
                  {caseData.case_notes_1 || "—"}
                </span>
              </div>
            </div>
          </div>
          
          <CommunicationLogList caseId={id} />
        </div>

        {/* Right Column: Timeline */}
        <div className="lg:col-span-2">
          <div className="bg-card border border-border shadow-sm rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-border bg-muted/10">
              <h3 className="font-bold text-foreground">Activity Timeline</h3>
            </div>
            
            <div className="p-6">
              {!timelineData || timelineData.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <CalendarDays className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">No activity yet</p>
                  <p className="text-sm mt-1">Events will appear here as the case progresses.</p>
                </div>
              ) : (
                <div className="relative pl-6 space-y-8 before:absolute before:inset-0 before:ml-[1.75rem] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
                  {timelineData.map((event, index) => {
                    const Icon = event.icon;
                    return (
                      <div key={event.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                        {/* Timeline dot */}
                        <div className={`flex items-center justify-center w-8 h-8 rounded-full border-4 border-card ${event.color} text-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 absolute left-[-1.5rem] md:left-1/2`}>
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        {/* Event Card */}
                        <div className="w-[calc(100%-2.5rem)] md:w-[calc(50%-2.5rem)] bg-card border border-border shadow-sm hover:shadow-md transition-shadow rounded-lg p-4">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-foreground text-sm">{event.title}</span>
                            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider bg-muted/50 px-2 py-0.5 rounded">
                              {format(event.date, "MMM d, yyyy")}
                            </span>
                          </div>
                          {event.subtitle && <p className="text-xs text-muted-foreground">{event.subtitle}</p>}
                          {event.status && (
                            <div className="mt-2">
                              <span className="text-[10px] font-bold uppercase tracking-wider bg-muted text-muted-foreground px-1.5 py-0.5 rounded border border-border/50">
                                {event.status}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
