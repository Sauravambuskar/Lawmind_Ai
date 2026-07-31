import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Pencil, Download, FileDown, ReceiptText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { restInsert, restUpdate, restDelete } from "@/lib/restClient";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { usePagination } from "@/hooks/usePagination";
import { TablePagination } from "@/components/TablePagination";
import { DeleteConfirm } from "@/components/DeleteConfirm";
import { exportToCSV } from "@/lib/export";
import { downloadInvoicePdf } from "@/lib/invoicePdf";

const emptyForm = { invoice_number: "", amount: "", tax: "", client_id: "", case_id: "", due_date: "", notes: "", status: "draft" };
const invoiceStatuses = ["all", "draft", "sent", "partial", "paid", "overdue", "cancelled"];

interface Props {
  invoices: any[];
  clients: any[];
  cases: any[];
  payments: any[];
}

export function InvoiceList({ invoices, clients, cases, payments }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const amount = parseFloat(form.amount) || 0;
      const tax = parseFloat(form.tax) || 0;
      // DB columns are tax_amount / total_amount, and the owner column is created_by
      const payload = {
        invoice_number: form.invoice_number,
        amount,
        tax_amount: tax,
        total_amount: amount + tax,
        client_id: form.client_id || null,
        case_id: form.case_id || null,
        due_date: form.due_date || null,
        notes: form.notes,
        status: form.status,
      };
      if (editId) await restUpdate("invoices", `id=eq.${editId}`, payload);
      else await restInsert("invoices", { ...payload, created_by: user!.id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      closeDialog();
      toast.success(editId ? "Invoice updated" : "Invoice created");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed to save invoice"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => restDelete("invoices", `id=eq.${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["invoices"] }); toast.success("Deleted"); },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed to delete invoice"),
  });

  const closeDialog = () => { setOpen(false); setEditId(null); setForm(emptyForm); };
  const openEdit = (inv: any) => {
    setEditId(inv.id);
    setForm({ invoice_number: inv.invoice_number, amount: String(inv.amount ?? ""), tax: String(inv.tax_amount ?? "0"), client_id: inv.client_id || "", case_id: inv.case_id || "", due_date: inv.due_date || "", notes: inv.notes || "", status: inv.status });
    setOpen(true);
  };

  const filtered = invoices
    .filter(inv => inv.invoice_number.toLowerCase().includes(search.toLowerCase()) || ((inv as any).clients?.name || "").toLowerCase().includes(search.toLowerCase()))
    .filter(inv => statusFilter === "all" || inv.status === statusFilter);
  
  const statusColor = (s: string) => s === "paid" ? "default" : s === "sent" ? "secondary" : s === "partial" ? "outline" : s === "overdue" ? "destructive" : "outline";
  const { paginatedItems, currentPage, totalPages, totalItems, startIndex, nextPage, prevPage, goToPage } = usePagination(filtered);

  return (
    <div className="bg-card border border-border shadow-sm rounded-xl overflow-hidden animate-in fade-in duration-500">
      {/* Header Toolbar */}
      <div className="p-5 border-b border-border bg-muted/10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 rounded-xl">
            <ReceiptText className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">Invoice Directory</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Manage and track all issued invoices.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36 h-9 shadow-sm bg-background">
              <SelectValue placeholder="Filter status" />
            </SelectTrigger>
            <SelectContent>
              {invoiceStatuses.map(s => <SelectItem key={s} value={s}>{s === "all" ? "All Statuses" : s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>)}
            </SelectContent>
          </Select>
          
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search..." className="pl-9 w-full sm:w-64 h-9 bg-background shadow-sm" value={search} onChange={e => setSearch(e.target.value)} />
          </div>

          <Button variant="outline" size="sm" className="h-9" onClick={() => exportToCSV(filtered.map(inv => ({ invoice_number: inv.invoice_number, client: (inv as any).clients?.name || "", amount: inv.amount, tax: inv.tax_amount, total: inv.total_amount, status: inv.status, due_date: inv.due_date || "" })), "invoices")}>
            <Download className="w-4 h-4 mr-2" /> Export
          </Button>

          <Dialog open={open} onOpenChange={v => { if (!v) closeDialog(); else setOpen(true); }}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-9 shadow-sm" onClick={() => { setEditId(null); setForm(emptyForm); }}>
                <Plus className="w-4 h-4 mr-1.5" /> New Invoice
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader><DialogTitle>{editId ? "Edit Invoice" : "Create Invoice"}</DialogTitle></DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2"><Label>Invoice # *</Label><Input value={form.invoice_number} onChange={e => setForm(p => ({ ...p, invoice_number: e.target.value }))} /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2"><Label>Amount *</Label><Input type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} /></div>
                  <div className="grid gap-2"><Label>Tax</Label><Input type="number" value={form.tax} onChange={e => setForm(p => ({ ...p, tax: e.target.value }))} /></div>
                </div>
                <div className="grid gap-2"><Label>Client</Label><Select value={form.client_id} onValueChange={v => setForm(p => ({ ...p, client_id: v }))}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></div>
                <div className="grid gap-2"><Label>Case</Label><Select value={form.case_id} onValueChange={v => setForm(p => ({ ...p, case_id: v }))}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{cases.map(c => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}</SelectContent></Select></div>
                <div className="grid gap-2"><Label>Due Date</Label><Input type="date" value={form.due_date} onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))} /></div>
                <div className="grid gap-2">
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{["draft", "sent", "partial", "paid", "overdue", "cancelled"].map(s => <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2"><Label>Notes</Label><Input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} /></div>
              </div>
              <Button onClick={() => saveMutation.mutate()} disabled={!form.invoice_number || !form.amount || saveMutation.isPending}>
                {saveMutation.isPending ? "Saving..." : editId ? "Update Invoice" : "Create Invoice"}
              </Button>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left py-4 px-6 font-semibold text-muted-foreground whitespace-nowrap">Invoice #</th>
              <th className="text-left py-4 px-6 font-semibold text-muted-foreground">Client</th>
              <th className="text-left py-4 px-6 font-semibold text-muted-foreground">Case</th>
              <th className="text-right py-4 px-6 font-semibold text-muted-foreground whitespace-nowrap">Net Amount</th>
              <th className="text-right py-4 px-6 font-semibold text-muted-foreground whitespace-nowrap">Total</th>
              <th className="text-left py-4 px-6 font-semibold text-muted-foreground">Status</th>
              <th className="text-center py-4 px-6 font-semibold text-muted-foreground">Action</th>
            </tr>
          </thead>
          <tbody>
            {paginatedItems.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-muted-foreground">
                  <div className="flex flex-col items-center gap-2">
                    <ReceiptText className="w-8 h-8 text-muted-foreground/30" />
                    <p>No invoices found matching your criteria</p>
                  </div>
                </td>
              </tr>
            ) : paginatedItems.map(inv => (
              <tr key={inv.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                <td className="py-4 px-6 font-mono text-xs font-medium text-foreground">{inv.invoice_number}</td>
                <td className="py-4 px-6 font-medium text-foreground">{(inv as any).clients?.name || "—"}</td>
                <td className="py-4 px-6 text-muted-foreground">{(inv as any).cases?.title || "—"}</td>
                <td className="py-4 px-6 text-right text-muted-foreground">{Number(inv.amount).toLocaleString("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 })}</td>
                <td className="py-4 px-6 text-right font-semibold text-foreground">{Number(inv.total_amount ?? 0).toLocaleString("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 })}</td>
                <td className="py-4 px-6">
                  <Badge variant={statusColor(inv.status) as any} className="capitalize font-medium shadow-sm">
                    {inv.status}
                  </Badge>
                </td>
                <td className="py-4 px-6">
                  <div className="flex items-center justify-center gap-1.5">
                    <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/10 hover:text-primary transition-colors" onClick={() => downloadInvoicePdf(inv)} title="Download PDF">
                      <FileDown className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:bg-muted transition-colors" onClick={() => openEdit(inv)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <DeleteConfirm onConfirm={() => deleteMutation.mutate(inv.id)} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="p-4 border-t border-border bg-muted/10">
        <TablePagination currentPage={currentPage} totalPages={totalPages} totalItems={totalItems} startIndex={startIndex} pageSize={10} onPrev={prevPage} onNext={nextPage} onGoTo={goToPage} />
      </div>
    </div>
  );
}
