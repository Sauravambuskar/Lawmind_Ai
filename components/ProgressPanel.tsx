import type { Campaign } from "@/types/campaign";
import { StatusBadge } from "@/components/StatusBadge";

const ACTIVE_STATUSES = new Set(["pending", "searching", "scraping", "analyzing"]);

export function ProgressPanel({ campaign }: { campaign: Campaign }) {
  const isActive = ACTIVE_STATUSES.has(campaign.status);
  const pct =
    campaign.progress_total > 0
      ? Math.min(100, Math.round((campaign.progress_current / campaign.progress_total) * 100))
      : campaign.status === "completed"
        ? 100
        : 0;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Pipeline Status</h2>
          <p className="mt-1 text-sm text-slate-500">{campaign.progress_message ?? "Waiting to start..."}</p>
        </div>
        <div className="flex items-center gap-2">
          {Boolean(campaign.demo_mode) && (
            <span className="inline-flex items-center rounded-full bg-purple-50 px-2.5 py-0.5 text-xs font-medium text-purple-700 ring-1 ring-inset ring-purple-600/20">
              Demo Mode
            </span>
          )}
          <StatusBadge status={campaign.status} />
        </div>
      </div>

      <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            campaign.status === "failed" ? "bg-red-500" : "bg-blue-600"
          } ${isActive ? "animate-pulse" : ""}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {campaign.progress_total > 0 && (
        <p className="mt-2 text-xs text-slate-400">
          {campaign.progress_current} / {campaign.progress_total} leads
        </p>
      )}

      {campaign.error && (
        <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-inset ring-red-600/20">
          {campaign.error}
        </div>
      )}
    </div>
  );
}
