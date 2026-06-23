import { useState } from "react";
import { useMinLoader } from "@/hooks/useMinLoader";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Pencil, Download, Wallet, CreditCard, PieChart, Receipt } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { usePagination } from "@/hooks/usePagination";
import { TablePagination } from "@/components/TablePagination";
import { DeleteConfirm } from "@/components/DeleteConfirm";
import { exportToCSV } from "@/lib/export";
import { FileUpload } from "@/components/FileUpload";
import { PageLoader } from "@/components/PageLoader";

const emptyForm = { title: "", description: "", amount: "", category: "", case_id: "", expense_date: "", receipt_url: "" };

export default function ExpensesPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ["expenses"],
    queryFn: async () => {
      const { data, error } = await supabase.from("expenses").select("*, cases(title, case_number)").order("expense_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: cases = [] } = useQuery({ queryKey: ["cases"], queryFn: async () => { const { data } = await supabase.from("cases").select("id, title, case_number"); return data || []; } });

  const { data: expenseTypes = [] } = useQuery({
    queryKey: ["expense_types"],
    queryFn: async () => {
      const { data } = await supabase.from("expense_types").select("id, name").order("name");
      return data || [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        title: form.title, description: form.description,
        amount: parseFloat(form.amount) || 0, category: form.category,
        case_id: form.case_id || null, receipt_url: form.receipt_url || null,
        expense_date: form.expense_date || new Date().toISOString().split("T")[0],
      };
      if (editId) {
        const { error } = await supabase.from("expenses").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("expenses").insert({ ...payload, user_id: user!.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      closeDialog();
      toast.success(editId ? "Expense updated successfully" : "Expense added successfully");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("expenses").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["expenses"] }); toast.success("Expense deleted"); },
  });

  const closeDialog = () => { setOpen(false); setEditId(null); setForm(emptyForm); };
  const openEdit = (e: any) => {
    setEditId(e.id);
    setForm({ title: e.title, description: e.description || "", amount: String(e.amount), category: e.category || "", case_id: e.case_id || "", expense_date: e.expense_date || "", receipt_url: e.receipt_url || "" });
    setOpen(true);
  };

  const filtered = expenses.filter(e => (e.title || "").toLowerCase().includes(search.toLowerCase()) || (e.category || "").toLowerCase().includes(search.toLowerCase()));
  const totalExpenses = filtered.reduce((sum, e) => sum + Number(e.amount), 0);
  const { paginatedItems, currentPage, totalPages, totalItems, startIndex, nextPage, prevPage, goToPage } = usePagination(filtered);

  const showLoader = useMinLoader(isLoading);
  if (showLoader) return <PageLoader />;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <PageHeader title="Expense Tracking" breadcrumbs={[{ label: "Dashboard", path: "/" }, { label: "Expenses" }]} />
        <div className="flex gap-2 w-full sm:w-auto">
          <Button variant="outline" onClick={() => exportToCSV(filtered.map(e => ({ title: e.title, category: e.category || "", amount: e.amount, date: e.expense_date, case: (e as any).cases?.case_number || "" })), "expenses")} className="bg-background">
            <Download className="w-4 h-4 mr-2" /> Export
          </Button>
          <Dialog open={open} onOpenChange={v => { if (!v) closeDialog(); else setOpen(true); }}>
            <DialogTrigger asChild>
              <Button onClick={() => { setEditId(null); setForm(emptyForm); }} className="bg-primary text-primary-foreground shadow-sm hover:shadow-md transition-all">
                <Plus className="w-4 h-4 mr-2" /> Log Expense
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle className="text-xl font-bold">{editId ? "Edit Expense" : "Log New Expense"}</DialogTitle></DialogHeader>
              <div className="grid gap-4 py-4 px-1 custom-scrollbar">
                <div className="grid gap-2"><Label className="font-semibold text-muted-foreground">Title *</Label><Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} className="bg-muted/50" /></div>
                <div className="grid gap-2"><Label className="font-semibold text-muted-foreground">Description</Label><Input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} className="bg-muted/50" /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2"><Label className="font-semibold text-muted-foreground">Amount *</Label><Input type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} className="bg-muted/50" /></div>
                  <div className="grid gap-2"><Label className="font-semibold text-muted-foreground">Date</Label><Input type="date" value={form.expense_date} onChange={e => setForm(p => ({ ...p, expense_date: e.target.value }))} className="bg-muted/50" /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label className="font-semibold text-muted-foreground">Category</Label>
                    {expenseTypes.length > 0 ? (
                      <Select value={form.category} onValueChange={v => setForm(p => ({ ...p, category: v }))}>
                        <SelectTrigger className="bg-muted/50"><SelectValue placeholder="Select category" /></SelectTrigger>
                        <SelectContent>
                          {expenseTypes.map(et => <SelectItem key={et.id} value={et.name}>{et.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} placeholder="e.g. Travel, Filing" className="bg-muted/50" />
                    )}
                  </div>
                  <div className="grid gap-2">
                    <Label className="font-semibold text-muted-foreground">Case</Label>
                    <Select value={form.case_id} onValueChange={v => setForm(p => ({ ...p, case_id: v }))}>
                      <SelectTrigger className="bg-muted/50"><SelectValue placeholder="Select case" /></SelectTrigger>
                      <SelectContent>{cases.map(c => <SelectItem key={c.id} value={c.id}>{c.case_number}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-2"><Label className="font-semibold text-muted-foreground">Receipt Attachment</Label><FileUpload value={form.receipt_url} onChange={url => setForm(p => ({ ...p, receipt_url: url }))} folder="receipts" /></div>
              </div>
              <Button onClick={() => saveMutation.mutate()} disabled={!form.title || !form.amount || saveMutation.isPending} className="w-full">
                {saveMutation.isPending ? "Saving..." : editId ? "Update Expense" : "Save Expense"}
              </Button>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card border border-border shadow-sm rounded-xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0 border border-emerald-500/20">
            <Wallet className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Total Expenses</p>
            <p className="text-2xl font-bold text-foreground">₹{totalExpenses.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
        </div>
        <div className="bg-card border border-border shadow-sm rounded-xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0 border border-blue-500/20">
            <Receipt className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Total Records</p>
            <p className="text-2xl font-bold text-foreground">{filtered.length}</p>
          </div>
        </div>
        <div className="bg-card border border-border shadow-sm rounded-xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center shrink-0 border border-purple-500/20">
            <PieChart className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Average Expense</p>
            <p className="text-2xl font-bold text-foreground">₹{filtered.length ? (totalExpenses / filtered.length).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"}</p>
          </div>
        </div>
      </div>

      <div className="bg-card border border-border shadow-sm rounded-xl overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 border-b border-border bg-muted/10 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search expenses by title or category..." className="pl-9 bg-background" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b border-border text-muted-foreground">
              <tr>
                <th className="text-left py-3.5 px-5 font-semibold text-[11px] uppercase tracking-widest w-12">#</th>
                <th className="text-left py-3.5 px-5 font-semibold text-[11px] uppercase tracking-widest">Expense Details</th>
                <th className="text-left py-3.5 px-5 font-semibold text-[11px] uppercase tracking-widest">Category</th>
                <th className="text-left py-3.5 px-5 font-semibold text-[11px] uppercase tracking-widest">Case Link</th>
                <th className="text-right py-3.5 px-5 font-semibold text-[11px] uppercase tracking-widest">Amount</th>
                <th className="text-left py-3.5 px-5 font-semibold text-[11px] uppercase tracking-widest">Date</th>
                <th className="text-right py-3.5 px-5 font-semibold text-[11px] uppercase tracking-widest">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                        <CreditCard className="w-8 h-8 text-muted-foreground opacity-50" />
                      </div>
                      <p className="text-base font-semibold text-foreground">No expenses recorded</p>
                      <p className="text-sm text-muted-foreground mt-1 max-w-sm">Keep track of your case-related and operational expenses here.</p>
                    </div>
                  </td>
                </tr>
              ) : paginatedItems.map((e, i) => (
                <tr key={e.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors group">
                  <td className="py-4 px-5 text-muted-foreground font-mono">{startIndex + i + 1}</td>
                  <td className="py-4 px-5">
                    <div className="font-semibold text-foreground">{e.title}</div>
                    {e.description && <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1 max-w-[200px]">{e.description}</div>}
                  </td>
                  <td className="py-4 px-5">
                    <span className="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border bg-muted text-muted-foreground border-border/50">
                      {e.category || "Uncategorized"}
                    </span>
                  </td>
                  <td className="py-4 px-5">
                    {e.case_id ? (
                      <span className="font-mono font-medium text-foreground bg-muted/50 px-2 py-0.5 rounded text-xs border border-border/50">
                        {(e as any).cases?.case_number || "Unknown Case"}
                      </span>
                    ) : (
                      <span className="text-muted-foreground italic text-xs">Unlinked</span>
                    )}
                  </td>
                  <td className="py-4 px-5 text-right">
                    <span className="font-bold text-foreground">₹{Number(e.amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </td>
                  <td className="py-4 px-5 text-muted-foreground font-medium">
                    {e.expense_date ? new Date(e.expense_date).toLocaleDateString() : "—"}
                  </td>
                  <td className="py-4 px-5 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                      {e.receipt_url && (
                        <a href={e.receipt_url} target="_blank" rel="noopener noreferrer">
                          <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-blue-500/10 hover:text-blue-500 transition-colors" title="View Receipt">
                            <Receipt className="w-4 h-4" />
                          </Button>
                        </a>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => openEdit(e)} className="h-8 w-8 hover:bg-primary/10 hover:text-primary transition-colors">
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <DeleteConfirm onConfirm={() => deleteMutation.mutate(e.id)} />
                    </div>
                  </td>
                </tr>
              ))}
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
    </div>
  );
}
