import { useMutation, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Database,
  FileText,
  Gavel,
  RefreshCw,
  Scale,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  getECourtsSyncLogs,
  isValidCnr,
  normalizeCnr,
  syncCaseWithECourts,
  type ECourtsChange,
  type ECourtsSnapshot,
  type ECourtsSyncLog,
} from "@/lib/ecourts";

type Props = {
  caseData: Record<string, any> & { id: string; cnr_number?: string | null };
  userId: string;
  queryClient: any;
};

function safeDate(value: string | null | undefined, includeTime = false): string {
  if (!value) return "--";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return format(parsed, includeTime ? "dd MMM yyyy, hh:mm a" : "dd MMM yyyy");
}

function display(value: string | number | null | undefined): string {
  if (value === null || typeof value === "undefined" || value === "") return "--";
  return String(value);
}

function statusTone(status: string | null | undefined): string {
  const normalized = String(status || "").toUpperCase();
  if (["DISPOSED", "DISMISSED", "CLOSED"].includes(normalized)) {
    return "border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300";
  }
  if (normalized === "PENDING") {
    return "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300";
  }
  return "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-300";
}

function SummaryCard({ label, value, icon: Icon }: { label: string; value: string; icon: any }) {
  return (
    <div className="rounded-xl border border-border bg-muted/15 p-4">
      <div className="mb-2 flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

function ChangeItem({ change }: { change: ECourtsChange }) {
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <p className="text-xs font-bold text-foreground">{change.label}</p>
      {change.field === "initial_sync" ? (
        <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">{change.newValue}</p>
      ) : (
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded bg-rose-500/10 px-2 py-1 text-rose-700 line-through dark:text-rose-300">
            {change.oldValue || "Empty"}
          </span>
          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="rounded bg-emerald-500/10 px-2 py-1 font-semibold text-emerald-700 dark:text-emerald-300">
            {change.newValue || "Empty"}
          </span>
        </div>
      )}
    </div>
  );
}

function LatestSnapshot({ snapshot }: { snapshot: ECourtsSnapshot }) {
  const orders = [...snapshot.judgmentOrders, ...snapshot.interimOrders]
    .sort((a, b) => String(b.orderDate || "").localeCompare(String(a.orderDate || "")))
    .slice(0, 8);
  const hearings = [...snapshot.historyOfCaseHearings]
    .sort((a, b) => String(b.businessOnDate || b.hearingDate || "").localeCompare(String(a.businessOnDate || a.hearingDate || "")))
    .slice(0, 10);

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Next hearing" value={safeDate(snapshot.nextHearingDate)} icon={CalendarDays} />
        <SummaryCard label="Last hearing" value={safeDate(snapshot.lastHearingDate)} icon={Clock3} />
        <SummaryCard label="Hearing purpose" value={display(snapshot.purpose)} icon={Gavel} />
        <SummaryCard label="Court" value={display(snapshot.courtName)} icon={Scale} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Hearings" value={String(snapshot.hearingCount)} icon={CalendarDays} />
        <SummaryCard label="Orders" value={String(snapshot.orderCount)} icon={FileText} />
        <SummaryCard label="Judgments" value={String(snapshot.judgmentCount)} icon={Gavel} />
        <SummaryCard label="Decision date" value={safeDate(snapshot.decisionDate)} icon={CheckCircle2} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-xl border border-border">
          <div className="border-b border-border px-4 py-3">
            <h4 className="text-sm font-bold">Official hearing history</h4>
            <p className="text-xs text-muted-foreground">Latest court entries received from eCourts</p>
          </div>
          <div className="max-h-[420px] divide-y divide-border overflow-y-auto">
            {hearings.length ? hearings.map((hearing, index) => (
              <div key={`${hearing.businessOnDate}-${hearing.hearingDate}-${index}`} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{hearing.purposeOfListing || "Court hearing"}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{hearing.judge || "Judge not listed"}</p>
                  </div>
                  <span className="shrink-0 text-xs font-medium text-muted-foreground">
                    {safeDate(hearing.businessOnDate || hearing.hearingDate)}
                  </span>
                </div>
                {hearing.hearingDate && hearing.hearingDate !== hearing.businessOnDate && (
                  <p className="mt-2 text-xs text-primary">Next date: {safeDate(hearing.hearingDate)}</p>
                )}
              </div>
            )) : <p className="p-6 text-center text-sm text-muted-foreground">No hearing history returned</p>}
          </div>
        </section>

        <section className="rounded-xl border border-border">
          <div className="border-b border-border px-4 py-3">
            <h4 className="text-sm font-bold">Orders and judgments</h4>
            <p className="text-xs text-muted-foreground">Latest order references on the case</p>
          </div>
          <div className="max-h-[420px] divide-y divide-border overflow-y-auto">
            {orders.length ? orders.map((order, index) => (
              <div key={`${order.orderUrl}-${index}`} className="flex items-center gap-3 p-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <FileText className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{order.description || order.orderType || "Court order"}</p>
                  <p className="text-xs text-muted-foreground">{order.orderUrl || "Order file"}</p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">{safeDate(order.orderDate)}</span>
              </div>
            )) : <p className="p-6 text-center text-sm text-muted-foreground">No orders returned</p>}
          </div>
        </section>
      </div>
    </div>
  );
}

