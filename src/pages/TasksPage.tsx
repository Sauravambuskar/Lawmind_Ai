import { useEffect, useState } from "react";
import { useMinLoader } from "@/hooks/useMinLoader";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Plus, Search, Pencil, Download, CheckCircle2, Circle, Clock,
  AlertTriangle, Filter, ListTodo, CalendarDays, TrendingUp, LayoutDashboard,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { restGetAll, restDelete } from "@/lib/restClient";
import { toast } from "sonner";
import { usePagination } from "@/hooks/usePagination";
import { TablePagination } from "@/components/TablePagination";
import { DeleteConfirm } from "@/components/DeleteConfirm";
import { exportToCSV } from "@/lib/export";
import { PageLoader } from "@/components/PageLoader";
import { useTaskPrivileges } from "@/hooks/useTaskPrivileges";
import {
  cycleTaskStatus, isTaskOverdue, memberName, PRIORITY_CONFIG, STATUS_CONFIG, taskProgress, TASKS_SELECT,
  type TaskPriority, type TaskRow, type TaskStatus,
} from "@/lib/tasks";
import { AssigneeControl, ProgressBar, StatusPill, useInvalidateTasks, useTeamMembers } from "@/components/tasks/TaskBits";
import { TaskFormDialog } from "@/components/tasks/TaskFormDialog";
import { TaskProgressDialog } from "@/components/tasks/TaskProgressDialog";

type View = "mine" | "assigned_by_me" | "all";
const UNASSIGNED = "__unassigned";

