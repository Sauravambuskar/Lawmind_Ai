import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import {
  UserPlus, UserMinus, UserCheck, ChevronDown, MessageSquare, TrendingUp, PlusCircle, RefreshCw, History,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { restGet, restGetAll } from "@/lib/restClient";
import {
  assignTask, initials, memberName, STATUS_CONFIG, TASK_QUERY_KEYS,
  type TaskRow, type TaskStatus, type TaskUpdateRow, type TeamMember,
} from "@/lib/tasks";
import { cn } from "@/lib/utils";

export function useTeamMembers() {
  return useQuery({
    queryKey: ["team-members"],
    queryFn: () =>
      restGetAll<TeamMember>("profiles?select=user_id,full_name,role&status=eq.active&order=full_name.asc"),
    staleTime: 5 * 60 * 1000,
  });
}

export function useInvalidateTasks() {
  const qc = useQueryClient();
  return () => TASK_QUERY_KEYS.forEach(key => qc.invalidateQueries({ queryKey: [...key] }));
}

export function progressColor(value: number) {
  if (value >= 100) return "bg-emerald-500";
  if (value >= 60) return "bg-sky-500";
  if (value >= 25) return "bg-amber-500";
  return "bg-slate-400";
}

export function ProgressBar({ value, size = "sm", showLabel = true, className }: {
  value: number; size?: "xs" | "sm" | "md"; showLabel?: boolean; className?: string;
}) {
  const h = size === "xs" ? "h-1" : size === "sm" ? "h-1.5" : "h-2.5";
  return (
    <div className={cn("flex items-center gap-2 min-w-0", className)}>
      <div className={cn("flex-1 rounded-full bg-muted overflow-hidden", h)} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
        <div className={cn("h-full rounded-full transition-all duration-500", progressColor(value))} style={{ width: `${value}%` }} />
      </div>
      {showLabel && <span className="text-[11px] font-semibold tabular-nums text-muted-foreground w-9 text-right">{value}%</span>}
    </div>
  );
}

export function MemberAvatar({ name, className }: { name: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-[10px] font-bold shrink-0 border border-primary/20", className)}>
      {initials(name)}
    </span>
  );
}

export function StatusPill({ status }: { status: TaskStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.todo;
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      {cfg.label}
    </span>
  );
}

/**
 * Shows who a task is assigned to. With the assign privilege it becomes a menu
 * to assign, reassign or unassign.
 */
export function AssigneeControl({ task, members, canAssign, actorId, compact = false }: {
  task: Pick<TaskRow, "id" | "case_id" | "assigned_to">;
  members: TeamMember[];
  canAssign: boolean;
  actorId: string;
  compact?: boolean;
}) {
  const invalidate = useInvalidateTasks();
  const name = memberName(members, task.assigned_to);

  const label = task.assigned_to ? (
    <span className="flex items-center gap-1.5 min-w-0">
      <MemberAvatar name={name} className="w-5 h-5 text-[9px]" />
      {!compact && <span className="text-xs font-medium text-foreground truncate max-w-[120px]">{name}</span>}
    </span>
  ) : (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground italic">
      <UserPlus className="w-3.5 h-3.5" />{!compact && "Unassigned"}
    </span>
  );

  if (!canAssign) return <span title={name}>{label}</span>;

  const change = async (assignee: string | null) => {
    if (assignee === task.assigned_to) return;
    try {
      await assignTask(task, assignee, actorId);
      invalidate();
      toast.success(assignee ? `Assigned to ${memberName(members, assignee)}` : "Task unassigned");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to change assignee");
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-1 rounded-md px-1.5 py-1 -mx-1.5 hover:bg-muted transition-colors" title="Assign / unassign">
          {label}
          <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56 max-h-72 overflow-y-auto">
        <DropdownMenuLabel className="text-xs">Assign to</DropdownMenuLabel>
        {members.map(m => (
          <DropdownMenuItem key={m.user_id} onClick={() => change(m.user_id)} className="gap-2">
            <MemberAvatar name={m.full_name || "?"} className="w-5 h-5 text-[9px]" />
            <span className="flex-1 truncate">{m.full_name || "Unnamed"}</span>
            {m.user_id === task.assigned_to && <UserCheck className="w-3.5 h-3.5 text-emerald-500" />}
          </DropdownMenuItem>
        ))}
        {task.assigned_to && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => change(null)} className="gap-2 text-rose-600 focus:text-rose-600">
              <UserMinus className="w-4 h-4" /> Unassign
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const KIND_META: Record<TaskUpdateRow["kind"], { icon: typeof History; color: string }> = {
  created:    { icon: PlusCircle,    color: "text-sky-500 bg-sky-500/10" },
  progress:   { icon: TrendingUp,    color: "text-amber-600 bg-amber-500/10" },
  status:     { icon: RefreshCw,     color: "text-violet-500 bg-violet-500/10" },
  assigned:   { icon: UserPlus,      color: "text-emerald-600 bg-emerald-500/10" },
  unassigned: { icon: UserMinus,     color: "text-rose-500 bg-rose-500/10" },
  comment:    { icon: MessageSquare, color: "text-slate-500 bg-slate-500/10" },
};

function describeUpdate(u: TaskUpdateRow, members: TeamMember[]): string {
  switch (u.kind) {
    case "created": return "created the task";
    case "progress": return `updated progress to ${u.progress ?? 0}%`;
    case "status": return `marked it ${STATUS_CONFIG[u.status as TaskStatus]?.label ?? u.status}`;
    case "assigned": return `assigned it to ${memberName(members, u.assignee)}`;
    case "unassigned": return `unassigned ${memberName(members, u.assignee)}`;
    case "comment": return "added a note";
  }
}

/** Activity timeline for one task, one case, or everything (filter = PostgREST filter). */
export function useTaskUpdates(filter: string, limit = 50, enabled = true) {
  return useQuery({
    queryKey: ["task-updates", filter, limit],
    queryFn: () => restGet<TaskUpdateRow>(`task_updates?select=*${filter ? `&${filter}` : ""}&order=created_at.desc&limit=${limit}`),
    enabled,
    retry: false,
  });
}

export function TaskActivityFeed({ updates, members, taskTitles, emptyText = "No activity yet", isError }: {
  updates: TaskUpdateRow[];
  members: TeamMember[];
  taskTitles?: Map<string, string>;
  emptyText?: string;
  isError?: boolean;
}) {
  if (isError) {
    return <p className="text-xs text-muted-foreground italic py-4 text-center">Activity history is not available yet (database update pending).</p>;
  }
  if (!updates.length) return <p className="text-xs text-muted-foreground italic py-4 text-center">{emptyText}</p>;
  return (
    <ol className="space-y-3">
      {updates.map(u => {
        const meta = KIND_META[u.kind] ?? KIND_META.comment;
        const Icon = meta.icon;
        const title = taskTitles?.get(u.task_id);
        return (
          <li key={u.id} className="flex gap-2.5">
            <span className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${meta.color}`}><Icon className="w-3.5 h-3.5" /></span>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-foreground leading-snug">
                <span className="font-semibold">{memberName(members, u.user_id)}</span>{" "}
                <span className="text-muted-foreground">{describeUpdate(u, members)}</span>
                {title && <> on <span className="font-medium">{title}</span></>}
              </p>
              {u.note && <p className="text-xs text-foreground/80 mt-1 bg-muted/40 border border-border rounded-md px-2 py-1.5 whitespace-pre-wrap">{u.note}</p>}
              <p className="text-[10px] text-muted-foreground mt-0.5">{formatDistanceToNow(new Date(u.created_at), { addSuffix: true })}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
