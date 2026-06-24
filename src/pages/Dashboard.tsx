import {
  TrendingUp, Users, UserPlus, Eye, Plus, FileText, Phone, Image,
  Clock, AlertTriangle, CalendarClock, BriefcaseBusiness,
  CheckCircle2, AlertCircle, ChevronRight, Scale,
} from "lucide-react";
import {
  PieChart, Pie, Cell, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, Tooltip, BarChart, Bar, CartesianGrid,
} from "recharts";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { CURRENCY, LOCALE } from "@/lib/constants";

const LEGAL_TIPS = [
  "Well prepared cases build stronger arguments.",
  "Preparation is the key to winning any case.",
  "Always keep your clients proactively informed.",
  "Document everything. If it isn't written down, it didn't happen.",
  "Clear communication avoids misunderstandings later.",
  "Double-check all deadlines. Time is of the essence.",
  "Empathy with clients builds trust and long-lasting relationships.",
  "Thorough legal research is the foundation of success.",
  "Stay organized; a structured approach wins cases.",
  "A successful practice is built on consistency and care.",
];

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const currentQuote = LEGAL_TIPS[Math.floor(Date.now() / (3 * 60 * 60 * 1000)) % LEGAL_TIPS.length];

  // ── Real data from Supabase ─────────────────────────────────────────────
  const { data: allCases = [] } = useQuery({
    queryKey: ["dashboard-cases"],
    queryFn: async () => {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
      const session = (await supabase.auth.getSession()).data.session;
      const authToken = session?.access_token || supabaseKey;
      const headers = { "apikey": supabaseKey, "Authorization": `Bearer ${authToken}`, "Prefer": "count=exact" };
      
      // Fetch all cases in batches of 1000 (PostgREST server limit)
      const all: any[] = [];
      let offset = 0;
      while (true) {
        const res = await fetch(`${supabaseUrl}/rest/v1/cases?select=id,status,case_stage,court_type,created_at,next_hearing_date,title&order=created_at.desc&offset=${offset}&limit=1000`, { headers });
        if (!res.ok) break;
        const batch = await res.json();
        all.push(...batch);
        if (batch.length < 1000) break;
        offset += 1000;
      }
      return all;
    },
  });

  const { data: clientsList = [] } = useQuery({
    queryKey: ["dashboard-clients"],
    queryFn: async () => { const { data } = await supabase.from("clients").select("id, name, email, phone, city, state"); return data || []; },
  });

  // Calculate real counts
  const caseCounts = {
    total: allCases.length,
    pending: allCases.filter((c: any) => c.status === "pending").length,
    disposed: allCases.filter((c: any) => c.status === "disposed").length,
    open: allCases.filter((c: any) => c.status === "open" || c.status === "in-progress").length,
    notApplicable: allCases.filter((c: any) => c.status === "not applicable").length,
  };
  const clientCount = clientsList.length;

  // Upcoming hearings from real data (cases with next_hearing_date in the future)
  const now = new Date();
  const upcomingHearings = allCases
    .filter((c: any) => c.next_hearing_date && new Date(c.next_hearing_date) >= now)
    .sort((a: any, b: any) => new Date(a.next_hearing_date).getTime() - new Date(b.next_hearing_date).getTime())
    .slice(0, 5)
    .map((c: any) => ({ purpose: c.title, hearing_date: c.next_hearing_date, court_name: c.court_type || "Court" }));

  const hearingData = { total: upcomingHearings.length, today: allCases.filter((c: any) => c.next_hearing_date === format(now, "yyyy-MM-dd")).length };

  // Recent cases (last 5 created)
  const recentActivity = allCases.slice(0, 5).map((c: any) => ({
    type: "Case", label: c.title, time: c.created_at,
  }));

  const profile = { full_name: "Adv. Manmohan Sarda" };

  const overdueInvoices: any[] = [];

  // Cases by month for bar chart (from created_at)
  const casesChart = (() => {
    const months: Record<string, number> = {};
    allCases.forEach((c: any) => {
      if (c.created_at) {
        const m = format(new Date(c.created_at), "MMM yyyy");
        months[m] = (months[m] || 0) + 1;
      }
    });
    return Object.entries(months).slice(-6).map(([month, value]) => ({ month: month.split(" ")[0], value }));
  })();

  const adviceStats = { thisMonth: caseCounts.pending, chart: casesChart.length > 0 ? casesChart.map(c => ({ month: c.month, value: c.value })) : [{ month: "—", value: 0 }] };

  // ────────────────────────────────────────────────────────────────────────────

  const stats = [
    { label: "Total Cases",    value: caseCounts.total,          icon: BriefcaseBusiness, color: "text-blue-500",    bg: "bg-blue-500/10" },
    { label: "Pending Cases",  value: caseCounts.pending,        icon: Clock,             color: "text-amber-500",   bg: "bg-amber-500/10" },
    { label: "Disposed Cases", value: caseCounts.disposed,       icon: CheckCircle2,      color: "text-emerald-500", bg: "bg-emerald-500/10" },
    { label: "Not Applicable", value: caseCounts.notApplicable,  icon: AlertCircle,       color: "text-purple-500",  bg: "bg-purple-500/10" },
  ];

  const pieData = caseCounts.total > 0
    ? [
        { name: "Pending",        value: caseCounts.pending,        color: "#f59e0b" },
        { name: "Disposed",       value: caseCounts.disposed,       color: "#10b981" },
        { name: "Open",           value: caseCounts.open,           color: "#3b82f6" },
        { name: "Not Applicable", value: caseCounts.notApplicable,  color: "#8b5cf6" },
      ].filter(d => d.value > 0)
    : [{ name: "No Data", value: 100, color: "hsl(var(--muted))" }];

  const quickActions = [
    { label: "Add Client",   icon: UserPlus, path: "/clients" },
    { label: "Add Advocate", icon: Users,    path: "/advocates" },
    { label: "Add User",     icon: UserPlus, path: "/staff/users" },
    { label: "View Report",  icon: FileText, path: "/invoices" },
    { label: "View Profile", icon: Eye,      path: "/clients" },
    { label: "Create Case",  icon: Plus,     path: "/cases" },
    { label: "Documents",    icon: FileText, path: "/documents" },
    { label: "Expenses",     icon: Image,    path: "/expenses" },
  ];

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good Morning";
    if (h < 17) return "Good Afternoon";
    return "Good Evening";
  })();

  const displayName = profile.full_name || user?.email?.split("@")[0] || "Counsellor";

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden bg-card border border-border shadow-sm rounded-2xl p-8 lg:p-10">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />

        {/* Courthouse Illustration */}
        <div className="absolute bottom-0 right-0 lg:right-8 h-full pointer-events-none hidden md:flex items-end justify-end z-0">
          <img src="https://i.postimg.cc/Jz9qhLQk/23d06c30-a10f-43bf-ba49-d5ad1d3b92a9.png" alt="Courthouse" className="h-[120px] lg:h-[180px] w-auto object-contain object-bottom mix-blend-multiply opacity-90" />
        </div>

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center gap-8 pr-0 lg:pr-[300px] xl:pr-[360px]">
          <div className="flex-1 flex flex-col gap-6">
            <div>
              <h2 className="text-3xl font-bold text-foreground tracking-tight">{greeting}, {displayName} 👋</h2>
              <p className="text-muted-foreground mt-2 text-[15px] max-w-lg leading-relaxed">Here's a summary of your practice's performance and upcoming agenda.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button onClick={() => navigate("/cases")} className="px-5 py-2.5 bg-[#1a233a] text-white rounded-lg text-[13px] font-semibold shadow-sm hover:shadow-md hover:bg-[#1a233a]/90 transition-all flex items-center gap-2">
                <Plus className="w-4 h-4" /> New Case
              </button>
              <button onClick={() => navigate("/clients")} className="px-5 py-2.5 bg-white border border-input text-foreground rounded-lg text-[13px] font-semibold shadow-sm hover:bg-muted transition-all flex items-center gap-2">
                <UserPlus className="w-4 h-4" /> Add Client
              </button>
              <button onClick={() => navigate("/tasks")} className="px-5 py-2.5 bg-white border border-input text-foreground rounded-lg text-[13px] font-semibold shadow-sm hover:bg-muted transition-all flex items-center gap-2">
                <CalendarClock className="w-4 h-4" /> Add Task
              </button>
            </div>
          </div>

          {/* Quote Card */}
          <div className="bg-white/90 backdrop-blur-md border border-border/80 rounded-xl p-4 shadow-sm w-full max-w-[240px] shrink-0 hidden lg:block">
            <div className="flex items-center gap-2 text-muted-foreground font-semibold text-xs mb-2.5">
              <div className="bg-muted p-1 rounded">
                <span className="text-primary font-bold text-sm leading-none">❝</span>
              </div>
              Tip of the Day
            </div>
            <p className="text-[13.5px] text-foreground font-medium leading-relaxed">{currentQuote}</p>
            <p className="text-[11px] text-muted-foreground mt-2.5">– LawMind</p>
          </div>
        </div>
      </div>

      {/* Alerts Row */}
      {(upcomingHearings.length > 0 || overdueInvoices.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {upcomingHearings.length > 0 && (
            <div className="bg-card border border-amber-500/20 shadow-sm rounded-xl p-5 overflow-hidden relative">
              <div className="absolute left-0 top-0 w-1 h-full bg-amber-500" />
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <div className="p-1.5 bg-amber-500/10 rounded-md"><CalendarClock className="w-4 h-4 text-amber-600" /></div>
                  Upcoming Hearings
                </h3>
                <button onClick={() => navigate("/hearings")} className="text-xs font-medium text-muted-foreground hover:text-foreground flex items-center">
                  View all <ChevronRight className="w-3 h-3 ml-0.5" />
                </button>
              </div>
              <div className="space-y-3">
                {upcomingHearings.map((h: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors border border-border/50">
                    <div>
                      <p className="text-sm font-semibold text-foreground line-clamp-1">{h.purpose || h.cases?.[0]?.title || "Hearing"}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{h.court_name || "Court TBD"}</p>
                    </div>
                    <span className="text-xs font-semibold text-amber-600 bg-amber-500/10 px-2.5 py-1 rounded-md whitespace-nowrap">
                      {format(new Date(h.hearing_date), "MMM d, h:mm a")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {overdueInvoices.length > 0 && (
            <div className="bg-card border border-rose-500/20 shadow-sm rounded-xl p-5 overflow-hidden relative">
              <div className="absolute left-0 top-0 w-1 h-full bg-rose-500" />
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <div className="p-1.5 bg-rose-500/10 rounded-md"><AlertTriangle className="w-4 h-4 text-rose-600" /></div>
                  Overdue Invoices
                </h3>
                <button onClick={() => navigate("/invoices")} className="text-xs font-medium text-muted-foreground hover:text-foreground flex items-center">
                  View all <ChevronRight className="w-3 h-3 ml-0.5" />
                </button>
              </div>
              <div className="space-y-3">
                {overdueInvoices.map((inv: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors border border-border/50">
                    <div>
                      <p className="text-sm font-semibold text-foreground">#{inv.invoice_number}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{inv.clients?.name || "No client"}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-rose-600">
                        {CURRENCY}{Number(inv.total).toLocaleString(LOCALE, { minimumFractionDigits: 0 })}
                      </p>
                      <p className="text-[10px] uppercase font-semibold text-rose-500/70 mt-0.5">Due {inv.due_date}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(stat => (
          <div key={stat.label} className="bg-card border border-border shadow-sm rounded-xl p-5 hover:shadow-md transition-all group">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-1">{stat.label}</p>
                <h3 className="text-3xl font-bold text-foreground tracking-tight">{stat.value}</h3>
              </div>
              <div className={`p-2.5 rounded-xl ${stat.bg} group-hover:scale-110 transition-transform`}>
                <stat.icon className={`w-5 h-5 ${stat.color}`} strokeWidth={2.5} />
              </div>
            </div>
            <div className="flex items-center text-xs text-muted-foreground font-medium gap-1.5">
              <Users className="w-3.5 h-3.5 opacity-70" />
              <span className="text-2xl font-bold text-primary">{clientCount}</span>
              <span>associated clients</span>
            </div>
          </div>
        ))}
      </div>

      {/* Client Directory */}
      <div className="bg-card border border-border shadow-sm rounded-xl overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-border bg-muted/10">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-primary/10 rounded-md">
              <Users className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Client Directory</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{clientsList.length} registered clients</p>
            </div>
          </div>
          <button onClick={() => navigate("/clients")} className="text-xs font-medium text-muted-foreground hover:text-foreground flex items-center gap-0.5 transition-colors">
            View all <ChevronRight className="w-3 h-3" />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 border-b border-border">
              <tr>
                <th className="text-left py-3 px-5 text-[11px] font-bold text-muted-foreground uppercase tracking-widest">#</th>
                <th className="text-left py-3 px-5 text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Name</th>
                <th className="text-left py-3 px-5 text-[11px] font-bold text-muted-foreground uppercase tracking-widest hidden sm:table-cell">Email</th>
                <th className="text-left py-3 px-5 text-[11px] font-bold text-muted-foreground uppercase tracking-widest hidden md:table-cell">Phone</th>
                <th className="text-left py-3 px-5 text-[11px] font-bold text-muted-foreground uppercase tracking-widest hidden lg:table-cell">Location</th>
              </tr>
            </thead>
            <tbody>
              {(clientsList.length > 0 ? clientsList.slice(0, 8) : []).map((client: any, i: number) => (
                <tr key={client.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => navigate("/clients")}>
                  <td className="py-3.5 px-5 text-muted-foreground font-mono text-xs">{i + 1}</td>
                  <td className="py-3.5 px-5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                        {client.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-semibold text-foreground">{client.name}</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-5 text-muted-foreground hidden sm:table-cell">{client.email}</td>
                  <td className="py-3.5 px-5 text-foreground font-medium hidden md:table-cell">{client.phone}</td>
                  <td className="py-3.5 px-5 hidden lg:table-cell">
                    <span className="text-foreground font-medium">{client.city}</span>
                    <span className="text-muted-foreground text-xs ml-1">({client.state})</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Main Charts & Quick Actions Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left Column: Charts */}
        <div className="lg:col-span-2 space-y-6">
          {/* Advice Analytics */}
          <div className="bg-card border border-border shadow-sm rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-base font-semibold text-foreground">Advice Trajectory</h3>
                <p className="text-xs text-muted-foreground mt-1">Monthly legal advice provided over time.</p>
              </div>
              <div className="text-right">
                <span className="text-2xl font-bold text-foreground">{adviceStats.thisMonth}</span>
                <p className="text-xs font-semibold text-emerald-500 uppercase tracking-wider mt-0.5">This Month</p>
              </div>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={adviceStats.chart} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} dy={10} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "8px", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                    itemStyle={{ color: "hsl(var(--foreground))", fontWeight: 600 }}
                  />
                  <Line type="monotone" dataKey="value" name="Advice Given" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 4, fill: "hsl(var(--primary))", strokeWidth: 2, stroke: "hsl(var(--background))" }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Case Status Distribution */}
            <div className="bg-card border border-border shadow-sm rounded-xl p-6">
              <h3 className="text-sm font-semibold text-foreground mb-1">Case Status</h3>
              <p className="text-xs text-muted-foreground mb-4">Distribution of current cases.</p>
              <div className="h-48 relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={75} paddingAngle={4} dataKey="value" stroke="none">
                      {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "8px" }} itemStyle={{ fontWeight: 600 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-2xl font-bold text-foreground">{caseCounts.total}</span>
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase">Total</span>
                </div>
              </div>
            </div>

            {/* Cases Growth */}
            <div className="bg-card border border-border shadow-sm rounded-xl p-6">
              <h3 className="text-sm font-semibold text-foreground mb-1">Cases Created</h3>
              <p className="text-xs text-muted-foreground mb-4">Monthly case intake volume.</p>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={casesChart} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} dy={10} />
                    <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{ fill: "hsl(var(--muted))" }} contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "8px" }} />
                    <Bar dataKey="value" name="Cases" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Actions & Activity */}
        <div className="space-y-6">

          {/* Quick Actions Panel */}
          <div className="bg-card border border-border shadow-sm rounded-xl overflow-hidden">
            <div className="p-5 border-b border-border bg-muted/20">
              <h3 className="text-sm font-semibold text-foreground">Quick Access</h3>
            </div>
            <div className="grid grid-cols-2 p-2">
              {quickActions.map(action => (
                <button
                  key={action.label}
                  onClick={() => navigate(action.path)}
                  className="flex flex-col items-center justify-center gap-2 p-4 rounded-lg hover:bg-muted/50 transition-colors text-center group"
                >
                  <div className="w-10 h-10 rounded-full bg-primary/5 group-hover:bg-primary/10 flex items-center justify-center transition-colors">
                    <action.icon className="w-4 h-4 text-primary" />
                  </div>
                  <span className="text-xs font-medium text-foreground">{action.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Hearing Summary Card */}
          <div className="bg-gradient-to-br from-primary to-blue-700 rounded-xl p-6 text-primary-foreground shadow-md relative overflow-hidden">
            <div className="absolute right-0 top-0 opacity-10 translate-x-1/4 -translate-y-1/4">
              <Scale className="w-32 h-32" />
            </div>
            <div className="relative z-10">
              <h3 className="text-sm font-semibold text-primary-foreground/80 uppercase tracking-widest mb-1">Hearings Overview</h3>
              <p className="text-4xl font-bold mt-2">{hearingData.total}</p>
              <div className="mt-6 pt-5 border-t border-primary-foreground/20">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-semibold">Today's Docket</h4>
                    <p className="text-xs opacity-80 mt-1">
                      {hearingData.today ? `${hearingData.today} hearing(s) scheduled` : "No hearings scheduled"}
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-primary-foreground/20 flex items-center justify-center backdrop-blur-sm">
                    <Scale className="w-5 h-5" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          {recentActivity.length > 0 && (
            <div className="bg-card border border-border shadow-sm rounded-xl p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" /> Recent Activity
              </h3>
              <div className="space-y-4">
                {recentActivity.map((item, i) => (
                  <div key={i} className="flex gap-3 relative">
                    {i !== recentActivity.length - 1 && (
                      <div className="absolute left-1.5 top-6 bottom-[-16px] w-[2px] bg-border" />
                    )}
                    <div className="w-3 h-3 rounded-full bg-primary ring-4 ring-primary/20 mt-1.5 shrink-0 z-10" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground leading-snug">{item.label}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-primary">{item.type}</span>
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          • {formatDistanceToNow(new Date(item.time), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={() => navigate("/cases")} className="w-full mt-5 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors">
                View Full History
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
