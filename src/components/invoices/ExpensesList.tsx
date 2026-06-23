import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Pencil, Download } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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

const emptyForm = { title: "", amount: "", category: "", description: "", expense_date: "" };

interface Props {
  expenses: any[];
  cases: any[];
}

export function ExpensesList({ expenses, cases }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<any>(emptyForm);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        title: form.title,
        amount: parseFloat(form.amount) || 0,
        category: form.category || null,
        description: form.description || null,
        expense_date: form.expense_date || new Date().toISOString().slice(0, 10),
        case_id: form.case_id || null,
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
      toast.success(editId ? "Expense updated" : "Expense added");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["expenses"] }); toast.success("Deleted"); },
  });

  const closeDialog = () => { setOpen(false); setEditId(null); setForm(emptyForm); };
  const openEdit = (exp: any) => {
    setEditId(exp.id);
    setForm({ title: exp.title, amount: String(exp.amount), category: exp.category || "", description: exp.description || "", expense_date: exp.expense_date || "", case_id: exp.case_id || "" });
    setOpen(true);
  };

  const filtered = expenses.filter(exp =>
    (exp.title || "").toLowerCase().includes(search.toLowerCase()) ||
    (exp.category || "").toLowerCase().includes(search.toLowerCase())
  );

  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const categories = [...new Set(expenses.map(e => e.category).filter(Boolean))];

  const { paginatedItems, currentPage, totalPages, totalItems, startIndex, nextPage, prevPage, goToPage } = usePagination(filtered);

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Total Expenses</p>
          <p className="text-2xl font-bold text-foreground">₹{totalExpenses.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Expense Count</p>
          <p className="text-2xl font-bold text-foreground">{expenses.length}</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Categories</p>
          <p className="text-2xl font-bold text-foreground">{categories.length}</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-center justify-end gap-3 mb-4 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => exportToCSV(filtered.map(exp => ({ title: exp.title, amount: exp.amount, category: exp.category || "", date: exp.expense_date, description: exp.description || "" })), "expenses")}>
            <Download className="w-4 h-4 mr-2" /> Export
          </Button>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search expenses..." className="pl-9 w-56" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Dialog open={open} onOpenChange={v => { if (!v) closeDialog(); else setOpen(true); }}>
            <DialogTrigger asChild>
              <Button onClick={() => { setEditId(null); setForm(emptyForm); }}><Plus className="w-4 h-4 mr-2" /> Add Expense</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editId ? "Edit Expense" : "Add Expense"}</DialogTitle></DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2"><Label>Title *</Label><Input value={form.title} onChange={e => setForm((p: any) => ({ ...p, title: e.target.value }))} /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2"><Label>Amount *</Label><Input type="number" value={form.amount} onChange={e => setForm((p: any) => ({ ...p, amount: e.target.value }))} /></div>
                  <div className="grid gap-2"><Label>Date</Label><Input type="date" value={form.expense_date} onChange={e => setForm((p: any) => ({ ...p, expense_date: e.target.value }))} /></div>
                </div>
                <div className="grid gap-2"><Label>Category</Label><Input value={form.category} onChange={e => setForm((p: any) => ({ ...p, category: e.target.value }))} placeholder="e.g. Court Fee, Travel" /></div>
                <div className="grid gap-2">
                  <Label>Case (optional)</Label>
                  <Select value={form.case_id || ""} onValueChange={v => setForm((p: any) => ({ ...p, case_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select case" /></SelectTrigger>
                    <SelectContent>{cases.map(c => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2"><Label>Description</Label><Input value={form.description} onChange={e => setForm((p: any) => ({ ...p, description: e.target.value }))} /></div>
              </div>
              <Button onClick={() => saveMutation.mutate()} disabled={!form.title || !form.amount || saveMutation.isPending}>
                {saveMutation.isPending ? "Saving..." : editId ? "Update" : "Add Expense"}
              </Button>
            </DialogContent>
          </Dialog>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Title</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Amount</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Category</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Date</th>
                <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Action</th>
              </tr>
            </thead>
            <tbody>
              {paginatedItems.length === 0 ? (
                <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">No expenses found</td></tr>
              ) : paginatedItems.map(exp => (
                <tr key={exp.id} className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors">
                  <td className="py-3 px-4 text-sm font-medium">{exp.title}</td>
                  <td className="py-3 px-4 text-sm text-right font-medium">₹{Number(exp.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                  <td className="py-3 px-4"><Badge variant="outline">{exp.category || "—"}</Badge></td>
                  <td className="py-3 px-4 text-sm">{exp.expense_date ? format(new Date(exp.expense_date), "PP") : "—"}</td>
                  <td className="py-3 px-4 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(exp)}><Pencil className="w-4 h-4 text-primary" /></Button>
                      <DeleteConfirm onConfirm={() => deleteMutation.mutate(exp.id)} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <TablePagination currentPage={currentPage} totalPages={totalPages} totalItems={totalItems} startIndex={startIndex} pageSize={10} onPrev={prevPage} onNext={nextPage} onGoTo={goToPage} />
      </div>
    </div>
  );
}
