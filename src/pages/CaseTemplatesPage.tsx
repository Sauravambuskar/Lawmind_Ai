import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Pencil, Trash2, ListChecks, FileBox } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { AITextarea } from "@/components/AITextarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { DeleteConfirm } from "@/components/DeleteConfirm";
import { PageLoader } from "@/components/PageLoader";
import { useMinLoader } from "@/hooks/useMinLoader";

const emptyTemplate = { name: "", description: "", category: "" };
const emptyTask = { title: "", description: "", days_offset: "0", priority: "medium" };

export default function CaseTemplatesPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  
  const [templateOpen, setTemplateOpen] = useState(false);
  const [editTemplateId, setEditTemplateId] = useState<string | null>(null);
  const [templateForm, setTemplateForm] = useState(emptyTemplate);

  const [activeTemplate, setActiveTemplate] = useState<any>(null);
  const [taskOpen, setTaskOpen] = useState(false);
  const [editTaskId, setEditTaskId] = useState<string | null>(null);
  const [taskForm, setTaskForm] = useState(emptyTask);

  const { data: templates = [], isLoading: loadingTemplates } = useQuery({
    queryKey: ["case_templates"],
    queryFn: async () => {
      const { data, error } = await supabase.from("case_templates").select("*").order("name", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const { data: tasks = [], isLoading: loadingTasks } = useQuery({
    queryKey: ["case_template_tasks", activeTemplate?.id],
    queryFn: async () => {
      if (!activeTemplate?.id) return [];
      const { data, error } = await supabase.from("case_template_tasks").select("*").eq("template_id", activeTemplate.id).order("days_offset", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!activeTemplate,
  });

  const saveTemplateMutation = useMutation({
    mutationFn: async () => {
      if (editTemplateId) {
        const { error } = await supabase.from("case_templates").update(templateForm).eq("id", editTemplateId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("case_templates").insert({ ...templateForm, user_id: user!.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["case_templates"] });
      setTemplateOpen(false);
      toast.success(editTemplateId ? "Template updated" : "Template created");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("case_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["case_templates"] });
      toast.success("Template deleted");
      if (activeTemplate?.id === editTemplateId) setActiveTemplate(null);
    },
  });

  const saveTaskMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        template_id: activeTemplate.id,
        title: taskForm.title,
        description: taskForm.description,
        days_offset: parseInt(taskForm.days_offset) || 0,
        priority: taskForm.priority,
      };
      if (editTaskId) {
        const { error } = await supabase.from("case_template_tasks").update(payload).eq("id", editTaskId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("case_template_tasks").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["case_template_tasks", activeTemplate.id] });
      setTaskOpen(false);
      toast.success(editTaskId ? "Task updated" : "Task added");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("case_template_tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["case_template_tasks", activeTemplate.id] });
      toast.success("Task deleted");
    },
  });

  const openEditTemplate = (t: any) => {
    setEditTemplateId(t.id);
    setTemplateForm({ name: t.name, description: t.description || "", category: t.category || "" });
    setTemplateOpen(true);
  };

  const openEditTask = (t: any) => {
    setEditTaskId(t.id);
    setTaskForm({ title: t.title, description: t.description || "", days_offset: String(t.days_offset), priority: t.priority });
    setTaskOpen(true);
  };

  const filteredTemplates = templates.filter(t => t.name.toLowerCase().includes(search.toLowerCase()) || (t.category || "").toLowerCase().includes(search.toLowerCase()));

  const showLoader = useMinLoader(loadingTemplates);
  if (showLoader) return <PageLoader />;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader title="Case Templates" breadcrumbs={[{ label: "Setup", path: "/setup/matters" }, { label: "Case Templates" }]} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Templates List */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-card border border-border shadow-sm rounded-xl overflow-hidden">
            <div className="p-4 border-b border-border bg-muted/10 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-foreground flex items-center gap-2"><FileBox className="w-4 h-4 text-primary" /> Templates</h2>
                <Button size="sm" onClick={() => { setEditTemplateId(null); setTemplateForm(emptyTemplate); setTemplateOpen(true); }}>
                  <Plus className="w-3.5 h-3.5 mr-1" /> New
                </Button>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Search templates..." className="pl-9 bg-background h-9 text-sm" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
            </div>
            
            <div className="max-h-[600px] overflow-y-auto">
              {filteredTemplates.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm">No templates found.</div>
              ) : (
                <div className="divide-y divide-border">
                  {filteredTemplates.map(t => (
                    <div 
                      key={t.id} 
                      className={`p-4 cursor-pointer transition-colors group ${activeTemplate?.id === t.id ? "bg-primary/5 border-l-2 border-l-primary" : "hover:bg-muted/50 border-l-2 border-l-transparent"}`}
                      onClick={() => setActiveTemplate(t)}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold text-foreground text-sm">{t.name}</h3>
                          {t.category && <p className="text-xs text-muted-foreground mt-0.5">{t.category}</p>}
                        </div>
                        <div className="flex opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary" onClick={(e) => { e.stopPropagation(); openEditTemplate(t); }}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <div onClick={e => e.stopPropagation()}>
                            <DeleteConfirm onConfirm={() => deleteTemplateMutation.mutate(t.id)} />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Template Tasks / Details */}
        <div className="lg:col-span-2">
          {!activeTemplate ? (
            <div className="bg-card border border-border shadow-sm rounded-xl p-12 text-center text-muted-foreground h-full flex flex-col items-center justify-center">
              <FileBox className="w-12 h-12 mb-4 opacity-20" />
              <h2 className="text-lg font-semibold text-foreground mb-2">No Template Selected</h2>
              <p className="text-sm max-w-sm mx-auto">Select a case template from the sidebar to view and manage its predefined workflow tasks.</p>
            </div>
          ) : (
            <div className="bg-card border border-border shadow-sm rounded-xl overflow-hidden flex flex-col h-full">
              <div className="p-5 border-b border-border bg-muted/5 flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold text-foreground">{activeTemplate.name}</h2>
                  <p className="text-sm text-muted-foreground mt-1">{activeTemplate.description || "No description provided."}</p>
                </div>
                <Button size="sm" onClick={() => { setEditTaskId(null); setTaskForm(emptyTask); setTaskOpen(true); }}>
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add Task
                </Button>
              </div>

              <div className="p-0 flex-1 overflow-y-auto">
                {loadingTasks ? (
                  <div className="p-8 flex justify-center"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div></div>
                ) : tasks.length === 0 ? (
                  <div className="p-12 text-center">
                    <ListChecks className="w-12 h-12 text-muted-foreground opacity-20 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-foreground">No workflow tasks</h3>
                    <p className="text-sm text-muted-foreground mt-1 mb-4">This template currently has no tasks assigned.</p>
                    <Button variant="outline" onClick={() => { setEditTaskId(null); setTaskForm(emptyTask); setTaskOpen(true); }}>Create the first task</Button>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {tasks.map(t => (
                      <div key={t.id} className="p-5 hover:bg-muted/20 transition-colors group flex gap-4">
                        <div className="mt-1 w-12 shrink-0 flex flex-col items-center">
                          <div className="bg-muted px-2 py-1 rounded text-xs font-bold text-muted-foreground border border-border">
                            Day {t.days_offset}
                          </div>
                          <div className="w-px h-full bg-border mt-2 mb-[-1.25rem] group-last:hidden"></div>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="font-semibold text-foreground text-sm">{t.title}</h4>
                              {t.description && <p className="text-sm text-muted-foreground mt-1">{t.description}</p>}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                                t.priority === "urgent" ? "bg-rose-500/10 text-rose-600 border-rose-500/20" :
                                t.priority === "high" ? "bg-amber-500/10 text-amber-600 border-amber-500/20" :
                                t.priority === "low" ? "bg-slate-500/10 text-slate-600 border-slate-500/20" :
                                "bg-blue-500/10 text-blue-600 border-blue-500/20"
                              }`}>{t.priority}</span>
                              <div className="flex opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary" onClick={() => openEditTask(t)}>
                                  <Pencil className="w-3.5 h-3.5" />
                                </Button>
                                <DeleteConfirm onConfirm={() => deleteTaskMutation.mutate(t.id)} />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Template Dialog */}
      <Dialog open={templateOpen} onOpenChange={setTemplateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editTemplateId ? "Edit Template" : "New Template"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid gap-2"><Label>Template Name *</Label><Input value={templateForm.name} onChange={e => setTemplateForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Divorce Proceeding" /></div>
            <div className="grid gap-2"><Label>Category</Label><Input value={templateForm.category} onChange={e => setTemplateForm(p => ({ ...p, category: e.target.value }))} placeholder="e.g. Family Law" /></div>
            <div className="grid gap-2"><Label>Description</Label><AITextarea value={templateForm.description} onChange={e => setTemplateForm(p => ({ ...p, description: e.target.value }))} rows={3} context="Legal case template description" /></div>
          </div>
          <Button onClick={() => saveTemplateMutation.mutate()} disabled={!templateForm.name || saveTemplateMutation.isPending} className="w-full">
            {saveTemplateMutation.isPending ? "Saving..." : "Save Template"}
          </Button>
        </DialogContent>
      </Dialog>

      {/* Task Dialog */}
      <Dialog open={taskOpen} onOpenChange={setTaskOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editTaskId ? "Edit Task" : "Add Task to Template"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid gap-2"><Label>Task Title *</Label><Input value={taskForm.title} onChange={e => setTaskForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g. File Initial Petition" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Days Offset</Label>
                <div className="flex gap-2 items-center">
                  <Input type="number" value={taskForm.days_offset} onChange={e => setTaskForm(p => ({ ...p, days_offset: e.target.value }))} />
                  <span className="text-xs text-muted-foreground whitespace-nowrap">days from start</span>
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Priority</Label>
                <Select value={taskForm.priority} onValueChange={v => setTaskForm(p => ({ ...p, priority: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2"><Label>Description</Label><AITextarea value={taskForm.description} onChange={e => setTaskForm(p => ({ ...p, description: e.target.value }))} rows={3} context="Legal task description in case template" /></div>
          </div>
          <Button onClick={() => saveTaskMutation.mutate()} disabled={!taskForm.title || saveTaskMutation.isPending} className="w-full">
            {saveTaskMutation.isPending ? "Saving..." : "Save Task"}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