function ChangeTimeline({ logs }: { logs: ECourtsSyncLog[] }) {
  return (
    <section className="rounded-xl border border-border">
      <div className="border-b border-border px-4 py-3">
        <h4 className="text-sm font-bold">Status change timeline</h4>
        <p className="text-xs text-muted-foreground">When a change was detected and exactly what changed</p>
      </div>
      <div className="max-h-[560px] space-y-4 overflow-y-auto p-4">
        {logs.length ? logs.map((log) => {
          const changes = log.new_data?.changes || [];
          return (
            <div key={log.id} className="relative border-l-2 border-primary/25 pl-5">
              <span className="absolute -left-[7px] top-1 h-3 w-3 rounded-full border-2 border-primary bg-background" />
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-bold text-foreground">{safeDate(log.created_at, true)}</p>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
                  {changes.length ? `${changes.length} change${changes.length === 1 ? "" : "s"}` : "No change"}
                </span>
              </div>
              {changes.length ? (
                <div className="space-y-2">{changes.map((change, index) => <ChangeItem key={`${change.field}-${index}`} change={change} />)}</div>
              ) : (
                <p className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
                  Refresh completed; no tracked court field changed.
                </p>
              )}
            </div>
          );
        }) : <p className="py-8 text-center text-sm text-muted-foreground">No eCourts sync history yet</p>}
      </div>
    </section>
  );
}

export function ECourtsCasePanel({ caseData, userId, queryClient }: Props) {
  const caseId = String(caseData.id);
  const cnr = normalizeCnr(caseData.cnr_number);
  const validCnr = isValidCnr(cnr);
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["ecourts-sync-logs", caseId],
    queryFn: () => getECourtsSyncLogs(caseId),
    enabled: Boolean(caseId),
  });

  const syncMutation = useMutation({
    mutationFn: () => syncCaseWithECourts(caseData, userId),
    onSuccess: ({ changes }) => {
      queryClient.invalidateQueries({ queryKey: ["case-detail", caseId] });
      queryClient.invalidateQueries({ queryKey: ["cases"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-cases"] });
      queryClient.invalidateQueries({ queryKey: ["ecourts-sync-logs", caseId] });
      toast.success(changes[0]?.field === "initial_sync"
        ? "eCourts tracking started"
        : changes.length
          ? `${changes.length} court update${changes.length === 1 ? "" : "s"} detected`
          : "Case is already up to date");
    },
    onError: (error: unknown) => toast.error(error instanceof Error ? error.message : "eCourts refresh failed"),
  });

  const latestSnapshot = logs[0]?.new_data?.snapshot;
  const latestSyncAt = logs[0]?.created_at;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 rounded-xl border border-primary/20 bg-primary/[0.03] p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Database className="h-5 w-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-bold text-foreground">eCourts Live Status</h3>
              {latestSnapshot?.caseStatus && (
                <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase ${statusTone(latestSnapshot.caseStatus)}`}>
                  {latestSnapshot.caseStatus}
                </span>
              )}
            </div>
            <p className="mt-1 font-mono text-xs text-muted-foreground">CNR: {cnr || "Not added"}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {latestSyncAt ? `Last checked ${safeDate(latestSyncAt, true)}` : "Refresh once to start tracking future court changes."}
            </p>
          </div>
        </div>
        <Button onClick={() => syncMutation.mutate()} disabled={!validCnr || !userId || syncMutation.isPending} className="shrink-0">
          <RefreshCw className={`mr-2 h-4 w-4 ${syncMutation.isPending ? "animate-spin" : ""}`} />
          {syncMutation.isPending ? "Checking court..." : latestSyncAt ? "Refresh now" : "Start tracking"}
        </Button>
      </div>

      {!validCnr && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="text-sm font-bold">Valid CNR required</p>
            <p className="mt-1 text-xs">Edit this case and add its 16-character CNR number to enable live court refresh.</p>
          </div>
        </div>
      )}

      {syncMutation.isPending && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-700 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-300">
          eCourts is refreshing the official record. This normally takes 5-20 seconds; please keep this page open.
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground"><RefreshCw className="mr-2 h-4 w-4 animate-spin" />Loading eCourts history...</div>
      ) : latestSnapshot ? (
        <>
          <LatestSnapshot snapshot={latestSnapshot} />
          <ChangeTimeline logs={logs} />
        </>
      ) : validCnr ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
          <Database className="mb-3 h-12 w-12 text-muted-foreground/30" />
          <p className="font-semibold text-foreground">No court snapshot saved yet</p>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">Start tracking to fetch the current status and create a baseline for future change detection.</p>
        </div>
      ) : null}

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Change times show when LawMind detected an update. eCourtsIndia is a private data service, not a government website; verify critical information with the official court record.
      </p>
    </div>
  );
}
