import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { format, subDays } from "date-fns";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleDot,
  ClipboardList,
  Clock3,
  LayoutDashboard,
  ListTodo,
  Plus,
  Search,
  Shield,
  Sparkles,
  UserRoundCheck,
  UserX,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { PageLoader } from "@/components/PageLoader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMinLoader } from "@/hooks/useMinLoader";
import { useTaskPrivileges } from "@/hooks/useTaskPrivileges";
import { restGetAll } from "@/lib/restClient";
import {
  aggregateProgress,
  isTaskOverdue,
  memberName,
  PRIORITY_CONFIG,
  STATUS_CONFIG,
  taskProgress,
  TASKS_SELECT,
  type TaskRow,
  type TaskStatus,
  type TeamMember,
} from "@/lib/tasks";
import {
  AssigneeControl,
  MemberAvatar,
  ProgressBar,
  StatusPill,
  TaskActivityFeed,
  useTaskUpdates,
  useTeamMembers,
} from "@/components/tasks/TaskBits";
import { TaskFormDialog } from "@/components/tasks/TaskFormDialog";
import { TaskProgressDialog } from "@/components/tasks/TaskProgressDialog";
import { TaskProgressCylinderChart } from "@/components/tasks/TaskProgressCylinderChart";

const ALL = "all";

interface MemberWork {
  member: TeamMember;
  tasks: TaskRow[];
  open: number;
  done: number;
  overdue: number;
  progress: number;
}

