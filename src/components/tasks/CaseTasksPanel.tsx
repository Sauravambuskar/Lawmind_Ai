import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  AlertTriangle, CalendarDays, ListTodo, Pencil, Plus, TrendingUp, UserPlus, Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DeleteConfirm } from "@/components/DeleteConfirm";
import { restDelete } from "@/lib/restClient";
import { useTaskPrivileges } from "@/hooks/useTaskPrivileges";
import {
  aggregateProgress, cycleTaskStatus, isTaskOverdue, memberName, PRIORITY_CONFIG, STATUS_CONFIG, taskProgress,
  type TaskRow,
} from "@/lib/tasks";
import {
  AssigneeControl, MemberAvatar, ProgressBar, StatusPill, TaskActivityFeed,
  useInvalidateTasks, useTaskUpdates, useTeamMembers,
} from "@/components/tasks/TaskBits";
import { TaskFormDialog } from "@/components/tasks/TaskFormDialog";
import { TaskProgressDialog } from "@/components/tasks/TaskProgressDialog";

export function CaseTasksPanel({ caseId, tasks }: { caseId: string; tasks: TaskRow[] }) {
  const priv = useTaskPrivileges();
  const invalidate = useInvalidateTasks();
  const { data: members = [] } = useTeamMembers();
  const { data: updates = [], isError } = useTaskUpdates(`case_id=eq.${caseId}`, 25);

  const [formOpen, setFormOpen] = useState(false);
  const [editTask, setEditTask] = useState<TaskRow | null>(null);
  const [progressId, setProgressId] = useState<string | null>(null);
  const progressTask = tasks.find(t => t.id === progressId) ?? null;

  const overall = aggregateProgress(tasks);
  const done = tasks.filter(t => t.status === "done").length;
  const inProgress = tasks.filter(t => t.status === "in_progress").length;
  const overdue = tasks.filter(isTaskOverdue).length;
  const unassigned = tasks.filter(t => !t.assigned_to && t.status !== "done").length;
  const team = useMemo(() => [...new Set(tasks.map(t => t.assigned_to).filter(Boolean) as string[])], [tasks]);
  const taskTitles = useMemo(() => new Map(tasks.map(t => [t.id, t.title])), [tasks]);

  const cycle = useMutation({
    mutationFn: (t: TaskRow) => cycleTaskStatus(t, priv.userId),
    onSuccess: invalidate,
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed to update status"),
  });
  const del = useMutation({
    mutationFn: (id: string) => restDelete("tasks", `id=eq.${id}`),
    onSuccess: () => { invalidate(); toast.success("Task deleted"); },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed to delete task"),
  });

  const ordered = [...tasks].sort((a, b) => {
    const rank = { in_progress: 0, todo: 1, done: 2 } as const;
    return rank[a.status] - rank[b.status] || (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999");
  });

  return (
    <div className="space-y-5">
      {/* Case progress summary */}
      <div className="rounded-xl border border-border bg-gradient-to-br from-primary/5 to-transparent p-4">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline justify-between mb-2">
              <h3 className="font-bold flex items-center gap-1.5"><TrendingUp className="w-4 h-4 text-primary" />Case Work Progress</h3>
              <span className="text-2xl font-bold tabular-nums">{overall ?? 0}%</span>
            </div>
            <ProgressBar value={overall ?? 0} size="md" showLabel={false} />
            <p className="text-xs text-muted-foreground mt-2">
              {tasks.length === 0 ? "No tasks yet — add tasks to start tracking this case." : `${done} of ${tasks.length} tasks done`}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 md:w-[300px] shrink-0">
            <MiniStat label="In progress" value={inProgress} tone="text-amber-600" />
            <MiniStat label="Overdue" value={overdue} tone={overdue ? "text-rose-600" : "text-foreground"} />
            <MiniStat label="Unassigned" value={unassigned} tone={unassigned ? "text-violet-600" : "text-foreground"} />
          </div>
        </div>
        {team.length > 0 && (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/60">
            <Users className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Working on this case:</span>
            <div className="flex flex-wrap gap-1.5">
              {team.map(uid => {
                const name = memberName(members, uid);
                const mine = tasks.filter(t => t.assigned_to === uid);
                return (
                  <span key={uid} className="inline-flex items-center gap-1.5 text-xs bg-background border border-border rounded-full pl-0.5 pr-2 py-0.5" title={`${mine.length} task(s), ${aggregateProgress(mine)}% complete`}>
                    <MemberAvatar name={name} className="w-5 h-5 text-[9px]" />{name}
                    <span className="text-muted-foreground tabular-nums">{aggregateProgress(mine)}%</span>
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-[1fr_300px] gap-5">
        {/* Task list */}
        <div>
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-bold">Tasks <span className="text-muted-foreground font-normal text-sm">({tasks.length})</span></h3>
            <Button size="sm" onClick={() => { setEditTask(null); setFormOpen(true); }}><Plus className="w-4 h-4 mr-1" />Add Task</Button>
          </div>

          {tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 border border-dashed border-border rounded-lg">
              <ListTodo className="w-10 h-10 text-muted-foreground opacity-30 mb-2" />
              <p className="text-sm font-medium text-muted-foreground">No tasks for this case</p>
            </div>
          ) : (
            <div className="space-y-2">
              {ordered.map(t => {
                const cfg = STATUS_CONFIG[t.status] ?? STATUS_CONFIG.todo;
                const StatusIcon = cfg.icon;
                const pr = PRIORITY_CONFIG[t.priority] ?? PRIORITY_CONFIG.medium;
                const overdueTask = isTaskOverdue(t);
                const canUpdate = priv.canUpdateProgress(t);
                const canManage = priv.canManageTask(t);
                return (
                  <div key={t.id} className={`group p-3 border rounded-lg hover:bg-muted/20 transition-colors ${overdueTask ? "border-rose-300 dark:border-rose-800" : "border-border"}`}>
                    <div className="flex items-start gap-3">
                      <button
                        onClick={() => canUpdate && cycle.mutate(t)}
                        disabled={!canUpdate}
                        className="p-0.5 mt-0.5 rounded-md hover:bg-muted transition-colors disabled:cursor-default"
                        title={canUpdate ? `Click to change from ${cfg.label}` : cfg.label}
                      >
                        <StatusIcon className={`w-5 h-5 ${cfg.text}`} />
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <button onClick={() => setProgressId(t.id)} className={`text-sm font-semibold text-left hover:text-primary ${t.status === "done" ? "line-through text-muted-foreground" : ""}`}>{t.title}</button>
                          <StatusPill status={t.status} />
                          <span className={`text-[10px] font-bold uppercase ${pr.color}`}>{pr.label}</span>
                        </div>
                        {t.description && <p className="text-xs text-muted-foreground truncate mt-0.5">{t.description}</p>}
                        <ProgressBar value={taskProgress(t)} className="mt-2 max-w-md" />
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
                          <AssigneeControl task={t} members={members} canAssign={priv.canAssign} actorId={priv.userId} />
                          {t.due_date && (
                            <span className={`flex items-center gap-1 text-xs ${overdueTask ? "text-rose-500 font-semibold" : "text-muted-foreground"}`}>
                              <CalendarDays className="w-3.5 h-3.5" />{format(new Date(t.due_date + "T00:00:00"), "dd MMM yyyy")}
                              {overdueTask && <AlertTriangle className="w-3 h-3" />}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        {canUpdate && (
                          <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => setProgressId(t.id)}>
                            <TrendingUp className="w-3.5 h-3.5" /><span className="hidden sm:inline">Update</span>
                          </Button>
                        )}
                        {canManage && (
                          <>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditTask(t); setFormOpen(true); }}><Pencil className="w-3.5 h-3.5" /></Button>
                            <DeleteConfirm onConfirm={() => del.mutate(t.id)} />
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {!priv.canAssign && tasks.some(t => !t.assigned_to) && (
            <p className="text-[11px] text-muted-foreground mt-3 flex items-center gap-1"><UserPlus className="w-3 h-3" />Only admins and members with the assign privilege can assign tasks to others.</p>
          )}
        </div>

        {/* Case activity */}
        <div className="rounded-xl border border-border p-4 h-fit lg:sticky lg:top-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Recent Activity</h4>
          <div className="max-h-[480px] overflow-y-auto pr-1">
            <TaskActivityFeed updates={updates} members={members} taskTitles={taskTitles} isError={isError} emptyText="No progress updates on this case yet" />
          </div>
        </div>
      </div>

      <TaskFormDialog open={formOpen} onOpenChange={setFormOpen} editTask={editTask} fixedCaseId={caseId} members={members} actorId={priv.userId} canAssign={priv.canAssign} />
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

function MiniStat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-lg bg-background border border-border px-2 py-2 text-center">
      <p className={`text-lg font-bold tabular-nums ${tone}`}>{value}</p>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">{label}</p>
    </div>
  );
}
