import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowDown, ArrowRight, ArrowUp } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AITextarea } from "@/components/AITextarea";
import { restGetAll, restInsert, restUpdate } from "@/lib/restClient";
import {
  logTaskUpdate, memberName, statusProgressPatch, taskProgress,
  type TaskPriority, type TaskRow, type TaskStatus, type TeamMember,
} from "@/lib/tasks";
import { useInvalidateTasks } from "@/components/tasks/TaskBits";

const NONE = "__none";

const emptyForm = {
  title: "", description: "", status: "todo" as TaskStatus, priority: "medium" as TaskPriority,
  due_date: "", case_id: NONE, assigned_to: NONE,
};

export function TaskFormDialog({ open, onOpenChange, editTask, fixedCaseId, members, actorId, canAssign }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editTask: TaskRow | null;
  /** When set, the task belongs to this case and the case picker is hidden. */
  fixedCaseId?: string;
  members: TeamMember[];
  actorId: string;
  canAssign: boolean;
}) {
  const invalidate = useInvalidateTasks();
  const [form, setForm] = useState(emptyForm);

  const { data: cases = [] } = useQuery({
    queryKey: ["cases-lookup"],
    queryFn: () => restGetAll<{ id: string; title: string; case_number: string }>("cases?select=id,title,case_number&order=created_at.desc"),
    enabled: open && !fixedCaseId,
  });

  useEffect(() => {
    if (!open) return;
    setForm(editTask ? {
      title: editTask.title,
      description: editTask.description || "",
      status: editTask.status,
      priority: editTask.priority,
      due_date: editTask.due_date || "",
      case_id: editTask.case_id || NONE,
      assigned_to: editTask.assigned_to || NONE,
    } : {
      ...emptyForm,
      assigned_to: canAssign ? NONE : actorId,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editTask?.id]);

  // Without the assign privilege a member can only give a task to themselves.
  const assigneeLocked = !canAssign && !!editTask?.assigned_to && editTask.assigned_to !== actorId;
  const assigneeOptions = canAssign ? members : members.filter(m => m.user_id === actorId);

  const save = useMutation({
    mutationFn: async () => {
      const assignee = form.assigned_to === NONE ? null : form.assigned_to;
      const caseId = fixedCaseId ?? (form.case_id === NONE ? null : form.case_id);
      const base = {
        title: form.title.trim(),
        description: form.description || null,
        priority: form.priority,
        due_date: form.due_date || null,
        case_id: caseId,
      };

      if (editTask) {
        const prev = taskProgress(editTask);
        const nextProgress =
          form.status === editTask.status ? prev
          : form.status === "in_progress" ? (prev > 0 && prev < 100 ? prev : 10)
          : form.status === "done" ? 100
          : 0;
        const sp = statusProgressPatch(form.status, nextProgress, editTask);
        const assigneeChanged = !assigneeLocked && assignee !== editTask.assigned_to;
        await restUpdate("tasks", `id=eq.${editTask.id}`, {
          ...base,
          ...sp,
          ...(assigneeChanged ? { assigned_to: assignee, assigned_by: actorId, assigned_at: new Date().toISOString() } : {}),
        });
        if (sp.status !== editTask.status) {
          await logTaskUpdate({ task_id: editTask.id, case_id: caseId, user_id: actorId, kind: "status", status: sp.status, progress: sp.progress });
        }
        if (assigneeChanged) {
          await logTaskUpdate({ task_id: editTask.id, case_id: caseId, user_id: actorId, kind: assignee ? "assigned" : "unassigned", assignee: assignee ?? editTask.assigned_to });
        }
        return;
      }

      const sp = statusProgressPatch(form.status, form.status === "in_progress" ? 10 : 0);
      const [created] = await restInsert<TaskRow>("tasks", {
        ...base,
        ...sp,
        created_by: actorId,
        assigned_to: assignee,
        ...(assignee ? { assigned_by: actorId, assigned_at: new Date().toISOString() } : {}),
      }, { returning: true });
      if (created) {
        await logTaskUpdate({ task_id: created.id, case_id: caseId, user_id: actorId, kind: "created", status: sp.status, progress: sp.progress });
        if (assignee) await logTaskUpdate({ task_id: created.id, case_id: caseId, user_id: actorId, kind: "assigned", assignee });
      }
    },
    onSuccess: () => {
      invalidate();
      onOpenChange(false);
      toast.success(editTask ? "Task updated" : "Task created");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed to save task"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="text-xl font-bold">{editTask ? "Edit Task" : "Create New Task"}</DialogTitle></DialogHeader>
        <div className="grid gap-4 py-2 px-1">
          <div className="grid gap-2">
            <Label className="font-semibold text-muted-foreground">Title *</Label>
            <Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Draft Written Statement" className="bg-muted/50" />
          </div>
          <div className="grid gap-2">
            <Label className="font-semibold text-muted-foreground">Description</Label>
            <AITextarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Task details..." className="bg-muted/50 min-h-[80px]" context="Legal task description" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label className="font-semibold text-muted-foreground">Priority</Label>
              <Select value={form.priority} onValueChange={v => setForm(p => ({ ...p, priority: v as TaskPriority }))}>
                <SelectTrigger className="bg-muted/50"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="high"><span className="flex items-center gap-2"><ArrowUp className="w-3 h-3 text-rose-500" /> High</span></SelectItem>
                  <SelectItem value="medium"><span className="flex items-center gap-2"><ArrowRight className="w-3 h-3 text-amber-500" /> Medium</span></SelectItem>
                  <SelectItem value="low"><span className="flex items-center gap-2"><ArrowDown className="w-3 h-3 text-blue-500" /> Low</span></SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label className="font-semibold text-muted-foreground">Status</Label>
              <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v as TaskStatus }))}>
                <SelectTrigger className="bg-muted/50"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todo">To Do</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label className="font-semibold text-muted-foreground">Due Date</Label>
              <Input type="date" value={form.due_date} onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))} className="bg-muted/50" />
            </div>
            <div className="grid gap-2">
              <Label className="font-semibold text-muted-foreground">Assign To</Label>
              {assigneeLocked ? (
                <div className="h-10 px-3 flex items-center rounded-md border border-input bg-muted/30 text-sm text-muted-foreground">{memberName(members, editTask?.assigned_to)}</div>
              ) : (
                <Select value={form.assigned_to} onValueChange={v => setForm(p => ({ ...p, assigned_to: v }))}>
                  <SelectTrigger className="bg-muted/50"><SelectValue placeholder="Select member" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Unassigned</SelectItem>
                    {assigneeOptions.map(m => <SelectItem key={m.user_id} value={m.user_id}>{m.full_name || "Unnamed"}{m.user_id === actorId ? " (me)" : ""}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
          {!canAssign && <p className="text-[11px] text-muted-foreground -mt-2">You can assign tasks to yourself. Ask an admin for the "Assign / Unassign Tasks" privilege to assign others.</p>}
          {!fixedCaseId && (
            <div className="grid gap-2">
              <Label className="font-semibold text-muted-foreground">Link to Case</Label>
              <Select value={form.case_id} onValueChange={v => setForm(p => ({ ...p, case_id: v }))}>
                <SelectTrigger className="bg-muted/50"><SelectValue placeholder="Select case (optional)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>No case</SelectItem>
                  {cases.map(c => <SelectItem key={c.id} value={c.id}>{c.case_number} — {c.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <Button onClick={() => save.mutate()} disabled={!form.title.trim() || save.isPending} className="w-full">
          {save.isPending ? "Saving..." : editTask ? "Update Task" : "Create Task"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
