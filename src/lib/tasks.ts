import {
  Circle, Clock, CheckCircle2, ArrowUp, ArrowRight, ArrowDown,
} from "lucide-react";
import { restInsert, restUpdate } from "@/lib/restClient";

export type TaskStatus = "todo" | "in_progress" | "done";
export type TaskPriority = "high" | "medium" | "low";
export type TaskUpdateKind = "created" | "progress" | "status" | "assigned" | "unassigned" | "comment";

export interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  progress: number | null;
  due_date: string | null;
  case_id: string | null;
  assigned_to: string | null;
  assigned_by: string | null;
  assigned_at: string | null;
  created_by: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string | null;
  cases?: { title: string; case_number: string } | null;
}

export interface TaskUpdateRow {
  id: string;
  task_id: string;
  case_id: string | null;
  user_id: string;
  kind: TaskUpdateKind;
  note: string | null;
  progress: number | null;
  status: string | null;
  assignee: string | null;
  created_at: string;
}

export interface TeamMember {
  user_id: string;
  full_name: string | null;
  role: string;
}

export const STATUS_CONFIG: Record<TaskStatus, { label: string; icon: typeof Circle; bg: string; text: string; border: string; bar: string }> = {
  todo:        { label: "To Do",       icon: Circle,       bg: "bg-slate-500/10",   text: "text-slate-500",   border: "border-slate-500/20",   bar: "bg-slate-400" },
  in_progress: { label: "In Progress", icon: Clock,        bg: "bg-amber-500/10",   text: "text-amber-600",   border: "border-amber-500/20",   bar: "bg-amber-500" },
  done:        { label: "Done",        icon: CheckCircle2, bg: "bg-emerald-500/10", text: "text-emerald-600", border: "border-emerald-500/20", bar: "bg-emerald-500" },
};

export const PRIORITY_CONFIG: Record<TaskPriority, { label: string; icon: typeof ArrowUp; color: string }> = {
  high:   { label: "High",   icon: ArrowUp,    color: "text-rose-500" },
  medium: { label: "Medium", icon: ArrowRight, color: "text-amber-500" },
  low:    { label: "Low",    icon: ArrowDown,  color: "text-blue-500" },
};

export const TASKS_SELECT = "tasks?select=*,cases(title,case_number)";

export function taskProgress(t: Pick<TaskRow, "status" | "progress">): number {
  if (t.status === "done") return 100;
  return Math.max(0, Math.min(100, t.progress ?? 0));
}

export function isTaskOverdue(t: Pick<TaskRow, "status" | "due_date">): boolean {
  if (!t.due_date || t.status === "done") return false;
  return new Date(t.due_date) < new Date(new Date().toISOString().split("T")[0]);
}

/** Overall completion of a set of tasks (e.g. one case), 0–100. Null when there are no tasks. */
export function aggregateProgress(tasks: Pick<TaskRow, "status" | "progress">[]): number | null {
  if (!tasks.length) return null;
  return Math.round(tasks.reduce((sum, t) => sum + taskProgress(t), 0) / tasks.length);
}

/** Keep status and progress consistent: 100% means done, done means 100%, any progress starts the task. */
export function normalizeStatusProgress(status: TaskStatus, progress: number): { status: TaskStatus; progress: number } {
  const p = Math.max(0, Math.min(100, Math.round(progress)));
  if (status === "done" || p >= 100) return { status: "done", progress: 100 };
  if (status === "todo" && p > 0) return { status: "in_progress", progress: p };
  return { status, progress: p };
}

/** Columns to write when status/progress change, including completed_at. */
export function statusProgressPatch(
  status: TaskStatus,
  progress: number,
  prev?: Pick<TaskRow, "completed_at"> | null,
) {
  const n = normalizeStatusProgress(status, progress);
  return {
    ...n,
    completed_at: n.status === "done" ? prev?.completed_at ?? new Date().toISOString() : null,
  };
}

/** Best-effort activity log entry; a logging failure never blocks the task change itself. */
export async function logTaskUpdate(entry: {
  task_id: string;
  case_id: string | null;
  user_id: string;
  kind: TaskUpdateKind;
  note?: string | null;
  progress?: number | null;
  status?: string | null;
  assignee?: string | null;
}): Promise<void> {
  try {
    await restInsert("task_updates", {
      note: null, progress: null, status: null, assignee: null,
      ...entry,
    });
  } catch {
    // Activity history is secondary to the task write
  }
}

export async function assignTask(task: Pick<TaskRow, "id" | "case_id" | "assigned_to">, assignee: string | null, actorId: string) {
  await restUpdate("tasks", `id=eq.${task.id}`, {
    assigned_to: assignee,
    assigned_by: actorId,
    assigned_at: new Date().toISOString(),
  });
  await logTaskUpdate({
    task_id: task.id,
    case_id: task.case_id,
    user_id: actorId,
    kind: assignee ? "assigned" : "unassigned",
    assignee: assignee ?? task.assigned_to,
  });
}

/** One-click status step: To Do → In Progress → Done → To Do. */
export async function cycleTaskStatus(task: TaskRow, actorId: string) {
  const next: TaskStatus = task.status === "todo" ? "in_progress" : task.status === "in_progress" ? "done" : "todo";
  const current = taskProgress(task);
  const nextProgress = next === "in_progress" ? (current > 0 && current < 100 ? current : 10) : next === "done" ? 100 : 0;
  const patch = statusProgressPatch(next, nextProgress, task);
  await restUpdate("tasks", `id=eq.${task.id}`, patch);
  await logTaskUpdate({ task_id: task.id, case_id: task.case_id, user_id: actorId, kind: "status", status: patch.status, progress: patch.progress });
}

export function memberName(members: TeamMember[], userId: string | null | undefined): string {
  if (!userId) return "Unassigned";
  return members.find(m => m.user_id === userId)?.full_name || "Unknown member";
}

export function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join("") || "?";
}

/** Query keys every task mutation should refresh. */
export const TASK_QUERY_KEYS = [["tasks"], ["case-tasks"], ["task-dashboard"], ["task-updates"], ["notifications"]] as const;
