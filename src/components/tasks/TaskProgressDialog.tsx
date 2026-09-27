import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import { BriefcaseBusiness, CalendarDays, TrendingUp } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { restUpdate } from "@/lib/restClient";
import {
  logTaskUpdate, memberName, normalizeStatusProgress, statusProgressPatch, STATUS_CONFIG, taskProgress,
  type TaskRow, type TaskStatus, type TeamMember,
} from "@/lib/tasks";
import {
  AssigneeControl, ProgressBar, TaskActivityFeed, useInvalidateTasks, useTaskUpdates,
} from "@/components/tasks/TaskBits";

const QUICK_STEPS = [0, 25, 50, 75, 100];

export function TaskProgressDialog({ task, members, open, onOpenChange, actorId, canAssign, canUpdate }: {
  task: TaskRow | null;
  members: TeamMember[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
  actorId: string;
  canAssign: boolean;
  canUpdate: boolean;
}) {
  const invalidate = useInvalidateTasks();
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<TaskStatus>("todo");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (task && open) {
      setProgress(taskProgress(task));
      setStatus(task.status);
      setNote("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.id, open]);

  const { data: updates = [], isError } = useTaskUpdates(task ? `task_id=eq.${task.id}` : "", 30, !!task && open);

  const save = useMutation({
    mutationFn: async () => {
      if (!task) return;
      const patch = statusProgressPatch(status, progress, task);
      const progressChanged = patch.progress !== taskProgress(task);
      const statusChanged = patch.status !== task.status;
      const trimmed = note.trim();
      if (!progressChanged && !statusChanged && !trimmed) throw new Error("Nothing changed — move the slider or add a note");

      if (progressChanged || statusChanged) await restUpdate("tasks", `id=eq.${task.id}`, patch);

      await logTaskUpdate({
        task_id: task.id,
        case_id: task.case_id,
        user_id: actorId,
        kind: progressChanged ? "progress" : statusChanged ? "status" : "comment",
        note: trimmed || null,
        progress: patch.progress,
        status: patch.status,
      });
    },
    onSuccess: () => {
      invalidate();
      toast.success("Progress updated");
      onOpenChange(false);
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed to update progress"),
  });

  if (!task) return null;

  const setSlider = (v: number) => {
    const n = normalizeStatusProgress(status === "done" && v < 100 ? "in_progress" : status, v);
    setProgress(n.progress);
    setStatus(n.status);
  };
  const pickStatus = (s: TaskStatus) => {
    setStatus(s);
    if (s === "done") setProgress(100);
    else if (s === "todo") setProgress(0);
    else if (progress === 0 || progress === 100) setProgress(progress === 100 ? 90 : 10);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold pr-6">{task.title}</DialogTitle>
          <DialogDescription asChild>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {task.cases && <span className="flex items-center gap-1"><BriefcaseBusiness className="w-3.5 h-3.5" />{task.cases.case_number}</span>}
              {task.due_date && <span className="flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5" />Due {format(new Date(task.due_date + "T00:00:00"), "dd MMM yyyy")}</span>}
              {task.assigned_by && task.assigned_at && task.assigned_to && (
                <span>Assigned by {memberName(members, task.assigned_by)} · {format(new Date(task.assigned_at), "dd MMM")}</span>
              )}
            </div>
          </DialogDescription>
        </DialogHeader>

        {task.description && <p className="text-sm text-foreground/80 whitespace-pre-wrap bg-muted/30 border border-border rounded-lg p-3">{task.description}</p>}

        <div className="flex items-center justify-between gap-3 py-1">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Assignee</Label>
          <AssigneeControl task={task} members={members} canAssign={canAssign} actorId={actorId} />
        </div>

        {canUpdate ? (
          <div className="space-y-4 rounded-xl border border-border p-4 bg-muted/10">
            <div className="flex items-center justify-between">
              <Label className="font-semibold flex items-center gap-1.5"><TrendingUp className="w-4 h-4 text-primary" />Work progress</Label>
              <span className="text-2xl font-bold tabular-nums text-foreground">{progress}%</span>
            </div>
            <Slider value={[progress]} min={0} max={100} step={5} onValueChange={([v]) => setSlider(v)} aria-label="Task progress" />
            <div className="flex gap-1.5">
              {QUICK_STEPS.map(v => (
                <button key={v} onClick={() => setSlider(v)}
                  className={`flex-1 text-[11px] font-semibold rounded-md py-1 border transition-colors ${progress === v ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:bg-muted"}`}>
                  {v}%
                </button>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {(Object.keys(STATUS_CONFIG) as TaskStatus[]).map(s => {
                const cfg = STATUS_CONFIG[s];
                const Icon = cfg.icon;
                return (
                  <button key={s} onClick={() => pickStatus(s)}
                    className={`flex items-center justify-center gap-1.5 text-xs font-semibold rounded-md py-2 border transition-colors ${status === s ? `${cfg.bg} ${cfg.text} ${cfg.border} ring-1 ring-current` : "border-border text-muted-foreground hover:bg-muted"}`}>
                    <Icon className="w-3.5 h-3.5" />{cfg.label}
                  </button>
                );
              })}
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">What was done? (optional)</Label>
              <Textarea value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Draft reply prepared, awaiting client signature" className="min-h-[70px] bg-background" />
            </div>
            <Button onClick={() => save.mutate()} disabled={save.isPending} className="w-full">
              {save.isPending ? "Saving..." : "Save progress update"}
            </Button>
          </div>
        ) : (
          <div className="rounded-xl border border-border p-4">
            <ProgressBar value={taskProgress(task)} size="md" />
            <p className="text-xs text-muted-foreground mt-2">Only the assignee, the task creator, or members with the assign privilege can update progress.</p>
          </div>
        )}

        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Activity</h4>
          <TaskActivityFeed updates={updates} members={members} isError={isError} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
