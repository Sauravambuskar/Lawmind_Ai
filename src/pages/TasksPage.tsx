import { useState } from "react";
import { useMinLoader } from "@/hooks/useMinLoader";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus, Search, Pencil, Download, CheckCircle2, Circle, Clock,
  AlertTriangle, ArrowUp, ArrowRight, ArrowDown, Filter, ListTodo,
  CalendarDays, BriefcaseBusiness, User,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AITextarea } from "@/components/AITextarea";
import { restGetAll, restInsert, restUpdate, restDelete } from "@/lib/restClient";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { usePagination } from "@/hooks/usePagination";
import { TablePagination } from "@/components/TablePagination";
import { DeleteConfirm } from "@/components/DeleteConfirm";
import { exportToCSV } from "@/lib/export";
import { PageLoader } from "@/components/PageLoader";

type TaskStatus = "todo" | "in_progress" | "done";
type TaskPriority = "high" | "medium" | "low";

interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  case_id: string | null;
  assigned_to: string | null;
  created_by: string | null;
  user_id: string;
  completed_at: string | null;
  created_at: string;
  cases?: { title: string; case_number: string } | null;
  profiles?: { full_name: string | null } | null;
}

const emptyForm = {
  title: "", description: "", status: "todo" as TaskStatus, priority: "medium" as TaskPriority,
  due_date: "", case_id: "", assigned_to: "",
};

const STATUS_CONFIG: Record<TaskStatus, { label: string; icon: typeof Circle; bg: string; text: string; border: string }> = {
  todo:        { label: "To Do",       icon: Circle,       bg: "bg-slate-500/10",   text: "text-slate-500",    border: "border-slate-500/20" },
  in_progress: { label: "In Progress", icon: Clock,        bg: "bg-amber-500/10",   text: "text-amber-600",    border: "border-amber-500/20" },
  done:        { label: "Done",        icon: CheckCircle2, bg: "bg-emerald-500/10", text: "text-emerald-600",  border: "border-emerald-500/20" },
};

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; icon: typeof ArrowUp; color: string }> = {
  high:   { label: "High",   icon: ArrowUp,    color: "text-rose-500" },
  medium: { label: "Medium", icon: ArrowRight, color: "text-amber-500" },
  low:    { label: "Low",    icon: ArrowDown,  color: "text-blue-500" },
};