export default function TaskDashboardPage() {
  const priv = useTaskPrivileges();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [memberFilter, setMemberFilter] = useState(ALL);
  const [expandedMembers, setExpandedMembers] = useState<Set<string>>(new Set());
  const [progressId, setProgressId] = useState<string | null>(null);
  const [taskFormOpen, setTaskFormOpen] = useState(false);

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["task-dashboard"],
    queryFn: () => restGetAll<TaskRow>(`${TASKS_SELECT}&order=created_at.desc`),
    enabled: priv.canViewDashboard,
  });
  const { data: members = [] } = useTeamMembers();
  const { data: updates = [], isError: updatesError } = useTaskUpdates("", 30, priv.canViewDashboard);

  const weekAgo = subDays(new Date(), 7);
  const openTasks = tasks.filter(task => task.status !== "done");
  const overdueTasks = tasks.filter(isTaskOverdue);
  const unassignedTasks = openTasks.filter(task => !task.assigned_to);
  const doneThisWeek = tasks.filter(task => task.completed_at && new Date(task.completed_at) >= weekAgo);
  const overallProgress = aggregateProgress(tasks) ?? 0;
  const teamProgressChart = useMemo(() => members.map(member => {
    const assigned = tasks.filter(task => task.assigned_to === member.user_id);
    return {
      name: member.full_name || "Unnamed member",
      progress: aggregateProgress(assigned) ?? 0,
      openTasks: assigned.filter(task => task.status !== "done").length,
      completedTasks: assigned.filter(task => task.status === "done").length,
    };
  }), [members, tasks]);

  const filteredTasks = useMemo(() => {
    const query = search.trim().toLowerCase();
    return tasks.filter(task => {
      if (statusFilter !== ALL && task.status !== statusFilter) return false;
      if (memberFilter !== ALL && task.assigned_to !== memberFilter) return false;
      if (!query) return true;
      const owner = memberName(members, task.assigned_to).toLowerCase();
      const caseText = `${task.cases?.case_number ?? ""} ${task.cases?.title ?? ""}`.toLowerCase();
      return task.title.toLowerCase().includes(query) || owner.includes(query) || caseText.includes(query);
    });
  }, [memberFilter, members, search, statusFilter, tasks]);

  const memberWork = useMemo<MemberWork[]>(() => {
    return members
      .filter(member => memberFilter === ALL || member.user_id === memberFilter)
      .map(member => {
        const assigned = filteredTasks.filter(task => task.assigned_to === member.user_id);
        return {
          member,
          tasks: assigned,
          open: assigned.filter(task => task.status !== "done").length,
          done: assigned.filter(task => task.status === "done").length,
          overdue: assigned.filter(isTaskOverdue).length,
          progress: aggregateProgress(assigned) ?? 0,
        };
      })
      .filter(row => row.tasks.length > 0 || (!search && statusFilter === ALL))
      .sort((a, b) => b.overdue - a.overdue || b.open - a.open || a.member.full_name?.localeCompare(b.member.full_name ?? "") || 0);
  }, [filteredTasks, memberFilter, members, search, statusFilter]);

  const filteredUnassigned = memberFilter === ALL
    ? filteredTasks.filter(task => !task.assigned_to && task.status !== "done")
    : [];

  const attentionTasks = openTasks
    .filter(task => isTaskOverdue(task) || !task.assigned_to || task.priority === "high")
    .sort((a, b) => Number(isTaskOverdue(b)) - Number(isTaskOverdue(a)) || Number(!b.assigned_to) - Number(!a.assigned_to))
    .slice(0, 6);

  const taskTitles = new Map(tasks.map(task => [task.id, task.title]));
  const progressTask = tasks.find(task => task.id === progressId) ?? null;
  const showLoader = useMinLoader(isLoading && priv.canViewDashboard);

  const toggleMember = (userId: string) => {
    setExpandedMembers(current => {
      const next = new Set(current);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  if (!priv.canViewDashboard) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Shield className="mb-4 h-16 w-16 text-muted-foreground opacity-30" />
        <h2 className="text-xl font-bold text-foreground">Access denied</h2>
        <p className="mt-2 max-w-sm text-center text-muted-foreground">
          Sarda Sir Dashboard is available to admins and members with the Task Progress Dashboard privilege.
        </p>
      </div>
    );
  }
  if (showLoader) return <PageLoader />;

  return (
    <div className="space-y-5 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <PageHeader
            title="Sarda Sir Dashboard"
            breadcrumbs={[{ label: "Dashboard", path: "/" }, { label: "Sarda Sir Dashboard" }]}
          />
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Team task assignment, pending work and completion status in one place.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link to="/tasks"><ClipboardList className="mr-2 h-4 w-4" />All tasks</Link>
          </Button>
          {priv.canAssign && (
            <Button onClick={() => setTaskFormOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />Assign task
            </Button>
          )}
        </div>
      </div>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6" aria-label="Task summary">
        <Kpi icon={ListTodo} label="Open work" value={openTasks.length} detail={`${tasks.length} total tasks`} tone="blue" />
        <Kpi icon={UserRoundCheck} label="Assigned" value={openTasks.length - unassignedTasks.length} detail="active ownership" tone="violet" />
        <Kpi icon={CircleDot} label="Completion" value={`${overallProgress}%`} detail="all task progress" tone="green" />
        <Kpi icon={CheckCircle2} label="Done this week" value={doneThisWeek.length} detail="last 7 days" tone="green" />
        <Kpi icon={AlertTriangle} label="Overdue" value={overdueTasks.length} detail="needs follow-up" tone="red" />
        <Kpi icon={UserX} label="Unassigned" value={unassignedTasks.length} detail="owner required" tone="amber" />
      </section>

      <section className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <div className="flex flex-col gap-1 border-b border-border bg-muted/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <LayoutDashboard className="h-4 w-4 text-primary" />Team task progress
            </h2>
            <p className="text-xs text-muted-foreground">Completion percentage by assigned team member</p>
          </div>
          <span className="text-xs font-semibold text-muted-foreground">TP / 100%</span>
        </div>
        <div className="px-2 pb-2 pt-1 sm:px-4">
          <TaskProgressCylinderChart data={teamProgressChart} />
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <div className="border-b border-border bg-muted/20 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-bold">
                  <Users className="h-4 w-4 text-primary" />Assigned work by team member
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">Each person's tasks are listed under their name.</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-[minmax(190px,1fr)_150px_170px] lg:w-[600px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={event => setSearch(event.target.value)}
                    placeholder="Search task, person or case"
                    className="h-9 bg-background pl-9"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-9 bg-background"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>All statuses</SelectItem>
                    <SelectItem value="todo">To do</SelectItem>
                    <SelectItem value="in_progress">In progress</SelectItem>
                    <SelectItem value="done">Done</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={memberFilter} onValueChange={setMemberFilter}>
                  <SelectTrigger className="h-9 bg-background"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>All team members</SelectItem>
                    {members.map(member => (
                      <SelectItem key={member.user_id} value={member.user_id}>{member.full_name || "Unnamed"}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="divide-y divide-border">
            {memberWork.map(row => (
              <MemberWorkSection
                key={row.member.user_id}
                row={row}
                members={members}
                canAssign={priv.canAssign}
                actorId={priv.userId}
                expanded={expandedMembers.has(row.member.user_id)}
                onToggle={() => toggleMember(row.member.user_id)}
                onOpenTask={setProgressId}
              />
            ))}

            {filteredUnassigned.length > 0 && (
              <div className="bg-amber-500/[0.035] p-4">
                <div className="mb-3 flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full border border-amber-500/25 bg-amber-500/10 text-amber-700">
                    <UserX className="h-4 w-4" />
                  </span>
                  <div>
                    <h3 className="text-base font-bold">Unassigned work</h3>
                    <p className="text-xs text-muted-foreground">{filteredUnassigned.length} open task{filteredUnassigned.length === 1 ? "" : "s"} need an owner</p>
                  </div>
                </div>
                <div className="divide-y divide-border border-y border-border">
                  {filteredUnassigned.map(task => (
                    <TaskRowItem key={task.id} task={task} members={members} canAssign={priv.canAssign} actorId={priv.userId} onOpen={() => setProgressId(task.id)} />
                  ))}
                </div>
              </div>
            )}

            {memberWork.length === 0 && filteredUnassigned.length === 0 && (
              <div className="px-4 py-14 text-center">
                <Search className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
                <p className="font-semibold text-foreground">No matching work found</p>
                <p className="mt-1 text-xs text-muted-foreground">Try changing the search or filters.</p>
              </div>
            )}
          </div>
        </section>

        <aside className="space-y-5">
          <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-bold">
                <LayoutDashboard className="h-4 w-4 text-primary" />Work completion
              </h2>
              <span className="text-2xl font-bold tabular-nums text-foreground">{overallProgress}%</span>
            </div>
            <ProgressBar value={overallProgress} size="md" showLabel={false} />
            <div className="mt-5 space-y-4">
              {(["done", "in_progress", "todo"] as TaskStatus[]).map(status => {
                const count = tasks.filter(task => task.status === status).length;
                const share = tasks.length ? Math.round((count / tasks.length) * 100) : 0;
                const config = STATUS_CONFIG[status];
                return (
                  <div key={status}>
                    <div className="mb-1.5 flex items-center justify-between text-xs">
                      <span className="flex items-center gap-2 font-medium text-foreground">
                        <span className={`h-2.5 w-2.5 rounded-sm ${config.bar}`} />{config.label}
                      </span>
                      <span className="tabular-nums text-muted-foreground">{count} <span className="text-[10px]">({share}%)</span></span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className={`h-full rounded-full ${config.bar}`} style={{ width: `${share}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card shadow-sm">
            <div className="flex items-center justify-between border-b border-border p-4">
              <h2 className="flex items-center gap-2 text-lg font-bold">
                <AlertTriangle className="h-4 w-4 text-rose-500" />Needs attention
              </h2>
              <span className="text-xs font-semibold tabular-nums text-muted-foreground">{attentionTasks.length}</span>
            </div>
            {attentionTasks.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <Sparkles className="mx-auto mb-2 h-6 w-6 text-emerald-500" />
                <p className="text-sm font-semibold">Everything is on track</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {attentionTasks.map(task => (
                  <div key={task.id} className="p-3.5">
                    <button onClick={() => setProgressId(task.id)} className="block w-full text-left text-sm font-semibold leading-snug hover:text-primary">
                      {task.title}
                    </button>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px]">
                      {isTaskOverdue(task) && <span className="font-bold uppercase text-rose-600">Overdue</span>}
                      {!task.assigned_to && <span className="font-bold uppercase text-amber-700">Unassigned</span>}
                      {task.priority === "high" && <span className="font-bold uppercase text-rose-600">High priority</span>}
                    </div>
                    <div className="mt-2">
                      <AssigneeControl task={task} members={members} canAssign={priv.canAssign} actorId={priv.userId} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
              <Clock3 className="h-4 w-4 text-primary" />Recent activity
            </h2>
            <div className="max-h-[420px] overflow-y-auto pr-1">
              <TaskActivityFeed updates={updates} members={members} taskTitles={taskTitles} isError={updatesError} />
            </div>
          </section>
        </aside>
      </div>

      <TaskFormDialog
        open={taskFormOpen}
        onOpenChange={setTaskFormOpen}
        editTask={null}
        members={members}
        actorId={priv.userId}
        canAssign={priv.canAssign}
      />
      <TaskProgressDialog
        task={progressTask}
        members={members}
        open={!!progressTask}
        onOpenChange={open => { if (!open) setProgressId(null); }}
        actorId={priv.userId}
        canAssign={priv.canAssign}
        canUpdate={progressTask ? priv.canUpdateProgress(progressTask) : false}
      />
    </div>
  );
}

function MemberWorkSection({ row, members, canAssign, actorId, expanded, onToggle, onOpenTask }: {
  row: MemberWork;
  members: TeamMember[];
  canAssign: boolean;
  actorId: string;
  expanded: boolean;
  onToggle: () => void;
  onOpenTask: (taskId: string) => void;
}) {
  const visibleTasks = expanded ? row.tasks : row.tasks.slice(0, 4);
  const remaining = row.tasks.length - visibleTasks.length;
  const name = row.member.full_name || "Unnamed member";

  return (
    <article className="p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <MemberAvatar name={name} className="h-10 w-10 border-2 text-xs" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h3 className="truncate text-base font-bold">{name}</h3>
              <span className="rounded border border-border bg-muted/60 px-1.5 py-0.5 text-[9px] font-bold uppercase text-muted-foreground">
                {row.member.role.replace("_", " ")}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {row.open} open / {row.done} completed{row.overdue > 0 ? ` / ${row.overdue} overdue` : ""}
            </p>
          </div>
        </div>
        <div className="w-full sm:w-52">
          <div className="mb-1 flex items-center justify-between text-[10px] font-semibold text-muted-foreground">
            <span>Overall progress</span><span className="tabular-nums">{row.progress}%</span>
          </div>
          <ProgressBar value={row.progress} showLabel={false} />
        </div>
      </div>

      {row.tasks.length === 0 ? (
        <p className="mt-4 border-t border-border pt-4 text-xs italic text-muted-foreground">No tasks assigned.</p>
      ) : (
        <div className="mt-4 divide-y divide-border border-y border-border">
          {visibleTasks.map(task => (
            <TaskRowItem key={task.id} task={task} members={members} canAssign={canAssign} actorId={actorId} onOpen={() => onOpenTask(task.id)} />
          ))}
        </div>
      )}

      {row.tasks.length > 4 && (
        <button onClick={onToggle} className="mt-3 flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          {expanded ? "Show fewer tasks" : `Show ${remaining} more task${remaining === 1 ? "" : "s"}`}
        </button>
      )}
    </article>
  );
}

function TaskRowItem({ task, members, canAssign, actorId, onOpen }: {
  task: TaskRow;
  members: TeamMember[];
  canAssign: boolean;
  actorId: string;
  onOpen: () => void;
}) {
  const progress = taskProgress(task);
  const priority = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG.medium;
  const overdue = isTaskOverdue(task);

  return (
    <div className="grid gap-3 py-3 md:grid-cols-[minmax(0,1fr)_145px_145px] md:items-center">
      <div className="min-w-0">
        <button onClick={onOpen} className="group flex max-w-full items-center gap-1.5 text-left text-sm font-semibold leading-snug hover:text-primary">
          <span className="truncate">{task.title}</span><ArrowRight className="h-3.5 w-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
        </button>
        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
          <StatusPill status={task.status} />
          <span className={`font-bold uppercase ${priority.color}`}>{priority.label}</span>
          {task.cases && (
            <Link to={`/cases/${task.case_id}`} className="font-mono hover:text-primary">{task.cases.case_number}</Link>
          )}
          {task.due_date && (
            <span className={`flex items-center gap-1 ${overdue ? "font-semibold text-rose-600" : ""}`}>
              <CalendarDays className="h-3 w-3" />{format(new Date(`${task.due_date}T00:00:00`), "dd MMM yyyy")}
            </span>
          )}
        </div>
      </div>
      <ProgressBar value={progress} />
      <div className="md:justify-self-end">
        <AssigneeControl task={task} members={members} canAssign={canAssign} actorId={actorId} />
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, detail, tone }: {
  icon: typeof ListTodo;
  label: string;
  value: number | string;
  detail: string;
  tone: "blue" | "violet" | "green" | "red" | "amber";
}) {
  const tones = {
    blue: "bg-sky-500/10 text-sky-600 border-sky-500/15",
    violet: "bg-violet-500/10 text-violet-600 border-violet-500/15",
    green: "bg-emerald-500/10 text-emerald-600 border-emerald-500/15",
    red: "bg-rose-500/10 text-rose-600 border-rose-500/15",
    amber: "bg-amber-500/10 text-amber-700 border-amber-500/15",
  };

  return (
    <div className="min-w-0 rounded-lg border border-border bg-card p-3.5 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-semibold text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{value}</p>
        </div>
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md border ${tones[tone]}`}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">{detail}</p>
    </div>
  );
}
