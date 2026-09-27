import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { format, subDays } from "date-fns";
import {
  AlertTriangle, BriefcaseBusiness, CheckCircle2, ListTodo, Search, Shield, Target, TrendingUp, UserX, Users,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { PageLoader } from "@/components/PageLoader";
import { Input } from "@/components/ui/input";
import { TablePagination } from "@/components/TablePagination";
import { usePagination } from "@/hooks/usePagination";
import { useMinLoader } from "@/hooks/useMinLoader";
import { useTaskPrivileges } from "@/hooks/useTaskPrivileges";
import { restGetAll } from "@/lib/restClient";
import {
  aggregateProgress, isTaskOverdue, memberName, PRIORITY_CONFIG, STATUS_CONFIG, TASKS_SELECT,
  type TaskRow, type TaskStatus,
} from "@/lib/tasks";
import {
  AssigneeControl, MemberAvatar, ProgressBar, TaskActivityFeed, useTaskUpdates, useTeamMembers,
} from "@/components/tasks/TaskBits";
import { TaskProgressDialog } from "@/components/tasks/TaskProgressDialog";

const STATUS_ORDER: TaskStatus[] = ["todo", "in_progress", "done"];

interface MemberStats {
  userId: string;
  name: string;
  role: string;
  total: number;
  counts: Record<TaskStatus, number>;
  progress: number;
  overdue: number;
  doneThisWeek: number;
}

interface CaseStats {
  caseId: string;
  caseNumber: string;
  title: string;
  total: number;
  done: number;
  progress: number;
  overdue: number;
  unassigned: number;
  members: string[];
  lastUpdate: string;
}

export default function TaskDashboardPage() {
  const priv = useTaskPrivileges();
  const [caseSearch, setCaseSearch] = useState("");
  const [progressId, setProgressId] = useState<string | null>(null);

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["task-dashboard"],
    queryFn: () => restGetAll<TaskRow>(`${TASKS_SELECT}&order=created_at.desc`),
    enabled: priv.canViewDashboard,
  });
  const { data: members = [] } = useTeamMembers();
  const { data: updates = [], isError: updatesError } = useTaskUpdates("", 40, priv.canViewDashboard);

  const weekAgo = subDays(new Date(), 7);

  const memberStats = useMemo<MemberStats[]>(() => {
    const rows = members.map(m => {
      const mine = tasks.filter(t => t.assigned_to === m.user_id);
      const counts = { todo: 0, in_progress: 0, done: 0 } as Record<TaskStatus, number>;
      mine.forEach(t => { counts[t.status] = (counts[t.status] ?? 0) + 1; });
      return {
        userId: m.user_id,
        name: m.full_name || "Unnamed",
        role: m.role,
        total: mine.length,
        counts,
        progress: aggregateProgress(mine) ?? 0,
        overdue: mine.filter(isTaskOverdue).length,
        doneThisWeek: mine.filter(t => t.completed_at && new Date(t.completed_at) >= weekAgo).length,
      };
    });
    return rows.sort((a, b) => (b.total - b.counts.done) - (a.total - a.counts.done) || b.total - a.total);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, members]);

  const caseStats = useMemo<CaseStats[]>(() => {
    const byCase = new Map<string, TaskRow[]>();
    tasks.forEach(t => { if (t.case_id) byCase.set(t.case_id, [...(byCase.get(t.case_id) ?? []), t]); });
    return [...byCase.entries()].map(([caseId, list]) => ({
      caseId,
      caseNumber: list[0].cases?.case_number ?? "—",
      title: list[0].cases?.title ?? "",
      total: list.length,
      done: list.filter(t => t.status === "done").length,
      progress: aggregateProgress(list) ?? 0,
      overdue: list.filter(isTaskOverdue).length,
      unassigned: list.filter(t => !t.assigned_to && t.status !== "done").length,
      members: [...new Set(list.map(t => t.assigned_to).filter(Boolean) as string[])],
      lastUpdate: list.map(t => t.updated_at ?? t.created_at).sort().at(-1) ?? "",
    })).sort((a, b) => b.overdue - a.overdue || a.progress - b.progress);
  }, [tasks]);

  const filteredCases = caseStats.filter(c => {
    if (!caseSearch) return true;
    const q = caseSearch.toLowerCase();
    return c.caseNumber.toLowerCase().includes(q) || c.title.toLowerCase().includes(q);
  });
  const casePage = usePagination(filteredCases);

  const attention = tasks
    .filter(t => t.status !== "done" && (isTaskOverdue(t) || !t.assigned_to))
    .sort((a, b) => Number(isTaskOverdue(b)) - Number(isTaskOverdue(a)) || (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"))
    .slice(0, 8);

  const showLoader = useMinLoader(isLoading && priv.canViewDashboard);
  if (!priv.canViewDashboard) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Shield className="w-16 h-16 text-muted-foreground opacity-30 mb-4" />
        <h2 className="text-xl font-bold text-foreground">Access Denied</h2>
        <p className="text-muted-foreground mt-2 text-center max-w-sm">The Task Progress Dashboard is for admins and members given the "Task Progress Dashboard" privilege.</p>
      </div>
    );
  }
  if (showLoader) return <PageLoader />;

  const open = tasks.filter(t => t.status !== "done");
  const overdue = tasks.filter(isTaskOverdue).length;
  const unassigned = open.filter(t => !t.assigned_to).length;
  const doneWeek = tasks.filter(t => t.completed_at && new Date(t.completed_at) >= weekAgo).length;
  const overall = aggregateProgress(tasks) ?? 0;
  const progressTask = tasks.find(t => t.id === progressId) ?? null;
  const taskTitles = new Map(tasks.map(t => [t.id, t.title]));

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader title="Task Progress Dashboard" breadcrumbs={[{ label: "Dashboard", path: "/" }, { label: "Tasks", path: "/tasks" }, { label: "Progress Dashboard" }]} />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <Kpi icon={ListTodo} label="Open tasks" value={open.length} sub={`${tasks.length} total`} />
        <Kpi icon={Target} label="Overall completion" value={`${overall}%`} sub={<ProgressBar value={overall} size="xs" showLabel={false} className="mt-1.5" />} />
        <Kpi icon={CheckCircle2} label="Done this week" value={doneWeek} sub="last 7 days" />
        <Kpi icon={AlertTriangle} label="Overdue" value={overdue} sub="past due date" alert={overdue > 0} />
        <Kpi icon={UserX} label="Unassigned" value={unassigned} sub="open, no owner" alert={unassigned > 0} />
        <Kpi icon={BriefcaseBusiness} label="Cases tracked" value={caseStats.length} sub={`${caseStats.filter(c => c.progress === 100).length} fully done`} />
      </div>

      {/* Team workload */}
      <section className="bg-card border border-border shadow-sm rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border bg-muted/10 flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-bold flex items-center gap-2"><Users className="w-4 h-4 text-primary" />Team Workload & Progress</h3>
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground" aria-label="Legend">
            {STATUS_ORDER.map(s => (
              <span key={s} className="flex items-center gap-1.5"><span className={`w-2.5 h-2.5 rounded-sm ${STATUS_CONFIG[s].bar}`} />{STATUS_CONFIG[s].label}</span>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b border-border text-muted-foreground">
              <tr>
                <th className="text-left py-3 px-5 font-semibold text-[11px] uppercase tracking-widest">Member</th>
                <th className="text-left py-3 px-5 font-semibold text-[11px] uppercase tracking-widest min-w-[220px]">Tasks by status</th>
                <th className="text-left py-3 px-5 font-semibold text-[11px] uppercase tracking-widest min-w-[150px]">Avg. progress</th>
                <th className="text-right py-3 px-5 font-semibold text-[11px] uppercase tracking-widest">Overdue</th>
                <th className="text-right py-3 px-5 font-semibold text-[11px] uppercase tracking-widest">Done (7d)</th>
              </tr>
            </thead>
            <tbody>
              {memberStats.length === 0 ? (
                <tr><td colSpan={5} className="py-10 text-center text-sm text-muted-foreground">No team members found</td></tr>
              ) : memberStats.map(m => (
                <tr key={m.userId} className="border-b border-border last:border-0 hover:bg-muted/20">
                  <td className="py-3 px-5">
                    <div className="flex items-center gap-2.5">
                      <MemberAvatar name={m.name} className="w-8 h-8 text-xs" />
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground truncate">{m.name}</p>
                        <p className="text-[11px] text-muted-foreground capitalize">{m.role.replace("_", " ")}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-5">
                    {m.total === 0 ? <span className="text-xs text-muted-foreground italic">No tasks assigned</span> : (
                      <div>
                        <div className="flex h-2.5 gap-[2px] rounded-full overflow-hidden bg-muted">
                          {STATUS_ORDER.filter(s => m.counts[s] > 0).map(s => (
                            <div key={s} className={`${STATUS_CONFIG[s].bar} h-full`} style={{ width: `${(m.counts[s] / m.total) * 100}%` }} title={`${STATUS_CONFIG[s].label}: ${m.counts[s]}`} />
                          ))}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-1 tabular-nums">
                          {m.counts.todo} to do · {m.counts.in_progress} in progress · {m.counts.done} done
                        </p>
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-5">{m.total > 0 ? <ProgressBar value={m.progress} /> : <span className="text-xs text-muted-foreground">—</span>}</td>
                  <td className={`py-3 px-5 text-right font-semibold tabular-nums ${m.overdue ? "text-rose-600" : "text-muted-foreground"}`}>{m.overdue}</td>
                  <td className="py-3 px-5 text-right font-semibold tabular-nums text-foreground">{m.doneThisWeek}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid xl:grid-cols-[1fr_360px] gap-6">
        {/* Case progress */}
        <section className="bg-card border border-border shadow-sm rounded-xl overflow-hidden h-fit">
          <div className="p-4 border-b border-border bg-muted/10 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
            <h3 className="font-bold flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary" />Case Progress</h3>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search case no. or title..." className="pl-9 h-9 bg-background" value={caseSearch} onChange={e => { setCaseSearch(e.target.value); casePage.goToPage(1); }} />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 border-b border-border text-muted-foreground">
                <tr>
                  <th className="text-left py-3 px-5 font-semibold text-[11px] uppercase tracking-widest">Case</th>
                  <th className="text-left py-3 px-5 font-semibold text-[11px] uppercase tracking-widest min-w-[160px]">Progress</th>
                  <th className="text-right py-3 px-5 font-semibold text-[11px] uppercase tracking-widest">Tasks</th>
                  <th className="text-right py-3 px-5 font-semibold text-[11px] uppercase tracking-widest">Overdue</th>
                  <th className="text-left py-3 px-5 font-semibold text-[11px] uppercase tracking-widest">Team</th>
                  <th className="text-left py-3 px-5 font-semibold text-[11px] uppercase tracking-widest">Last update</th>
                </tr>
              </thead>
              <tbody>
                {casePage.paginatedItems.length === 0 ? (
                  <tr><td colSpan={6} className="py-10 text-center text-sm text-muted-foreground">{caseStats.length ? "No matching cases" : "No case has tasks yet"}</td></tr>
                ) : casePage.paginatedItems.map(c => (
                  <tr key={c.caseId} className="border-b border-border last:border-0 hover:bg-muted/20">
                    <td className="py-3 px-5 max-w-[260px]">
                      <Link to={`/cases/${c.caseId}`} className="font-mono text-xs font-semibold bg-muted/60 px-1.5 py-0.5 rounded border border-border hover:border-primary hover:text-primary">{c.caseNumber}</Link>
                      <p className="text-xs text-muted-foreground truncate mt-1">{c.title}</p>
                    </td>
                    <td className="py-3 px-5"><ProgressBar value={c.progress} /></td>
                    <td className="py-3 px-5 text-right tabular-nums text-xs"><span className="font-semibold text-foreground">{c.done}</span><span className="text-muted-foreground">/{c.total}</span></td>
                    <td className={`py-3 px-5 text-right tabular-nums font-semibold ${c.overdue ? "text-rose-600" : "text-muted-foreground"}`}>{c.overdue}</td>
                    <td className="py-3 px-5">
                      <div className="flex -space-x-1.5">
                        {c.members.slice(0, 4).map(uid => <MemberAvatar key={uid} name={memberName(members, uid)} className="ring-2 ring-card" />)}
                        {c.members.length > 4 && <span className="text-[10px] text-muted-foreground pl-2.5">+{c.members.length - 4}</span>}
                        {c.members.length === 0 && <span className="text-xs text-muted-foreground italic">None</span>}
                      </div>
                      {c.unassigned > 0 && <p className="text-[10px] text-violet-600 mt-1">{c.unassigned} unassigned</p>}
                    </td>
                    <td className="py-3 px-5 text-xs text-muted-foreground whitespace-nowrap">{c.lastUpdate ? format(new Date(c.lastUpdate), "dd MMM yyyy") : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {casePage.totalItems > 0 && (
            <div className="border-t border-border p-4 bg-muted/10">
              <TablePagination currentPage={casePage.currentPage} totalPages={casePage.totalPages} totalItems={casePage.totalItems} startIndex={casePage.startIndex} pageSize={10} onPrev={casePage.prevPage} onNext={casePage.nextPage} onGoTo={casePage.goToPage} />
            </div>
          )}
        </section>

        <div className="space-y-6">
          {/* Needs attention */}
          <section className="bg-card border border-border shadow-sm rounded-xl p-4">
            <h3 className="font-bold flex items-center gap-2 mb-3"><AlertTriangle className="w-4 h-4 text-rose-500" />Needs Attention</h3>
            {attention.length === 0 ? (
              <p className="text-xs text-muted-foreground italic py-3 text-center">Nothing overdue or unassigned 🎉</p>
            ) : (
              <ul className="space-y-2.5">
                {attention.map(t => {
                  const late = isTaskOverdue(t);
                  const pr = PRIORITY_CONFIG[t.priority] ?? PRIORITY_CONFIG.medium;
                  return (
                    <li key={t.id} className="border border-border rounded-lg p-2.5">
                      <button onClick={() => setProgressId(t.id)} className="text-sm font-semibold text-left hover:text-primary leading-snug">{t.title}</button>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[11px]">
                        {t.cases && <span className="font-mono text-muted-foreground">{t.cases.case_number}</span>}
                        <span className={`font-bold uppercase ${pr.color}`}>{pr.label}</span>
                        {late && <span className="text-rose-600 font-semibold">Overdue · {format(new Date(t.due_date + "T00:00:00"), "dd MMM")}</span>}
                      </div>
                      <div className="mt-1.5"><AssigneeControl task={t} members={members} canAssign={priv.canAssign} actorId={priv.userId} /></div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Activity */}
          <section className="bg-card border border-border shadow-sm rounded-xl p-4">
            <h3 className="font-bold mb-3">Recent Activity</h3>
            <div className="max-h-[520px] overflow-y-auto pr-1">
              <TaskActivityFeed updates={updates} members={members} taskTitles={taskTitles} isError={updatesError} />
            </div>
          </section>
        </div>
      </div>

      <TaskProgressDialog
        task={progressTask}
        members={members}
        open={!!progressTask}
        onOpenChange={v => { if (!v) setProgressId(null); }}
        actorId={priv.userId}
        canAssign={priv.canAssign}
        canUpdate={progressTask ? priv.canUpdateProgress(progressTask) : false}
      />
    </div>
  );
}

function Kpi({ icon: Icon, label, value, sub, alert }: {
  icon: typeof ListTodo; label: string; value: number | string; sub?: React.ReactNode; alert?: boolean;
}) {
  return (
    <div className="bg-card border border-border shadow-sm rounded-xl p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className={`w-4 h-4 ${alert ? "text-rose-500" : "text-primary"}`} />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="text-2xl font-bold text-foreground mt-1.5 tabular-nums">{value}</p>
      {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}
