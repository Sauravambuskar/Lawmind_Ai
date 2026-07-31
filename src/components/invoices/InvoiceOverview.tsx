import { useState, useMemo } from "react";
import { Search, FileText, Wallet, Receipt, Clock, AlertCircle, CalendarDays, TrendingUp, TrendingDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { subDays, isAfter } from "date-fns";

const periodOptions = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "180", label: "Last 6 months" },
  { value: "365", label: "Last 1 year" },
  { value: "all", label: "All Time" },
];

function formatCurrency(n: number) {
  if (n >= 100000) {
    return "₹" + (n / 100000).toFixed(2) + "L";
  }
  return "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function formatCurrencyFull(n: number) {
  return "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

interface Props {
  invoices: any[];
  expenses: any[];
  payments: any[];
}

export function InvoiceOverview({ invoices, expenses, payments }: Props) {
  const [period, setPeriod] = useState("30");
  const [search, setSearch] = useState("");

  const cutoff = useMemo(() => {
    if (period === "all") return null;
    return subDays(new Date(), parseInt(period));
  }, [period]);

  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      if (cutoff && inv.created_at && !isAfter(new Date(inv.created_at), cutoff)) return false;
      return true;
    });
  }, [invoices, cutoff]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter(exp => {
      if (cutoff && exp.expense_date && !isAfter(new Date(exp.expense_date), cutoff)) return false;
      return true;
    });
  }, [expenses, cutoff]);

  const filteredPayments = useMemo(() => {
    return payments.filter(p => {
      if (cutoff && p.payment_date && !isAfter(new Date(p.payment_date), cutoff)) return false;
      return true;
    });
  }, [payments, cutoff]);

  const stats = useMemo(() => {
    const invoiceAmount = filteredInvoices.reduce((s, i) => s + Number(i.total_amount || 0), 0);
    const paymentReceived = filteredPayments.reduce((s, p) => s + Number(p.amount || 0), 0);
    const totalExpenses = filteredExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);
    const paymentDue = invoiceAmount - paymentReceived;
    const paymentOverdue = filteredInvoices.filter(i => i.status === "overdue").reduce((s, i) => s + Number(i.total_amount || 0), 0);
    const collectionRate = invoiceAmount > 0 ? Math.round((paymentReceived / invoiceAmount) * 100) : 0;
    return { invoiceAmount, paymentReceived, totalExpenses, paymentDue, paymentOverdue, collectionRate };
  }, [filteredInvoices, filteredExpenses, filteredPayments]);

  const clientSummary = useMemo(() => {
    const map: Record<string, { name: string; cases: Set<string>; invoiceAmount: number; amountReceived: number }> = {};
    for (const inv of filteredInvoices) {
      const clientName = (inv as any).clients?.name || "Unknown";
      const clientId = inv.client_id || "unknown";
      if (!map[clientId]) map[clientId] = { name: clientName, cases: new Set(), invoiceAmount: 0, amountReceived: 0 };
      if (inv.case_id) map[clientId].cases.add(inv.case_id);
      map[clientId].invoiceAmount += Number(inv.total_amount || 0);
    }
    for (const p of filteredPayments) {
      const clientId = p.invoices?.client_id;
      if (clientId && map[clientId]) {
        map[clientId].amountReceived += Number(p.amount || 0);
      }
    }
    return Object.values(map)
      .filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => b.invoiceAmount - a.invoiceAmount);
  }, [filteredInvoices, filteredPayments, search]);

  const statCards = [
    {
      label: "Total Invoiced",
      value: formatCurrency(stats.invoiceAmount),
      fullValue: formatCurrencyFull(stats.invoiceAmount),
      icon: FileText,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-50 dark:bg-blue-500/10",
      border: "border-blue-100 dark:border-blue-500/20",
      accent: "bg-blue-600",
      sub: `${filteredInvoices.length} invoice${filteredInvoices.length !== 1 ? "s" : ""}`,
    },
    {
      label: "Payment Received",
      value: formatCurrency(stats.paymentReceived),
      fullValue: formatCurrencyFull(stats.paymentReceived),
      icon: Wallet,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-50 dark:bg-emerald-500/10",
      border: "border-emerald-100 dark:border-emerald-500/20",
      accent: "bg-emerald-600",
      sub: `${stats.collectionRate}% collection rate`,
      trend: stats.paymentReceived > 0 ? "up" : null,
    },
    {
      label: "Payment Due",
      value: formatCurrency(stats.paymentDue),
      fullValue: formatCurrencyFull(stats.paymentDue),
      icon: Clock,
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-50 dark:bg-amber-500/10",
      border: "border-amber-100 dark:border-amber-500/20",
      accent: "bg-amber-500",
      sub: "Pending settlement",
    },
    {
      label: "Payment Overdue",
      value: formatCurrency(stats.paymentOverdue),
      fullValue: formatCurrencyFull(stats.paymentOverdue),
      icon: AlertCircle,
      color: stats.paymentOverdue > 0 ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground",
      bg: stats.paymentOverdue > 0 ? "bg-rose-50 dark:bg-rose-500/10" : "bg-muted/40",
      border: stats.paymentOverdue > 0 ? "border-rose-200 dark:border-rose-500/30" : "border-border",
      accent: stats.paymentOverdue > 0 ? "bg-rose-500" : "bg-muted",
      highlight: stats.paymentOverdue > 0,
      sub: stats.paymentOverdue > 0 ? "Requires action" : "All clear",
      trend: stats.paymentOverdue > 0 ? "down" : null,
    },
    {
      label: "Total Expenses",
      value: formatCurrency(stats.totalExpenses),
      fullValue: formatCurrencyFull(stats.totalExpenses),
      icon: Receipt,
      color: "text-violet-600 dark:text-violet-400",
      bg: "bg-violet-50 dark:bg-violet-500/10",
      border: "border-violet-100 dark:border-violet-500/20",
      accent: "bg-violet-600",
      sub: `${filteredExpenses.length} expense${filteredExpenses.length !== 1 ? "s" : ""}`,
    },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* Billing Period Control */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-card border border-border rounded-xl p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg shrink-0">
            <CalendarDays className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground leading-none">Billing Period</p>
            <p className="text-xs text-muted-foreground mt-0.5">Select the timeframe for your financial overview.</p>
          </div>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-44 h-9 text-sm shadow-sm shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {periodOptions.map(p => (
              <SelectItem key={p.value} value={p.value} className="text-sm">{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {statCards.map((card, i) => (
          <div
            key={i}
            title={card.fullValue}
            className={`relative bg-card border rounded-xl p-4 shadow-sm hover:shadow-md transition-all group overflow-hidden ${
              card.highlight ? "ring-1 ring-rose-400/50 border-rose-200 dark:border-rose-500/30" : card.border
            }`}
          >
            {/* Top accent bar */}
            <div className={`absolute top-0 left-0 right-0 h-0.5 ${card.accent} opacity-70`} />

            <div className="flex items-start justify-between gap-2 mb-3">
              <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase leading-tight">
                {card.label}
              </p>
              <div className={`p-1.5 rounded-lg shrink-0 ${card.bg}`}>
                <card.icon className={`w-3.5 h-3.5 ${card.color}`} strokeWidth={2.5} />
              </div>
            </div>

            <p className={`text-xl font-bold tracking-tight leading-none mb-1.5 ${
              card.highlight ? "text-rose-600 dark:text-rose-400" : "text-foreground"
            }`}>
              {card.value}
            </p>

            <div className="flex items-center gap-1">
              {card.trend === "up" && <TrendingUp className="w-3 h-3 text-emerald-500 shrink-0" />}
              {card.trend === "down" && <TrendingDown className="w-3 h-3 text-rose-500 shrink-0" />}
              <p className={`text-[10px] truncate ${
                card.trend === "up" ? "text-emerald-600 dark:text-emerald-400" :
                card.trend === "down" ? "text-rose-500" : "text-muted-foreground"
              }`}>
                {card.sub}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Client Revenue Breakdown Table */}
      <div className="bg-card border border-border shadow-sm rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-[13px] font-semibold text-foreground">Client Revenue Breakdown</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">Detailed view of invoicing and receipts per client.</p>
          </div>
          <div className="relative shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Search clients..."
              className="pl-9 h-9 w-full sm:w-56 text-sm bg-background shadow-sm"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left py-3 px-5">
                  <span className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">Client Name</span>
                </th>
                <th className="text-center py-3 px-5">
                  <span className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">Active Cases</span>
                </th>
                <th className="text-right py-3 px-5">
                  <span className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">Total Invoiced</span>
                </th>
                <th className="text-right py-3 px-5">
                  <span className="text-[10px] font-bold tracking-widest text-emerald-600 dark:text-emerald-400 uppercase">Amount Received</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {clientSummary.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-14 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <FileText className="w-8 h-8 text-muted-foreground/25" />
                      <p className="text-sm text-muted-foreground">No revenue data found for this period</p>
                    </div>
                  </td>
                </tr>
              ) : (
                clientSummary.map((c, i) => {
                  const pct = c.invoiceAmount > 0 ? Math.round((c.amountReceived / c.invoiceAmount) * 100) : 0;
                  return (
                    <tr key={i} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors group">
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-[12px] font-bold text-primary shrink-0">
                            {c.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-medium text-[13px] text-foreground">{c.name}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-5 text-center">
                        <span className="inline-flex items-center bg-muted px-2.5 py-0.5 rounded-full text-[11px] font-medium text-muted-foreground border border-border/50">
                          {c.cases.size} {c.cases.size === 1 ? "Case" : "Cases"}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        <span className="font-semibold text-[13px] text-foreground">
                          {formatCurrencyFull(c.invoiceAmount)}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        <div className="flex flex-col items-end gap-0.5">
                          <span className={`font-semibold text-[13px] ${
                            c.amountReceived >= c.invoiceAmount
                              ? "text-emerald-600 dark:text-emerald-400"
                              : c.amountReceived > 0
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-muted-foreground"
                          }`}>
                            {formatCurrencyFull(c.amountReceived)}
                          </span>
                          {c.invoiceAmount > 0 && (
                            <span className="text-[10px] text-muted-foreground">{pct}% collected</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {clientSummary.length > 1 && (
              <tfoot>
                <tr className="border-t-2 border-border bg-muted/20">
                  <td className="py-3 px-5 font-semibold text-[12px] text-muted-foreground" colSpan={2}>
                    Total ({clientSummary.length} clients)
                  </td>
                  <td className="py-3 px-5 text-right font-bold text-[13px] text-foreground">
                    {formatCurrencyFull(clientSummary.reduce((s, c) => s + c.invoiceAmount, 0))}
                  </td>
                  <td className="py-3 px-5 text-right font-bold text-[13px] text-emerald-600 dark:text-emerald-400">
                    {formatCurrencyFull(clientSummary.reduce((s, c) => s + c.amountReceived, 0))}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
