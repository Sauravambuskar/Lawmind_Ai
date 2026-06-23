import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMinLoader } from "@/hooks/useMinLoader";
import { PageHeader } from "@/components/PageHeader";
import { PageLoader } from "@/components/PageLoader";
import { Button } from "@/components/ui/button";
import { format, addDays, isToday, isTomorrow, isPast } from "date-fns";
import {
  Calendar, CheckCircle2, Circle, Clock, AlertTriangle,
  ArrowUp, ArrowRight, ArrowDown, BriefcaseBusiness,
  ChevronRight, Gavel, ListTodo, Sun, Sunrise, Plus,
} from "lucide-react";
import { CURRENCY } from "@/lib/constants";

interface HearingRow {
  id: string;
  purpose: string | null;
  hearing_date: string;
  court_name: string | null;
  judge_name: string | null;
  status: string;
  cases?: { title: string; case_number: string } | null;
}

interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  cases?: { title: string; case_number: string } | null;
}

interface InvoiceRow {
  id: string;
  invoice_number: string;
  total: number;
  due_date: string;
  status: string;
  clients?: { name: string } | null;
}

const PRIORITY_ICONS: Record<string, { icon: typeof ArrowUp; color: string }> = {
  high:   { icon: ArrowUp,    color: "text-rose-500" },
  medium: { icon: ArrowRight, color: "text-amber-500" },
  low:    { icon: ArrowDown,  color: "text-blue-500" },
};

const STATUS_ICONS: Record<string, { icon: typeof Circle; color: string }> = {
  todo:        { icon: Circle,       color: "text-slate-400" },
  in_progress: { icon: Clock,        color: "text-amber-500" },
  done:        { icon: CheckCircle2, color: "text-emerald-500" },
};