export default function TasksPage() {
  const priv = useTaskPrivileges();
  const invalidate = useInvalidateTasks();
  const [view, setView] = useState<View>("mine");
  const [viewTouched, setViewTouched] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | TaskStatus>("all");
  const [priorityFilter, setPriorityFilter] = useState<"all" | TaskPriority>("all");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editTask, setEditTask] = useState<TaskRow | null>(null);
  const [progressId, setProgressId] = useState<string | null>(null);

  // People who hand out work usually want the whole board first.
  useEffect(() => {
    if (!viewTouched && priv.canAssign) setView("all");
  }, [priv.canAssign, viewTouched]);

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["tasks"],
    queryFn: () => restGetAll<TaskRow>(`${TASKS_SELECT}&order=created_at.desc`),
  });
  const { data: teamMembers = [] } = useTeamMembers();

  const deleteMutation = useMutation({
    mutationFn: (id: string) => restDelete("tasks", `id=eq.${id}`),
    onSuccess: () => { invalidate(); toast.success("Task deleted"); },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed to delete task"),
  });

  const quickStatusChange = useMutation({
    mutationFn: (t: TaskRow) => cycleTaskStatus(t, priv.userId),
    onSuccess: invalidate,
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed to update status"),
  });

  const inView = tasks.filter(t => {
    if (view === "mine") return t.assigned_to === priv.userId;
    if (view === "assigned_by_me") return t.assigned_by === priv.userId || (t.created_by === priv.userId && !!t.assigned_to && t.assigned_to !== priv.userId);
    return true;
  });

  const filtered = inView.filter(t => {
    if (statusFilter !== "all" && t.status !== statusFilter) return false;
    if (priorityFilter !== "all" && t.priority !== priorityFilter) return false;
    if (assigneeFilter === UNASSIGNED && t.assigned_to) return false;
    if (assigneeFilter !== "all" && assigneeFilter !== UNASSIGNED && t.assigned_to !== assigneeFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!t.title.toLowerCase().includes(q) && !(t.cases?.case_number ?? "").toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const todoCount = inView.filter(t => t.status === "todo").length;
  const progressCount = inView.filter(t => t.status === "in_progress").length;
  const doneCount = inView.filter(t => t.status === "done").length;
  const overdueCount = inView.filter(isTaskOverdue).length;

  const { paginatedItems, currentPage, totalPages, totalItems, startIndex, nextPage, prevPage, goToPage } = usePagination(filtered);
  const showLoader = useMinLoader(isLoading);
  if (showLoader) return <PageLoader />;

  const progressTask = tasks.find(t => t.id === progressId) ?? null;
  const views: { id: View; label: string; count: number }[] = [
    { id: "mine", label: "My Tasks", count: tasks.filter(t => t.assigned_to === priv.userId && t.status !== "done").length },
    ...(priv.canAssign ? [{ id: "assigned_by_me" as View, label: "Assigned by Me", count: tasks.filter(t => t.assigned_by === priv.userId && t.status !== "done").length }] : []),
    { id: "all", label: "All Tasks", count: tasks.filter(t => t.status !== "done").length },
  ];

  const stat = (label: string, value: number, Icon: typeof Circle, tone: string) => (
    <div className="bg-card border border-border shadow-sm rounded-xl p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-full flex items-center justify-center border ${tone}`}><Icon className="w-5 h-5" /></div>
      <div>
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="text-xl font-bold text-foreground">{value}</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <PageHeader title="Task Management" breadcrumbs={[{ label: "Dashboard", path: "/" }, { label: "Tasks" }]} />
        <div className="flex gap-2 w-full sm:w-auto flex-wrap">
          {priv.canViewDashboard && (
            <Button variant="outline" asChild className="bg-background">
              <Link to="/task-dashboard"><LayoutDashboard className="w-4 h-4 mr-2" />Progress Dashboard</Link>
            </Button>
          )}
          <Button variant="outline" onClick={() => exportToCSV(filtered.map(t => ({
            title: t.title, status: t.status, progress: `${taskProgress(t)}%`, priority: t.priority,
            due_date: t.due_date || "", case: t.cases?.case_number || "",
            assignee: t.assigned_to ? memberName(teamMembers, t.assigned_to) : "",
            assigned_by: t.assigned_by ? memberName(teamMembers, t.assigned_by) : "",
          })), "tasks")} className="bg-background">
            <Download className="w-4 h-4 mr-2" /> Export
          </Button>
          <Button onClick={() => { setEditTask(null); setFormOpen(true); }} className="bg-primary text-primary-foreground shadow-sm hover:shadow-md transition-all">
            <Plus className="w-4 h-4 mr-2" /> New Task
          </Button>
        </div>
      </div>

      {/* View switcher */}
      <div className="flex gap-1 p-1 bg-muted/50 rounded-lg w-fit border border-border">
        {views.map(v => (
          <button key={v.id} onClick={() => { setView(v.id); setViewTouched(true); goToPage(1); }}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${view === v.id ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            {v.label}
            <span className={`text-[10px] font-bold px-1.5 rounded-full ${view === v.id ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>{v.count}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {stat("To Do", todoCount, Circle, "bg-slate-500/10 border-slate-500/20 text-slate-500")}
        {stat("In Progress", progressCount, Clock, "bg-amber-500/10 border-amber-500/20 text-amber-500")}
        {stat("Completed", doneCount, CheckCircle2, "bg-emerald-500/10 border-emerald-500/20 text-emerald-500")}
        {stat("Overdue", overdueCount, AlertTriangle, "bg-rose-500/10 border-rose-500/20 text-rose-500")}
      </div>

      <div className="bg-card border border-border shadow-sm rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border bg-muted/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search tasks or case no..." className="pl-9 bg-background" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="w-3.5 h-3.5 text-muted-foreground" />
            <Select value={statusFilter} onValueChange={v => setStatusFilter(v as "all" | TaskStatus)}>
              <SelectTrigger className="h-8 text-xs w-32 bg-background"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="todo">To Do</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="done">Done</SelectItem>
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={v => setPriorityFilter(v as "all" | TaskPriority)}>
              <SelectTrigger className="h-8 text-xs w-28 bg-background"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priority</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
            {view !== "mine" && (
              <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
                <SelectTrigger className="h-8 text-xs w-36 bg-background"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Members</SelectItem>
                  <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                  {teamMembers.map(m => <SelectItem key={m.user_id} value={m.user_id}>{m.full_name || "Unnamed"}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            <span className="text-xs text-muted-foreground font-medium ml-2">{totalItems} tasks</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b border-border text-muted-foreground">
              <tr>
                <th className="text-left py-3.5 px-5 font-semibold text-[11px] uppercase tracking-widest w-12">#</th>
                <th className="text-left py-3.5 px-2 font-semibold text-[11px] uppercase tracking-widest w-10"></th>
                <th className="text-left py-3.5 px-5 font-semibold text-[11px] uppercase tracking-widest">Task</th>
                <th className="text-left py-3.5 px-5 font-semibold text-[11px] uppercase tracking-widest min-w-[140px]">Progress</th>
                <th className="text-left py-3.5 px-5 font-semibold text-[11px] uppercase tracking-widest">Priority</th>
                <th className="text-left py-3.5 px-5 font-semibold text-[11px] uppercase tracking-widest">Due Date</th>
                <th className="text-left py-3.5 px-5 font-semibold text-[11px] uppercase tracking-widest">Case</th>
                <th className="text-left py-3.5 px-5 font-semibold text-[11px] uppercase tracking-widest">Assignee</th>
                <th className="text-right py-3.5 px-5 font-semibold text-[11px] uppercase tracking-widest">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                        <ListTodo className="w-8 h-8 text-muted-foreground opacity-50" />
                      </div>
                      <p className="text-base font-semibold text-foreground">No tasks found</p>
                      <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                        {view === "mine" ? "Nothing is assigned to you right now." : "Create a task to start tracking work."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : paginatedItems.map((t, i) => {
                const statusCfg = STATUS_CONFIG[t.status] ?? STATUS_CONFIG.todo;
                const priorityCfg = PRIORITY_CONFIG[t.priority] ?? PRIORITY_CONFIG.medium;
                const StatusIcon = statusCfg.icon;
                const PriorityIcon = priorityCfg.icon;
                const overdue = isTaskOverdue(t);
                const canUpdate = priv.canUpdateProgress(t);
                const canManage = priv.canManageTask(t);

                return (
                  <tr key={t.id} className={`border-b border-border last:border-0 hover:bg-muted/30 transition-colors group ${t.status === "done" ? "opacity-60" : ""}`}>
                    <td className="py-4 px-5 text-muted-foreground font-mono">{startIndex + i + 1}</td>
                    <td className="py-4 px-2">
                      <button
                        onClick={() => canUpdate && quickStatusChange.mutate(t)}
                        disabled={!canUpdate}
                        className="p-1 rounded-md hover:bg-muted transition-colors disabled:cursor-default"
                        title={canUpdate ? `Click to change from ${statusCfg.label}` : statusCfg.label}
                      >
                        <StatusIcon className={`w-5 h-5 ${statusCfg.text}`} />
                      </button>
                    </td>
                    <td className="py-4 px-5">
                      <button onClick={() => setProgressId(t.id)} className={`font-semibold text-left hover:text-primary ${t.status === "done" ? "line-through text-muted-foreground" : "text-foreground"}`}>{t.title}</button>
                      {t.description && <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1 max-w-[250px]">{t.description}</div>}
                      <div className="mt-1"><StatusPill status={t.status} /></div>
                    </td>
                    <td className="py-4 px-5"><ProgressBar value={taskProgress(t)} /></td>
                    <td className="py-4 px-5">
                      <span className="flex items-center gap-1.5">
                        <PriorityIcon className={`w-3.5 h-3.5 ${priorityCfg.color}`} />
                        <span className={`text-xs font-semibold ${priorityCfg.color}`}>{priorityCfg.label}</span>
                      </span>
                    </td>
                    <td className="py-4 px-5">
                      {t.due_date ? (
                        <span className={`flex items-center gap-1.5 text-xs font-medium whitespace-nowrap ${overdue ? "text-rose-500" : "text-muted-foreground"}`}>
                          <CalendarDays className="w-3.5 h-3.5" />
                          {new Date(t.due_date + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                          {overdue && <AlertTriangle className="w-3 h-3 text-rose-500" />}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">No date</span>
                      )}
                    </td>
                    <td className="py-4 px-5">
                      {t.case_id && t.cases ? (
                        <Link to={`/cases/${t.case_id}`} className="font-mono font-medium text-foreground bg-muted/50 px-2 py-0.5 rounded text-xs border border-border/50 hover:border-primary hover:text-primary">
                          {t.cases.case_number}
                        </Link>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">Unlinked</span>
                      )}
                    </td>
                    <td className="py-4 px-5">
                      <AssigneeControl task={t} members={teamMembers} canAssign={priv.canAssign} actorId={priv.userId} />
                    </td>
                    <td className="py-4 px-5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {canUpdate && (
                          <Button variant="ghost" size="icon" onClick={() => setProgressId(t.id)} className="h-8 w-8 hover:bg-primary/10 hover:text-primary" title="Update progress">
                            <TrendingUp className="w-4 h-4" />
                          </Button>
                        )}
                        {canManage && (
                          <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                            <Button variant="ghost" size="icon" onClick={() => { setEditTask(t); setFormOpen(true); }} className="h-8 w-8 hover:bg-primary/10 hover:text-primary transition-colors" title="Edit">
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <DeleteConfirm onConfirm={() => deleteMutation.mutate(t.id)} />
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {paginatedItems.length > 0 && (
          <div className="border-t border-border p-4 bg-muted/10">
            <TablePagination currentPage={currentPage} totalPages={totalPages} totalItems={totalItems} startIndex={startIndex} pageSize={10} onPrev={prevPage} onNext={nextPage} onGoTo={goToPage} />
          </div>
        )}
      </div>

      <TaskFormDialog open={formOpen} onOpenChange={setFormOpen} editTask={editTask} members={teamMembers} actorId={priv.userId} canAssign={priv.canAssign} />
      <TaskProgressDialog
        task={progressTask}
        members={teamMembers}
        open={!!progressTask}
        onOpenChange={v => { if (!v) setProgressId(null); }}
        actorId={priv.userId}
        canAssign={priv.canAssign}
        canUpdate={progressTask ? priv.canUpdateProgress(progressTask) : false}
      />
    </div>
  );
}
