import { useState } from "react";
import { useMinLoader } from "@/hooks/useMinLoader";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Pencil, Download, CalendarDays, Filter, Clock, LayoutList, Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isToday } from "date-fns";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { restGetAll, restInsert, restUpdate, restDelete } from "@/lib/restClient";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { usePagination } from "@/hooks/usePagination";
import { TablePagination } from "@/components/TablePagination";
import { DeleteConfirm } from "@/components/DeleteConfirm";
import { exportToCSV } from "@/lib/export";
import { PageLoader } from "@/components/PageLoader";
import { AITextarea } from "@/components/AITextarea";

const emptyForm = { case_id: "", hearing_date: "", court_name: "", judge_name: "", purpose: "", notes: "", status: "scheduled" };
const hearingStatuses = ["all", "scheduled", "completed", "postponed", "cancelled"];

const statusConfig: Record<string, { bg: string, text: string, border: string }> = {
  "scheduled": { bg: "bg-blue-500/10", text: "text-blue-600 dark:text-blue-500", border: "border-blue-500/20" },
  "completed": { bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-500", border: "border-emerald-500/20" },
  "postponed": { bg: "bg-amber-500/10", text: "text-amber-600 dark:text-amber-500", border: "border-amber-500/20" },
  "cancelled": { bg: "bg-rose-500/10", text: "text-rose-600 dark:text-rose-500", border: "border-rose-500/20" }
};

export default function HearingsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [view, setView] = useState<"list" | "calendar">("calendar");
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(new Date()));

  const { data: hearings = [], isLoading } = useQuery({
    queryKey: ["hearings"],
    queryFn: () =>
      // DB columns are `title` and `judge`; alias to the UI's purpose/judge_name
      restGetAll<any>(
        "hearings?select=id,case_id,hearing_date,court_name,purpose:title,judge_name:judge,notes,status,cases(title,case_number)&order=hearing_date.asc",
      ),
  });

  const { data: cases = [] } = useQuery({
    queryKey: ["cases-lookup"],
    queryFn: () => restGetAll<any>("cases?select=id,title,case_number&order=created_at.desc"),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        case_id: form.case_id || null,
        hearing_date: form.hearing_date || new Date().toISOString(),
        court_name: form.court_name || null,
        title: form.purpose || null,
        judge: form.judge_name || null,
        notes: form.notes || null,
        status: form.status,
      };
      if (editId) await restUpdate("hearings", `id=eq.${editId}`, payload);
      else await restInsert("hearings", { ...payload, created_by: user!.id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hearings"] });
      closeDialog();
      toast.success(editId ? "Hearing updated successfully" : "Hearing scheduled successfully");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed to save hearing"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => restDelete("hearings", `id=eq.${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hearings"] });
      toast.success("Hearing deleted");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed to delete hearing"),
  });

  const closeDialog = () => { setOpen(false); setEditId(null); setForm(emptyForm); };
  const openEdit = (h: any) => {
    setEditId(h.id);
    setForm({
      case_id: h.case_id,
      hearing_date: h.hearing_date ? new Date(h.hearing_date).toISOString().slice(0, 16) : "",
      court_name: h.court_name || "",
      judge_name: h.judge_name || "",
      purpose: h.purpose || "",
      notes: h.notes || "",
      status: h.status,
    });
    setOpen(true);
  };

  const filtered = hearings
    .filter(h => (h.purpose || "").toLowerCase().includes(search.toLowerCase()) || (h.court_name || "").toLowerCase().includes(search.toLowerCase()) || ((h as any).cases?.case_number || "").toLowerCase().includes(search.toLowerCase()))
    .filter(h => statusFilter === "all" || h.status === statusFilter);

  const { paginatedItems, currentPage, totalPages, totalItems, startIndex, nextPage, prevPage, goToPage } = usePagination(filtered);

  const showLoader = useMinLoader(isLoading);
  if (showLoader) return <PageLoader />;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <PageHeader title="Hearing Schedule" breadcrumbs={[{ label: "Dashboard", path: "/" }, { label: "Hearings" }]} />
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="flex bg-muted/50 p-1 rounded-md border border-border">
            <button onClick={() => setView("list")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors ${view === "list" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              <LayoutList className="w-4 h-4" /> List
            </button>
            <button onClick={() => setView("calendar")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors ${view === "calendar" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              <CalendarIcon className="w-4 h-4" /> Calendar
            </button>
          </div>
          <Button variant="outline" onClick={() => exportToCSV(filtered.map(h => ({ case: (h as any).cases?.case_number || "", date: h.hearing_date, court: h.court_name || "", judge: h.judge_name || "", purpose: h.purpose || "", status: h.status })), "hearings")} className="bg-background">
            <Download className="w-4 h-4 mr-2" /> Export
          </Button>
          
          <Dialog open={open} onOpenChange={v => { if (!v) closeDialog(); else setOpen(true); }}>
            <DialogTrigger asChild>
              <Button onClick={() => { setEditId(null); setForm(emptyForm); }} className="bg-primary text-primary-foreground shadow-sm hover:shadow-md transition-all">
                <Plus className="w-4 h-4 mr-2" /> Schedule Hearing
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle className="text-xl font-bold">{editId ? "Edit Hearing" : "Schedule New Hearing"}</DialogTitle></DialogHeader>
              <div className="grid gap-4 py-4 px-1 custom-scrollbar">
                <div className="grid gap-2">
                  <Label className="font-semibold text-muted-foreground">Case *</Label>
                  <Select value={form.case_id} onValueChange={v => setForm(p => ({ ...p, case_id: v }))}>
                    <SelectTrigger className="bg-muted/50"><SelectValue placeholder="Select case" /></SelectTrigger>
                    <SelectContent>{cases.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.case_number} — {c.title}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2"><Label className="font-semibold text-muted-foreground">Hearing Date *</Label><Input type="datetime-local" value={form.hearing_date} onChange={e => setForm(p => ({ ...p, hearing_date: e.target.value }))} className="bg-muted/50" /></div>
                  <div className="grid gap-2">
                    <Label className="font-semibold text-muted-foreground">Status</Label>
                    <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v }))}>
                      <SelectTrigger className="bg-muted/50"><SelectValue /></SelectTrigger>
                      <SelectContent>{["scheduled", "completed", "postponed", "cancelled"].map(s => <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2"><Label className="font-semibold text-muted-foreground">Court Name</Label><Input value={form.court_name} onChange={e => setForm(p => ({ ...p, court_name: e.target.value }))} className="bg-muted/50" /></div>
                  <div className="grid gap-2"><Label className="font-semibold text-muted-foreground">Judge Name</Label><Input value={form.judge_name} onChange={e => setForm(p => ({ ...p, judge_name: e.target.value }))} className="bg-muted/50" /></div>
                </div>
                <div className="grid gap-2"><Label className="font-semibold text-muted-foreground">Purpose</Label><Input value={form.purpose} onChange={e => setForm(p => ({ ...p, purpose: e.target.value }))} className="bg-muted/50" /></div>
                <div className="grid gap-2"><Label className="font-semibold text-muted-foreground">Notes</Label><AITextarea rows={3} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} className="bg-muted/50" context="Court hearing notes" /></div>
              </div>
              <Button onClick={() => saveMutation.mutate()} disabled={!form.case_id || !form.hearing_date || saveMutation.isPending} className="w-full">
                {saveMutation.isPending ? "Saving..." : editId ? "Update Details" : "Schedule Hearing"}
              </Button>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {view === "list" ? (
        <div className="bg-card border border-border shadow-sm rounded-xl overflow-hidden animate-in slide-in-from-bottom-2 fade-in duration-300">
          {/* Toolbar */}
          <div className="p-4 border-b border-border bg-muted/10 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search hearings or cases..." className="pl-9 bg-background" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="flex items-center gap-2 bg-background border border-input rounded-md px-3 py-2 text-sm">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground font-medium hidden sm:inline">Status:</span>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-32 h-6 border-0 p-0 focus:ring-0 shadow-none bg-transparent font-semibold"><SelectValue placeholder="Filter status" /></SelectTrigger>
                <SelectContent>{hearingStatuses.map(s => <SelectItem key={s} value={s}>{s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b border-border text-muted-foreground">
              <tr>
                <th className="text-left py-3.5 px-5 font-semibold text-[11px] uppercase tracking-widest">Case & Purpose</th>
                <th className="text-left py-3.5 px-5 font-semibold text-[11px] uppercase tracking-widest">Schedule Date</th>
                <th className="text-left py-3.5 px-5 font-semibold text-[11px] uppercase tracking-widest">Court Details</th>
                <th className="text-left py-3.5 px-5 font-semibold text-[11px] uppercase tracking-widest">Status</th>
                <th className="text-right py-3.5 px-5 font-semibold text-[11px] uppercase tracking-widest">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                        <CalendarDays className="w-8 h-8 text-muted-foreground opacity-50" />
                      </div>
                      <p className="text-base font-semibold text-foreground">No hearings scheduled</p>
                      <p className="text-sm text-muted-foreground mt-1 max-w-sm">There are no hearings matching your current filters. Schedule a new hearing to see it here.</p>
                    </div>
                  </td>
                </tr>
              ) : paginatedItems.map(h => {
                const sConf = statusConfig[h.status] || statusConfig["scheduled"];
                return (
                  <tr key={h.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors group">
                    <td className="py-4 px-5">
                      <div className="flex flex-col gap-1.5">
                        <div className="font-mono font-medium text-foreground bg-muted/50 px-2 py-0.5 rounded inline-block text-xs border border-border/50 w-fit">
                          {(h as any).cases?.case_number || "No Case #"}
                        </div>
                        <span className="font-semibold text-foreground">{h.purpose || "—"}</span>
                      </div>
                    </td>
                    <td className="py-4 px-5">
                      <div className="flex items-start gap-2">
                        <Clock className="w-4 h-4 text-muted-foreground mt-0.5" />
                        <div>
                          <p className="font-semibold text-foreground">{format(new Date(h.hearing_date), "MMM d, yyyy")}</p>
                          <p className="text-xs text-muted-foreground">{format(new Date(h.hearing_date), "h:mm a")}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-5">
                      <p className="text-foreground font-medium">{h.court_name || "—"}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Judge: {h.judge_name || "—"}</p>
                    </td>
                    <td className="py-4 px-5">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider border ${sConf.bg} ${sConf.text} ${sConf.border}`}>
                        {h.status}
                      </span>
                    </td>
                    <td className="py-4 px-5 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(h)} className="h-8 w-8 hover:bg-primary/10 hover:text-primary transition-colors">
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <DeleteConfirm onConfirm={() => deleteMutation.mutate(h.id)} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Footer */}
        {paginatedItems.length > 0 && (
          <div className="border-t border-border p-4 bg-muted/10">
            <TablePagination currentPage={currentPage} totalPages={totalPages} totalItems={totalItems} startIndex={startIndex} pageSize={10} onPrev={prevPage} onNext={nextPage} onGoTo={goToPage} />
          </div>
        )}
      </div>
      ) : (
        <HearingCalendar 
          currentMonth={currentMonth} 
          setCurrentMonth={setCurrentMonth} 
          hearings={filtered} 
          onEdit={openEdit} 
        />
      )}
    </div>
  );
}

function HearingCalendar({ currentMonth, setCurrentMonth, hearings, onEdit }: { currentMonth: Date; setCurrentMonth: (d: Date) => void; hearings: any[]; onEdit: (h: any) => void }) {
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);
  const dateFormat = "d";
  const days = eachDayOfInterval({ start: startDate, end: endDate });

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const goToToday = () => setCurrentMonth(startOfMonth(new Date()));

  return (
    <div className="bg-card border border-border shadow-sm rounded-xl overflow-hidden animate-in slide-in-from-bottom-2 fade-in duration-300">
      <div className="p-4 border-b border-border bg-muted/10 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-bold text-foreground w-40">{format(currentMonth, "MMMM yyyy")}</h2>
          <div className="flex items-center gap-1 bg-background rounded-md border border-input p-0.5">
            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-sm" onClick={prevMonth}><ChevronLeft className="w-4 h-4" /></Button>
            <Button variant="ghost" size="sm" className="h-7 px-3 rounded-sm text-xs font-semibold" onClick={goToToday}>Today</Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-sm" onClick={nextMonth}><ChevronRight className="w-4 h-4" /></Button>
          </div>
        </div>
        <div className="flex gap-3 text-xs font-medium">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span> Scheduled</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Completed</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> Postponed</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span> Cancelled</span>
        </div>
      </div>
      
      <div className="grid grid-cols-7 border-b border-border bg-muted/30">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => (
          <div key={day} className="py-2 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider border-r border-border last:border-r-0">
            {day}
          </div>
        ))}
      </div>
      
      <div className="grid grid-cols-7 auto-rows-fr">
        {days.map((day, i) => {
          const dayHearings = hearings.filter(h => isSameDay(new Date(h.hearing_date), day));
          const isCurrentMonth = isSameMonth(day, monthStart);
          const isTodayDate = isToday(day);

          return (
            <div key={day.toString()} className={`min-h-[120px] p-2 border-r border-b border-border last:border-r-0 ${!isCurrentMonth ? "bg-muted/10 opacity-50" : "bg-card"} ${isTodayDate ? "bg-primary/[0.02]" : ""}`}>
              <div className="flex justify-between items-start mb-1.5">
                <span className={`text-sm font-semibold flex items-center justify-center w-7 h-7 rounded-full ${isTodayDate ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
                  {format(day, dateFormat)}
                </span>
                {dayHearings.length > 0 && (
                  <span className="text-[10px] font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                    {dayHearings.length}
                  </span>
                )}
              </div>
              <div className="space-y-1 mt-2">
                {dayHearings.map(h => {
                  const sConf = statusConfig[h.status] || statusConfig["scheduled"];
                  return (
                    <div 
                      key={h.id} 
                      onClick={() => onEdit(h)}
                      className={`text-[10px] p-1.5 rounded cursor-pointer border hover:shadow-sm transition-all truncate group ${sConf.bg} ${sConf.text} ${sConf.border}`}
                      title={`${h.purpose || "Hearing"} - ${format(new Date(h.hearing_date), "h:mm a")}`}
                    >
                      <span className="font-bold mr-1">{format(new Date(h.hearing_date), "h:mm")}</span>
                      <span className="group-hover:underline">{h.purpose || "Hearing"}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
