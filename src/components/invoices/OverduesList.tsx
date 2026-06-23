import { useState } from "react";
import { Search, Download, AlertTriangle } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { usePagination } from "@/hooks/usePagination";
import { TablePagination } from "@/components/TablePagination";
import { exportToCSV } from "@/lib/export";

interface Props {
  invoices: any[];
}

export function OverduesList({ invoices }: Props) {
  const [search, setSearch] = useState("");

  const overdueInvoices = invoices.filter(inv =>
    inv.status === "overdue" ||
    (inv.status !== "paid" && inv.status !== "cancelled" && inv.due_date && new Date(inv.due_date) < new Date())
  );

  const filtered = overdueInvoices.filter(inv =>
    (inv.invoice_number || "").toLowerCase().includes(search.toLowerCase()) ||
    ((inv as any).clients?.name || "").toLowerCase().includes(search.toLowerCase())
  );

  const totalOverdue = filtered.reduce((s, i) => s + Number(i.total || 0), 0);
  const { paginatedItems, currentPage, totalPages, totalItems, startIndex, nextPage, prevPage, goToPage } = usePagination(filtered);

  const daysOverdue = (dueDate: string) => {
    const days = differenceInDays(new Date(), new Date(dueDate));
    return days > 0 ? days : 0;
  };

  const urgency = (days: number) => {
    if (days > 60) return "destructive";
    if (days > 30) return "default";
    return "secondary";
  };

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card border border-destructive/30 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-destructive" />
            <p className="text-xs font-semibold text-muted-foreground uppercase">Total Overdue Amount</p>
          </div>
          <p className="text-2xl font-bold text-destructive">₹{totalOverdue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Overdue Invoices</p>
          <p className="text-2xl font-bold text-foreground">{overdueInvoices.length}</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Avg. Days Overdue</p>
          <p className="text-2xl font-bold text-foreground">
            {overdueInvoices.length > 0
              ? Math.round(overdueInvoices.reduce((s, i) => s + (i.due_date ? daysOverdue(i.due_date) : 0), 0) / overdueInvoices.length)
              : 0}
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-foreground">Overdue Invoices</h3>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => exportToCSV(filtered.map(inv => ({ invoice: inv.invoice_number, client: (inv as any).clients?.name || "", amount: inv.total, due_date: inv.due_date || "", days_overdue: inv.due_date ? daysOverdue(inv.due_date) : 0 })), "overdues")}>
              <Download className="w-4 h-4 mr-2" /> Export
            </Button>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search..." className="pl-9 w-56" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Invoice #</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Client</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Amount</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Due Date</th>
                <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Days Overdue</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Urgency</th>
              </tr>
            </thead>
            <tbody>
              {paginatedItems.length === 0 ? (
                <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">No overdue invoices 🎉</td></tr>
              ) : paginatedItems.map(inv => {
                const days = inv.due_date ? daysOverdue(inv.due_date) : 0;
                return (
                  <tr key={inv.id} className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors">
                    <td className="py-3 px-4 text-sm font-mono">{inv.invoice_number}</td>
                    <td className="py-3 px-4 text-sm">{(inv as any).clients?.name || "—"}</td>
                    <td className="py-3 px-4 text-sm text-right font-medium">₹{Number(inv.total).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                    <td className="py-3 px-4 text-sm">{inv.due_date ? format(new Date(inv.due_date), "PP") : "—"}</td>
                    <td className="py-3 px-4 text-sm text-center font-semibold">{days}</td>
                    <td className="py-3 px-4">
                      <Badge variant={urgency(days) as any}>
                        {days > 60 ? "Critical" : days > 30 ? "High" : "Medium"}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <TablePagination currentPage={currentPage} totalPages={totalPages} totalItems={totalItems} startIndex={startIndex} pageSize={10} onPrev={prevPage} onNext={nextPage} onGoTo={goToPage} />
      </div>
    </div>
  );
}
