import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Search, Filter, ShieldAlert, History } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useMinLoader } from "@/hooks/useMinLoader";
import { PageLoader } from "@/components/PageLoader";
import { TablePagination } from "@/components/TablePagination";
import { usePagination } from "@/hooks/usePagination";

export default function AuditLogsPage() {
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [tableFilter, setTableFilter] = useState("all");

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["audit_logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*, profiles(full_name, email)")
        .order("created_at", { ascending: false })
        .limit(1000);
      
      if (error) {
        if (error.code === "PGRST205") return []; // Table doesn't exist
        throw error;
      }
      return data || [];
    },
  });

  const showLoader = useMinLoader(isLoading);
  if (showLoader) return <PageLoader />;

  // Extract unique tables for the filter
  const tables = Array.from(new Set(logs.map(l => l.table_name))).sort();

  const filteredLogs = logs
    .filter(l => 
      (l.table_name || "").toLowerCase().includes(search.toLowerCase()) || 
      (l.record_id || "").toLowerCase().includes(search.toLowerCase()) ||
      ((l as any).profiles?.full_name || "").toLowerCase().includes(search.toLowerCase())
    )
    .filter(l => actionFilter === "all" || l.action === actionFilter)
    .filter(l => tableFilter === "all" || l.table_name === tableFilter);

  const { paginatedItems, currentPage, totalPages, totalItems, startIndex, nextPage, prevPage, goToPage } = usePagination(filteredLogs, 15);

  const actionColor = (action: string) => {
    switch (action) {
      case "insert": return "bg-green-500/10 text-green-600 border-green-500/20";
      case "update": return "bg-blue-500/10 text-blue-600 border-blue-500/20";
      case "delete": return "bg-red-500/10 text-red-600 border-red-500/20";
      default: return "bg-muted text-muted-foreground border-border";
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader title="System Audit Logs" breadcrumbs={[{ label: "Setup" }, { label: "Audit Logs" }]} />

      <div className="bg-card border border-border shadow-sm rounded-xl overflow-hidden">
        {/* Header Toolbar */}
        <div className="p-5 border-b border-border bg-muted/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 rounded-xl">
              <ShieldAlert className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground">Activity Security Log</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Track system inserts, updates, and deletes.</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-[130px] h-9 shadow-sm bg-background">
                <SelectValue placeholder="Action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                <SelectItem value="insert">Insert</SelectItem>
                <SelectItem value="update">Update</SelectItem>
                <SelectItem value="delete">Delete</SelectItem>
              </SelectContent>
            </Select>

            <Select value={tableFilter} onValueChange={setTableFilter}>
              <SelectTrigger className="w-[150px] h-9 shadow-sm bg-background">
                <SelectValue placeholder="Table" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tables</SelectItem>
                {tables.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search logs..." className="pl-9 w-full sm:w-64 h-9 bg-background shadow-sm" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
        </div>

        {/* Logs Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left py-4 px-6 font-semibold text-muted-foreground whitespace-nowrap w-48">Timestamp</th>
                <th className="text-left py-4 px-6 font-semibold text-muted-foreground">User</th>
                <th className="text-left py-4 px-6 font-semibold text-muted-foreground">Action</th>
                <th className="text-left py-4 px-6 font-semibold text-muted-foreground">Table</th>
                <th className="text-left py-4 px-6 font-semibold text-muted-foreground">Record ID</th>
                <th className="text-left py-4 px-6 font-semibold text-muted-foreground">Details</th>
              </tr>
            </thead>
            <tbody>
              {paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <History className="w-8 h-8 text-muted-foreground/30" />
                      <p>No audit logs found matching your criteria</p>
                    </div>
                  </td>
                </tr>
              ) : paginatedItems.map(log => (
                <tr key={log.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="py-3 px-6 text-xs text-muted-foreground whitespace-nowrap">
                    {format(new Date(log.created_at), "MMM d, yyyy h:mm:ss a")}
                  </td>
                  <td className="py-3 px-6 font-medium text-foreground text-xs">
                    {(log as any).profiles?.full_name || "System/Unknown"}
                    <div className="text-[10px] text-muted-foreground font-normal">{(log as any).profiles?.email}</div>
                  </td>
                  <td className="py-3 px-6">
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${actionColor(log.action)}`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="py-3 px-6 font-mono text-xs font-medium text-primary/80">
                    {log.table_name}
                  </td>
                  <td className="py-3 px-6 font-mono text-xs text-muted-foreground">
                    {log.record_id ? (log.record_id.length > 8 ? `${log.record_id.substring(0, 8)}...` : log.record_id) : "—"}
                  </td>
                  <td className="py-3 px-6">
                    <div className="text-xs max-w-xs truncate text-muted-foreground" title={JSON.stringify(log.new_data || log.old_data)}>
                      {log.new_data ? JSON.stringify(log.new_data) : log.old_data ? JSON.stringify(log.old_data) : "—"}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-4 border-t border-border bg-muted/10">
          <TablePagination currentPage={currentPage} totalPages={totalPages} totalItems={totalItems} startIndex={startIndex} pageSize={15} onPrev={prevPage} onNext={nextPage} onGoTo={goToPage} />
        </div>
      </div>
    </div>
  );
}
