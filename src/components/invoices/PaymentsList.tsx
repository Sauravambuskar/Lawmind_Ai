import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, Download, CheckCircle, Plus, Receipt } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { usePagination } from "@/hooks/usePagination";
import { TablePagination } from "@/components/TablePagination";
import { exportToCSV } from "@/lib/export";
import { useAuth } from "@/hooks/useAuth";
import { CURRENCY } from "@/lib/constants";

interface Props {
  invoices: any[];
  payments: any[];
}

export function PaymentsList({ invoices, payments }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [payDialog, setPayDialog] = useState<any>(null);
  const [form, setForm] = useState({
    amount_paid: "",
    payment_date: new Date().toISOString().slice(0, 10),
    method: "bank_transfer",
    reference_no: "",
    notes: "",
  });

  const unpaidInvoices = invoices.filter(inv => inv.status !== "paid" && inv.status !== "cancelled");
  
  // Calculate total received using the new payments table
  const totalReceived = payments.reduce((s, p) => s + Number(p.amount_paid || 0), 0);
  const fullyPaidCount = invoices.filter(inv => inv.status === "paid").length;

  const filteredPayments = payments.filter(p =>
    (p.invoices?.invoice_number || "").toLowerCase().includes(search.toLowerCase()) ||
    ((p.invoices?.clients as any)?.name || "").toLowerCase().includes(search.toLowerCase()) ||
    (p.method || "").toLowerCase().includes(search.toLowerCase())
  );

  const { paginatedItems, currentPage, totalPages, totalItems, startIndex, nextPage, prevPage, goToPage } = usePagination(filteredPayments);

  const recordPaymentMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        invoice_id: payDialog.id,
        amount_paid: Number(form.amount_paid),
        payment_date: form.payment_date,
        method: form.method,
        reference_no: form.reference_no,
        notes: form.notes,
        user_id: user!.id,
      };
      const { error } = await supabase.from("payments").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      setPayDialog(null);
      toast.success("Payment recorded successfully");
    },
    onError: (e) => toast.error(e.message),
  });

  const openPayDialog = (inv: any) => {
    // Calculate remaining balance
    const paymentsForInv = payments.filter(p => p.invoice_id === inv.id);
    const paidSoFar = paymentsForInv.reduce((s, p) => s + Number(p.amount_paid), 0);
    const balance = Number(inv.total) - paidSoFar;

    setPayDialog({ ...inv, balance });
    setForm({
      amount_paid: balance > 0 ? balance.toString() : "",
      payment_date: new Date().toISOString().slice(0, 10),
      method: "bank_transfer",
      reference_no: "",
      notes: "",
    });
  };

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Total Payments Received</p>
          <p className="text-2xl font-bold text-emerald-500">{CURRENCY}{totalReceived.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Fully Paid Invoices</p>
          <p className="text-2xl font-bold text-foreground">{fullyPaidCount}</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Awaiting Payment</p>
          <p className="text-2xl font-bold text-destructive">{unpaidInvoices.length}</p>
        </div>
      </div>

      {/* Unpaid invoices - quick actions */}
      {unpaidInvoices.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="text-sm font-semibold text-foreground mb-4">Pending Invoices — Record Payment</h3>
          <div className="space-y-2">
            {unpaidInvoices.slice(0, 5).map(inv => {
              const paymentsForInv = payments.filter(p => p.invoice_id === inv.id);
              const paidSoFar = paymentsForInv.reduce((s, p) => s + Number(p.amount_paid), 0);
              const balance = Number(inv.total) - paidSoFar;

              return (
                <div key={inv.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 border border-border">
                  <div className="flex items-center gap-3 w-1/3">
                    <span className="text-sm font-mono font-medium">{inv.invoice_number}</span>
                    <span className="text-sm text-muted-foreground truncate">{(inv as any).clients?.name || "—"}</span>
                  </div>
                  <div className="flex items-center justify-between w-1/3 px-4 text-sm">
                    <span className="text-muted-foreground">Total: {CURRENCY}{Number(inv.total).toLocaleString("en-IN")}</span>
                    {paidSoFar > 0 && <span className="text-emerald-500 font-medium">Paid: {CURRENCY}{paidSoFar.toLocaleString("en-IN")}</span>}
                  </div>
                  <div className="flex items-center justify-end gap-3 w-1/3">
                    <span className="text-sm font-bold text-rose-500">Bal: {CURRENCY}{balance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                    <Badge variant={inv.status === "overdue" ? "destructive" : inv.status === "partial" ? "outline" : "secondary"} className={inv.status === "partial" ? "border-amber-500/50 text-amber-500" : ""}>
                      {inv.status}
                    </Badge>
                    <Button size="sm" onClick={() => openPayDialog(inv)}>
                      <Plus className="w-3.5 h-3.5 mr-1" /> Record
                    </Button>
                  </div>
                </div>
              );
            })}
            {unpaidInvoices.length > 5 && <p className="text-xs text-muted-foreground text-center mt-2">+{unpaidInvoices.length - 5} more pending invoices</p>}
          </div>
        </div>
      )}

      {/* Payment History table */}
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-foreground">Payment History Logs</h3>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => exportToCSV(filteredPayments.map(p => ({ 
              date: p.payment_date, invoice: p.invoices?.invoice_number, 
              client: (p.invoices?.clients as any)?.name || "", 
              amount: p.amount_paid, method: p.method, ref: p.reference_no 
            })), "payments")}>
              <Download className="w-4 h-4 mr-2" /> Export
            </Button>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search payments..." className="pl-9 w-56" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/40">
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Invoice #</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Client</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Method</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Reference</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Amount</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Receipt</th>
              </tr>
            </thead>
            <tbody>
              {paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center">
                    <Receipt className="w-8 h-8 text-muted-foreground opacity-30 mx-auto mb-2" />
                    <p className="text-sm font-medium text-foreground">No payments recorded</p>
                    <p className="text-xs text-muted-foreground mt-1">Record a payment from a pending invoice above.</p>
                  </td>
                </tr>
              ) : paginatedItems.map(p => (
                <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="py-3 px-4 text-sm font-medium">{format(new Date(p.payment_date), "MMM d, yyyy")}</td>
                  <td className="py-3 px-4 text-sm font-mono text-primary">{p.invoices?.invoice_number}</td>
                  <td className="py-3 px-4 text-sm">{(p.invoices?.clients as any)?.name || "—"}</td>
                  <td className="py-3 px-4">
                    <Badge variant="outline" className="capitalize text-[10px]">{p.method.replace('_', ' ')}</Badge>
                  </td>
                  <td className="py-3 px-4 text-sm text-muted-foreground">{p.reference_no || "—"}</td>
                  <td className="py-3 px-4 text-sm text-right font-bold text-emerald-500">{CURRENCY}{Number(p.amount_paid).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                  <td className="py-3 px-4 text-right">
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => window.print()}>Print</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {paginatedItems.length > 0 && (
          <div className="mt-4">
            <TablePagination currentPage={currentPage} totalPages={totalPages} totalItems={totalItems} startIndex={startIndex} pageSize={10} onPrev={prevPage} onNext={nextPage} onGoTo={goToPage} />
          </div>
        )}
      </div>

      {/* Record Payment dialog */}
      <Dialog open={!!payDialog} onOpenChange={v => { if (!v) setPayDialog(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>
              Recording payment for invoice <span className="font-mono font-medium text-foreground">{payDialog?.invoice_number}</span>. 
              Remaining balance: <strong className="text-rose-500">{CURRENCY}{payDialog?.balance?.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Amount Received ({CURRENCY}) *</Label>
                <Input type="number" step="0.01" max={payDialog?.balance} value={form.amount_paid} onChange={e => setForm(f => ({ ...f, amount_paid: e.target.value }))} className="bg-muted/50 font-mono text-lg" />
              </div>
              <div className="grid gap-2">
                <Label>Payment Date *</Label>
                <Input type="date" value={form.payment_date} onChange={e => setForm(f => ({ ...f, payment_date: e.target.value }))} className="bg-muted/50" />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Payment Method *</Label>
                <Select value={form.method} onValueChange={v => setForm(f => ({ ...f, method: v }))}>
                  <SelectTrigger className="bg-muted/50"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bank_transfer">Bank Transfer (NEFT/RTGS)</SelectItem>
                    <SelectItem value="upi">UPI</SelectItem>
                    <SelectItem value="cheque">Cheque</SelectItem>
                    <SelectItem value="dd">Demand Draft</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Reference / UTR No.</Label>
                <Input value={form.reference_no} onChange={e => setForm(f => ({ ...f, reference_no: e.target.value }))} className="bg-muted/50" placeholder="e.g. UTR123456" />
              </div>
            </div>
            
            <div className="grid gap-2">
              <Label>Notes (Optional)</Label>
              <Textarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="bg-muted/50" placeholder="Any additional details..." />
            </div>
          </div>
          <Button onClick={() => recordPaymentMutation.mutate()} disabled={!form.amount_paid || Number(form.amount_paid) <= 0 || recordPaymentMutation.isPending} className="w-full">
            {recordPaymentMutation.isPending ? "Recording..." : "Record Payment"}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