export default function TodayPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const todayStr = new Date().toISOString().split("T")[0];
  const weekEnd = addDays(new Date(), 7).toISOString().split("T")[0];

  // Today's & upcoming hearings (next 7 days)
  const { data: hearings = [], isLoading: loadingH } = useQuery({
    queryKey: ["today-hearings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hearings")
        .select("id, purpose, hearing_date, court_name, judge_name, status, cases(title, case_number)")
        .gte("hearing_date", todayStr)
        .lte("hearing_date", weekEnd + "T23:59:59")
        .neq("status", "cancelled")
        .order("hearing_date", { ascending: true });
      if (error) throw error;
      return (data || []) as HearingRow[];
    },
    refetchInterval: 5 * 60 * 1000,
  });

  // Active tasks (not done)
  const { data: tasks = [], isLoading: loadingT } = useQuery({
    queryKey: ["today-tasks"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("tasks")
        .select("id, title, description, status, priority, due_date, cases(title, case_number)")
        .neq("status", "done")
        .order("priority", { ascending: true })
        .order("due_date", { ascending: true });
      if (error) throw error;
      return (data || []) as TaskRow[];
    },
    refetchInterval: 5 * 60 * 1000,
  });

  // Overdue invoices
  const { data: overdueInvoices = [], isLoading: loadingI } = useQuery({
    queryKey: ["today-overdue-invoices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("id, invoice_number, total, due_date, status, clients(name)")
        .lt("due_date", todayStr)
        .neq("status", "paid")
        .neq("status", "cancelled")
        .order("due_date", { ascending: true })
        .limit(10);
      if (error) throw error;
      return (data || []) as InvoiceRow[];
    },
  });

  const showLoader = useMinLoader(loadingH || loadingT || loadingI);
  if (showLoader) return <PageLoader />;

  // Split hearings: today vs upcoming
  const todayHearings = hearings.filter(h => {
    const d = new Date(h.hearing_date);
    return isToday(d);
  });
  const upcomingHearings = hearings.filter(h => {
    const d = new Date(h.hearing_date);
    return !isToday(d);
  });

  // Split tasks
  const overdueTasks = tasks.filter(t => t.due_date && isPast(new Date(t.due_date + "T23:59:59")) && !isToday(new Date(t.due_date + "T00:00:00")));
  const todayTasks = tasks.filter(t => t.due_date && isToday(new Date(t.due_date + "T00:00:00")));
  const otherTasks = tasks.filter(t => !t.due_date || (!isPast(new Date(t.due_date + "T23:59:59")) && !isToday(new Date(t.due_date + "T00:00:00"))));

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good Morning";
    if (h < 17) return "Good Afternoon";
    return "Good Evening";
  })();

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <PageHeader title="Today's Diary" breadcrumbs={[{ label: "Dashboard", path: "/" }, { label: "Today" }]} />
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("/tasks")} className="bg-background">
            <ListTodo className="w-4 h-4 mr-2" /> All Tasks
          </Button>
          <Button onClick={() => navigate("/tasks")} className="bg-primary text-primary-foreground">
            <Plus className="w-4 h-4 mr-2" /> New Task
          </Button>
        </div>
      </div>

      {/* Greeting Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/5 via-primary/[0.02] to-transparent p-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
            {new Date().getHours() < 12 ? <Sunrise className="w-6 h-6 text-primary" /> : <Sun className="w-6 h-6 text-primary" />}
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">{greeting}!</h2>
            <p className="text-sm text-muted-foreground">
              {format(new Date(), "EEEE, MMMM d, yyyy")} — You have{" "}
              <strong className="text-foreground">{todayHearings.length} hearing{todayHearings.length !== 1 ? "s" : ""}</strong> and{" "}
              <strong className="text-foreground">{todayTasks.length + overdueTasks.length} task{todayTasks.length + overdueTasks.length !== 1 ? "s" : ""}</strong> pending today.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ─── Today's Hearings ─── */}
        <div className="bg-card border border-border shadow-sm rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/10">
            <div className="flex items-center gap-2">
              <Gavel className="w-4 h-4 text-amber-500" />
              <h3 className="text-sm font-semibold text-foreground">Today's Hearings</h3>
              {todayHearings.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 text-[10px] font-bold">{todayHearings.length}</span>
              )}
            </div>
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => navigate("/hearings")}>
              View All <ChevronRight className="w-3 h-3 ml-1" />
            </Button>
          </div>
          <div className="divide-y divide-border max-h-[400px] overflow-y-auto custom-scrollbar">
            {todayHearings.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center text-muted-foreground">
                <Calendar className="w-10 h-10 mb-3 opacity-30" />
                <p className="text-sm font-medium">No hearings today</p>
                <p className="text-xs mt-0.5">You're free — perfect time to catch up on tasks.</p>
              </div>
            ) : todayHearings.map(h => (
              <div key={h.id} className="flex items-start gap-3 px-5 py-4 hover:bg-muted/30 transition-colors">
                <div className="mt-0.5 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 shrink-0">
                  <Gavel className="w-4 h-4 text-amber-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{h.purpose || "Court Hearing"}</p>
                  {h.cases && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      <span className="font-mono bg-muted px-1 py-0.5 rounded text-[10px] border border-border/50">{h.cases.case_number}</span>
                      <span className="ml-1.5">{h.cases.title}</span>
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-1.5">
                    {h.court_name && <span className="text-[10px] font-semibold text-amber-600 bg-amber-500/10 px-1.5 py-0.5 rounded">{h.court_name}</span>}
                    <span className="text-[10px] text-muted-foreground">
                      {format(new Date(h.hearing_date), "h:mm a")}
                    </span>
                    {h.judge_name && <span className="text-[10px] text-muted-foreground">Judge: {h.judge_name}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ─── Tasks Due Today + Overdue ─── */}
        <div className="bg-card border border-border shadow-sm rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/10">
            <div className="flex items-center gap-2">
              <ListTodo className="w-4 h-4 text-blue-500" />
              <h3 className="text-sm font-semibold text-foreground">Pending Tasks</h3>
              {(todayTasks.length + overdueTasks.length) > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 text-[10px] font-bold">{todayTasks.length + overdueTasks.length}</span>
              )}
            </div>
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => navigate("/tasks")}>
              All Tasks <ChevronRight className="w-3 h-3 ml-1" />
            </Button>
          </div>
          <div className="divide-y divide-border max-h-[400px] overflow-y-auto custom-scrollbar">
            {overdueTasks.length === 0 && todayTasks.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center text-muted-foreground">
                <CheckCircle2 className="w-10 h-10 mb-3 opacity-30" />
                <p className="text-sm font-medium">All caught up!</p>
                <p className="text-xs mt-0.5">No overdue or due-today tasks.</p>
              </div>
            ) : (
              <>
                {/* Overdue section */}
                {overdueTasks.length > 0 && (
                  <>
                    <div className="px-5 py-2 bg-rose-500/5 border-b border-rose-500/10">
                      <span className="text-[10px] font-bold text-rose-500 uppercase tracking-wider flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> Overdue ({overdueTasks.length})
                      </span>
                    </div>
                    {overdueTasks.map(t => <TaskItem key={t.id} task={t} overdue />)}
                  </>
                )}
                {/* Today section */}
                {todayTasks.length > 0 && (
                  <>
                    <div className="px-5 py-2 bg-blue-500/5 border-b border-blue-500/10">
                      <span className="text-[10px] font-bold text-blue-500 uppercase tracking-wider flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Due Today ({todayTasks.length})
                      </span>
                    </div>
                    {todayTasks.map(t => <TaskItem key={t.id} task={t} />)}
                  </>
                )}
              </>
            )}
          </div>
        </div>

        {/* ─── Upcoming Hearings (Next 7 days) ─── */}
        <div className="bg-card border border-border shadow-sm rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/10">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-purple-500" />
              <h3 className="text-sm font-semibold text-foreground">Next 7 Days — Hearings</h3>
              {upcomingHearings.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-purple-500/10 text-purple-600 text-[10px] font-bold">{upcomingHearings.length}</span>
              )}
            </div>
          </div>
          <div className="divide-y divide-border max-h-[350px] overflow-y-auto custom-scrollbar">
            {upcomingHearings.length === 0 ? (
              <div className="py-10 flex flex-col items-center justify-center text-muted-foreground">
                <Calendar className="w-8 h-8 mb-2 opacity-30" />
                <p className="text-sm font-medium">No upcoming hearings this week</p>
              </div>
            ) : upcomingHearings.map(h => {
              const d = new Date(h.hearing_date);
              return (
                <div key={h.id} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/30 transition-colors">
                  <div className="text-center shrink-0 w-12">
                    <p className="text-lg font-bold text-foreground leading-none">{format(d, "d")}</p>
                    <p className="text-[10px] text-muted-foreground uppercase">{format(d, "MMM")}</p>
                    <p className="text-[9px] text-muted-foreground">{format(d, "EEE")}</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{h.purpose || "Hearing"}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {h.cases?.case_number && <span className="font-mono">{h.cases.case_number}</span>}
                      {h.court_name && <span className="ml-1.5">· {h.court_name}</span>}
                    </p>
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0">{format(d, "h:mm a")}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ─── Overdue Invoices ─── */}
        <div className="bg-card border border-border shadow-sm rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/10">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-500" />
              <h3 className="text-sm font-semibold text-foreground">Overdue Invoices</h3>
              {overdueInvoices.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-rose-500/10 text-rose-600 text-[10px] font-bold">{overdueInvoices.length}</span>
              )}
            </div>
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => navigate("/invoices")}>
              View All <ChevronRight className="w-3 h-3 ml-1" />
            </Button>
          </div>
          <div className="divide-y divide-border max-h-[350px] overflow-y-auto custom-scrollbar">
            {overdueInvoices.length === 0 ? (
              <div className="py-10 flex flex-col items-center justify-center text-muted-foreground">
                <CheckCircle2 className="w-8 h-8 mb-2 opacity-30" />
                <p className="text-sm font-medium">No overdue invoices</p>
                <p className="text-xs mt-0.5">All payments are up to date.</p>
              </div>
            ) : overdueInvoices.map(inv => (
              <div key={inv.id} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => navigate("/invoices")}>
                <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 shrink-0">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">#{inv.invoice_number}</p>
                  <p className="text-xs text-muted-foreground truncate">{(inv.clients as any)?.name || "No client"} · Due {inv.due_date}</p>
                </div>
                <span className="text-sm font-bold text-rose-500 shrink-0">{CURRENCY}{Number(inv.total).toLocaleString("en-IN")}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── All Upcoming Tasks ─── */}
      {otherTasks.length > 0 && (
        <div className="bg-card border border-border shadow-sm rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/10">
            <div className="flex items-center gap-2">
              <BriefcaseBusiness className="w-4 h-4 text-emerald-500" />
              <h3 className="text-sm font-semibold text-foreground">Upcoming Tasks</h3>
              <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 text-[10px] font-bold">{otherTasks.length}</span>
            </div>
          </div>
          <div className="divide-y divide-border max-h-[300px] overflow-y-auto custom-scrollbar">
            {otherTasks.slice(0, 10).map(t => <TaskItem key={t.id} task={t} />)}
            {otherTasks.length > 10 && (
              <div className="px-5 py-3 text-center">
                <Button variant="ghost" size="sm" className="text-xs" onClick={() => navigate("/tasks")}>
                  View all {otherTasks.length} tasks <ChevronRight className="w-3 h-3 ml-1" />
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Reusable Task Row ── */
function TaskItem({ task, overdue = false }: { task: TaskRow; overdue?: boolean }) {
  const priorityCfg = PRIORITY_ICONS[task.priority] || PRIORITY_ICONS.medium;
  const statusCfg = STATUS_ICONS[task.status] || STATUS_ICONS.todo;
  const PriorityIcon = priorityCfg.icon;
  const StatusIcon = statusCfg.icon;

  return (
    <div className={`flex items-center gap-3 px-5 py-3 hover:bg-muted/30 transition-colors ${overdue ? "bg-rose-500/[0.03]" : ""}`}>
      <StatusIcon className={`w-4 h-4 shrink-0 ${statusCfg.color}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{task.title}</p>
        <div className="flex items-center gap-2 mt-0.5">
          {task.cases && (
            <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1 py-0.5 rounded border border-border/50">
              {task.cases.case_number}
            </span>
          )}
          {task.due_date && (
            <span className={`text-[10px] font-medium ${overdue ? "text-rose-500" : "text-muted-foreground"}`}>
              Due {new Date(task.due_date + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
            </span>
          )}
        </div>
      </div>
      <PriorityIcon className={`w-3.5 h-3.5 shrink-0 ${priorityCfg.color}`} />
    </div>
  );
}