export default function TasksPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | TaskStatus>("all");
  const [priorityFilter, setPriorityFilter] = useState<"all" | TaskPriority>("all");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  // Fetch tasks with joined case + assignee profile
  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["tasks"],
    queryFn: () => restGetAll<TaskRow>("tasks?select=*,cases(title,case_number)&order=created_at.desc"),
  });

  // Fetch team members for assignment dropdown
  const { data: teamMembers = [] } = useQuery({
    queryKey: ["team-members"],
    queryFn: () =>
      restGetAll<{ user_id: string; full_name: string | null; role: string }>(
        "profiles?select=user_id,full_name,role&status=eq.active&order=full_name.asc",
      ),
  });

  // Fetch cases for linking
  const { data: cases = [] } = useQuery({
    queryKey: ["cases-lookup"],
    queryFn: () => restGetAll<any>("cases?select=id,title,case_number&order=created_at.desc"),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        title: form.title,
        description: form.description || null,
        status: form.status,
        priority: form.priority,
        due_date: form.due_date || null,
        case_id: form.case_id || null,
        assigned_to: form.assigned_to || null,
      };
      if (editId) await restUpdate("tasks", `id=eq.${editId}`, payload);
      else await restInsert("tasks", { ...payload, created_by: user!.id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      closeDialog();
      toast.success(editId ? "Task updated" : "Task created");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed to save task"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => restDelete("tasks", `id=eq.${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Task deleted");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed to delete task"),
  });

  const quickStatusChange = useMutation({
    mutationFn: ({ id, status }: { id: string; status: TaskStatus }) =>
      restUpdate("tasks", `id=eq.${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed to update status"),
  });

  const closeDialog = () => { setOpen(false); setEditId(null); setForm(emptyForm); };
  const openEdit = (t: TaskRow) => {
    setEditId(t.id);
    setForm({
      title: t.title,
      description: t.description || "",
      status: t.status,
      priority: t.priority,
      due_date: t.due_date || "",
      case_id: t.case_id || "",
      assigned_to: t.assigned_to || "",
    });
    setOpen(true);
  };

  // Filtering
  const filtered = tasks.filter(t => {
    if (statusFilter !== "all" && t.status !== statusFilter) return false;
    if (priorityFilter !== "all" && t.priority !== priorityFilter) return false;
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // Stats
  const todoCount = tasks.filter(t => t.status === "todo").length;
  const progressCount = tasks.filter(t => t.status === "in_progress").length;
  const doneCount = tasks.filter(t => t.status === "done").length;
  const overdueCount = tasks.filter(t => {
    if (!t.due_date || t.status === "done") return false;
    return new Date(t.due_date) < new Date(new Date().toISOString().split("T")[0]);
  }).length;

  const { paginatedItems, currentPage, totalPages, totalItems, startIndex, nextPage, prevPage, goToPage } = usePagination(filtered);
  const showLoader = useMinLoader(isLoading);
  if (showLoader) return <PageLoader />;

  const getAssigneeName = (userId: string | null) => {
    if (!userId) return null;
    const member = teamMembers.find(m => m.user_id === userId);
    return member?.full_name || "Unknown";
  };

  const isOverdue = (t: TaskRow) => {
    if (!t.due_date || t.status === "done") return false;
    return new Date(t.due_date) < new Date(new Date().toISOString().split("T")[0]);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <PageHeader title="Task Management" breadcrumbs={[{ label: "Dashboard", path: "/" }, { label: "Tasks" }]} />
        <div className="flex gap-2 w-full sm:w-auto">
          <Button variant="outline" onClick={() => exportToCSV(filtered.map(t => ({
            title: t.title, status: t.status, priority: t.priority,
            due_date: t.due_date || "", case: t.cases?.case_number || "",
            assignee: getAssigneeName(t.assigned_to) || "",
          })), "tasks")} className="bg-background">
            <Download className="w-4 h-4 mr-2" /> Export
          </Button>
          <Dialog open={open} onOpenChange={v => { if (!v) closeDialog(); else setOpen(true); }}>
            <DialogTrigger asChild>
              <Button onClick={() => { setEditId(null); setForm(emptyForm); }} className="bg-primary text-primary-foreground shadow-sm hover:shadow-md transition-all">
                <Plus className="w-4 h-4 mr-2" /> New Task
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle className="text-xl font-bold">{editId ? "Edit Task" : "Create New Task"}</DialogTitle></DialogHeader>
              <div className="grid gap-4 py-4 px-1 custom-scrollbar">
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
                    <Select value={form.assigned_to} onValueChange={v => setForm(p => ({ ...p, assigned_to: v }))}>
                      <SelectTrigger className="bg-muted/50"><SelectValue placeholder="Select member" /></SelectTrigger>
                      <SelectContent>
                        {teamMembers.map(m => <SelectItem key={m.user_id} value={m.user_id}>{m.full_name || "Unnamed"}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label className="font-semibold text-muted-foreground">Link to Case</Label>
                  <Select value={form.case_id} onValueChange={v => setForm(p => ({ ...p, case_id: v }))}>
                    <SelectTrigger className="bg-muted/50"><SelectValue placeholder="Select case (optional)" /></SelectTrigger>
                    <SelectContent>
                      {cases.map(c => <SelectItem key={c.id} value={c.id}>{c.case_number} — {c.title}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={() => saveMutation.mutate()} disabled={!form.title || saveMutation.isPending} className="w-full">
                {saveMutation.isPending ? "Saving..." : editId ? "Update Task" : "Create Task"}
              </Button>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-card border border-border shadow-sm rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-slate-500/10 flex items-center justify-center border border-slate-500/20">
            <Circle className="w-5 h-5 text-slate-500" />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">To Do</p>
            <p className="text-xl font-bold text-foreground">{todoCount}</p>
          </div>
        </div>
        <div className="bg-card border border-border shadow-sm rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
            <Clock className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">In Progress</p>
            <p className="text-xl font-bold text-foreground">{progressCount}</p>
          </div>
        </div>
        <div className="bg-card border border-border shadow-sm rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Completed</p>
            <p className="text-xl font-bold text-foreground">{doneCount}</p>
          </div>
        </div>
        <div className="bg-card border border-border shadow-sm rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-rose-500/10 flex items-center justify-center border border-rose-500/20">
            <AlertTriangle className="w-5 h-5 text-rose-500" />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Overdue</p>
            <p className="text-xl font-bold text-foreground">{overdueCount}</p>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border shadow-sm rounded-xl overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 border-b border-border bg-muted/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search tasks..." className="pl-9 bg-background" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-muted-foreground" />
              <Select value={statusFilter} onValueChange={v => setStatusFilter(v as any)}>
                <SelectTrigger className="h-8 text-xs w-32 bg-background"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="todo">To Do</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Select value={priorityFilter} onValueChange={v => setPriorityFilter(v as any)}>
              <SelectTrigger className="h-8 text-xs w-28 bg-background"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priority</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground font-medium ml-2">
              {totalItems} tasks
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b border-border text-muted-foreground">
              <tr>
                <th className="text-left py-3.5 px-5 font-semibold text-[11px] uppercase tracking-widest w-12">#</th>
                <th className="text-left py-3.5 px-5 font-semibold text-[11px] uppercase tracking-widest w-10"></th>
                <th className="text-left py-3.5 px-5 font-semibold text-[11px] uppercase tracking-widest">Task</th>
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
                  <td colSpan={8} className="py-16 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                        <ListTodo className="w-8 h-8 text-muted-foreground opacity-50" />
                      </div>
                      <p className="text-base font-semibold text-foreground">No tasks found</p>
                      <p className="text-sm text-muted-foreground mt-1 max-w-sm">Create your first task to start tracking your work.</p>
                    </div>
                  </td>
                </tr>
              ) : paginatedItems.map((t, i) => {
                const statusCfg = STATUS_CONFIG[t.status];
                const priorityCfg = PRIORITY_CONFIG[t.priority];
                const StatusIcon = statusCfg.icon;
                const PriorityIcon = priorityCfg.icon;
                const overdue = isOverdue(t);

                return (
                  <tr key={t.id} className={`border-b border-border last:border-0 hover:bg-muted/30 transition-colors group ${t.status === "done" ? "opacity-60" : ""}`}>
                    <td className="py-4 px-5 text-muted-foreground font-mono">{startIndex + i + 1}</td>
                    <td className="py-4 px-2">
                      {/* Quick-toggle status */}
                      <button
                        onClick={() => {
                          const next: TaskStatus = t.status === "todo" ? "in_progress" : t.status === "in_progress" ? "done" : "todo";
                          quickStatusChange.mutate({ id: t.id, status: next });
                        }}
                        className="p-1 rounded-md hover:bg-muted transition-colors"
                        title={`Click to change from ${statusCfg.label}`}
                      >
                        <StatusIcon className={`w-5 h-5 ${statusCfg.text}`} />
                      </button>
                    </td>
                    <td className="py-4 px-5">
                      <div className={`font-semibold ${t.status === "done" ? "line-through text-muted-foreground" : "text-foreground"}`}>{t.title}</div>
                      {t.description && <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1 max-w-[250px]">{t.description}</div>}
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider mt-1 border ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}`}>
                        {statusCfg.label}
                      </span>
                    </td>
                    <td className="py-4 px-5">
                      <span className="flex items-center gap-1.5">
                        <PriorityIcon className={`w-3.5 h-3.5 ${priorityCfg.color}`} />
                        <span className={`text-xs font-semibold ${priorityCfg.color}`}>{priorityCfg.label}</span>
                      </span>
                    </td>
                    <td className="py-4 px-5">
                      {t.due_date ? (
                        <span className={`flex items-center gap-1.5 text-xs font-medium ${overdue ? "text-rose-500" : "text-muted-foreground"}`}>
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
                        <span className="font-mono font-medium text-foreground bg-muted/50 px-2 py-0.5 rounded text-xs border border-border/50">
                          {t.cases.case_number}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">Unlinked</span>
                      )}
                    </td>
                    <td className="py-4 px-5">
                      {t.assigned_to ? (
                        <span className="flex items-center gap-1.5 text-xs">
                          <User className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="font-medium text-foreground">{getAssigneeName(t.assigned_to)}</span>
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">Unassigned</span>
                      )}
                    </td>
                    <td className="py-4 px-5 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(t)} className="h-8 w-8 hover:bg-primary/10 hover:text-primary transition-colors">
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <DeleteConfirm onConfirm={() => deleteMutation.mutate(t.id)} />
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
    </div>
  );
}
