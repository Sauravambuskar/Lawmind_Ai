import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, LineChart, Line, Legend } from "recharts";
import { format, subMonths } from "date-fns";
import { IndianRupee, Briefcase, Users, FileText, Scale, Calendar } from "lucide-react";
import { useMinLoader } from "@/hooks/useMinLoader";
import { PageLoader } from "@/components/PageLoader";

function formatINR(n: number) {
  return "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function ReportsPage() {
  const { data: caseStats, isLoading: l1 } = useQuery({
    queryKey: ["report-cases"],
    queryFn: async () => {
      const { data } = await supabase.from("cases").select("status, created_at, case_type");
      if (!data) return { byStatus: [], byMonth: [], byType: [], total: 0 };
      const statusMap: Record<string, number> = {};
      const typeMap: Record<string, number> = {};
      data.forEach(c => {
        statusMap[c.status] = (statusMap[c.status] || 0) + 1;
        const t = c.case_type || "Other";
        typeMap[t] = (typeMap[t] || 0) + 1;
      });
      const byStatus = Object.entries(statusMap).map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value }));
      const byType = Object.entries(typeMap).map(([name, value]) => ({ name, value }));
      const now = new Date();
      const byMonth = Array.from({ length: 6 }, (_, i) => {
        const d = subMonths(now, 5 - i);
        const key = format(d, "yyyy-MM");
        return { month: format(d, "MMM"), value: data.filter(c => c.created_at.startsWith(key)).length };
      });
      return { byStatus, byMonth, byType, total: data.length };
    },
  });

  const { data: invoiceStats, isLoading: l2 } = useQuery({
    queryKey: ["report-invoices"],
    queryFn: async () => {
      const { data } = await supabase.from("invoices").select("amount, total, status, created_at");
      if (!data) return { revenue: 0, paid: 0, pending: 0, overdue: 0, byMonth: [] };
      const paid = data.filter(i => i.status === "paid").reduce((s, i) => s + Number(i.total), 0);
      const pending = data.filter(i => i.status === "sent" || i.status === "draft").reduce((s, i) => s + Number(i.total), 0);
      const overdue = data.filter(i => i.status === "overdue").reduce((s, i) => s + Number(i.total), 0);
      const now = new Date();
      const byMonth = Array.from({ length: 6 }, (_, i) => {
        const d = subMonths(now, 5 - i);
        const key = format(d, "yyyy-MM");
        const monthPaid = data.filter(inv => inv.created_at.startsWith(key) && inv.status === "paid").reduce((s, inv) => s + Number(inv.total), 0);
        const monthTotal = data.filter(inv => inv.created_at.startsWith(key)).reduce((s, inv) => s + Number(inv.total), 0);
        return { month: format(d, "MMM"), paid: monthPaid, total: monthTotal };
      });
      return { revenue: paid + pending + overdue, paid, pending, overdue, byMonth };
    },
  });

  const { data: expenseStats, isLoading: l3 } = useQuery({
    queryKey: ["report-expenses"],
    queryFn: async () => {
      const { data } = await supabase.from("expenses").select("amount, category, expense_date");
      if (!data) return { total: 0, byCategory: [], byMonth: [] };
      const total = data.reduce((s, e) => s + Number(e.amount), 0);
      const catMap: Record<string, number> = {};
      data.forEach(e => { const cat = e.category || "Uncategorized"; catMap[cat] = (catMap[cat] || 0) + Number(e.amount); });
      const byCategory = Object.entries(catMap).map(([name, value]) => ({ name, value }));
      const now = new Date();
      const byMonth = Array.from({ length: 6 }, (_, i) => {
        const d = subMonths(now, 5 - i);
        const key = format(d, "yyyy-MM");
        return { month: format(d, "MMM"), value: data.filter(e => (e.expense_date || "").startsWith(key)).reduce((s, e) => s + Number(e.amount), 0) };
      });
      return { total, byCategory, byMonth };
    },
  });

  const { data: clientCount = 0 } = useQuery({
    queryKey: ["report-clients"],
    queryFn: async () => { const { count } = await supabase.from("clients").select("*", { count: "exact", head: true }); return count || 0; },
  });

  const { data: advocateCount = 0 } = useQuery({
    queryKey: ["report-advocates"],
    queryFn: async () => { const { count } = await supabase.from("advocates").select("*", { count: "exact", head: true }); return count || 0; },
  });

  const { data: hearingStats } = useQuery({
    queryKey: ["report-hearings"],
    queryFn: async () => {
      const { data } = await supabase.from("hearings").select("status, hearing_date");
      if (!data) return { total: 0, byStatus: [] };
      const statusMap: Record<string, number> = {};
      data.forEach(h => { statusMap[h.status] = (statusMap[h.status] || 0) + 1; });
      const byStatus = Object.entries(statusMap).map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value }));
      return { total: data.length, byStatus };
    },
  });

  const pieColors = ["hsl(255, 65%, 55%)", "hsl(30, 90%, 60%)", "hsl(145, 60%, 45%)", "hsl(0, 70%, 55%)", "hsl(210, 70%, 55%)", "hsl(320, 60%, 50%)"];

  const showLoader = useMinLoader(l1 || l2 || l3);
  if (showLoader) return <PageLoader />;

  const netProfit = (invoiceStats?.paid ?? 0) - (expenseStats?.total ?? 0);

  return (
    <div>
      <PageHeader title="Reports & Analytics" breadcrumbs={[{ label: "Dashboard", path: "/" }, { label: "System Setup" }, { label: "Reports" }]} />

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1"><Briefcase className="w-4 h-4 text-primary" /><span className="text-xs text-muted-foreground">Cases</span></div>
          <p className="text-xl font-bold text-foreground">{caseStats?.total ?? 0}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1"><Users className="w-4 h-4 text-primary" /><span className="text-xs text-muted-foreground">Clients</span></div>
          <p className="text-xl font-bold text-foreground">{clientCount}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1"><Scale className="w-4 h-4 text-primary" /><span className="text-xs text-muted-foreground">Advocates</span></div>
          <p className="text-xl font-bold text-foreground">{advocateCount}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1"><Calendar className="w-4 h-4 text-primary" /><span className="text-xs text-muted-foreground">Hearings</span></div>
          <p className="text-xl font-bold text-foreground">{hearingStats?.total ?? 0}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1"><IndianRupee className="w-4 h-4 text-green-600" /><span className="text-xs text-muted-foreground">Revenue</span></div>
          <p className="text-xl font-bold text-foreground">{formatINR(invoiceStats?.paid ?? 0)}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1"><FileText className="w-4 h-4 text-orange-500" /><span className="text-xs text-muted-foreground">Expenses</span></div>
          <p className="text-xl font-bold text-foreground">{formatINR(expenseStats?.total ?? 0)}</p>
        </div>
      </div>

      {/* Net Profit Banner */}
      <div className={`rounded-xl p-5 mb-6 border ${netProfit >= 0 ? "bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800" : "bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800"}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Net Profit / Loss</p>
            <p className={`text-2xl font-bold ${netProfit >= 0 ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}`}>
              {formatINR(netProfit)}
            </p>
          </div>
          <div className="text-right text-sm text-muted-foreground">
            <p>Paid: {formatINR(invoiceStats?.paid ?? 0)}</p>
            <p>Pending: {formatINR(invoiceStats?.pending ?? 0)}</p>
            {(invoiceStats?.overdue ?? 0) > 0 && <p className="text-destructive">Overdue: {formatINR(invoiceStats?.overdue ?? 0)}</p>}
          </div>
        </div>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Case Status Distribution</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={caseStats?.byStatus || []} cx="50%" cy="50%" outerRadius={85} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                  {(caseStats?.byStatus || []).map((_, i) => <Cell key={i} fill={pieColors[i % pieColors.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Cases by Type</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={caseStats?.byType || []} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={100} axisLine={false} tickLine={false} />
                <Tooltip />
                <Bar dataKey="value" fill="hsl(255, 65%, 55%)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Monthly Revenue (Paid vs Total Billed)</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={invoiceStats?.byMonth || []}>
                <XAxis dataKey="month" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v: number) => formatINR(v)} />
                <Legend />
                <Bar dataKey="total" name="Billed" fill="hsl(210, 70%, 55%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="paid" name="Paid" fill="hsl(145, 60%, 45%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Hearing Status</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={hearingStats?.byStatus || []} cx="50%" cy="50%" innerRadius={50} outerRadius={85} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                  {(hearingStats?.byStatus || []).map((_, i) => <Cell key={i} fill={pieColors[i % pieColors.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Charts Row 3 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Expenses by Category</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={expenseStats?.byCategory || []} cx="50%" cy="50%" outerRadius={85} dataKey="value" label={({ name, value }) => `${name}: ${formatINR(value)}`}>
                  {(expenseStats?.byCategory || []).map((_, i) => <Cell key={i} fill={pieColors[i % pieColors.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => formatINR(v)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Monthly Expenses Trend</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={expenseStats?.byMonth || []}>
                <XAxis dataKey="month" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v: number) => formatINR(v)} />
                <Line type="monotone" dataKey="value" stroke="hsl(30, 90%, 60%)" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Cases Per Month */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">New Cases Per Month</h3>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={caseStats?.byMonth || []}>
              <XAxis dataKey="month" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip />
              <Bar dataKey="value" fill="hsl(255, 65%, 55%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
