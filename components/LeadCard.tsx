import Link from "next/link";
import type { Lead } from "@/types/lead";
import { TemperatureBadge } from "@/components/StatusBadge";

export function LeadCard({ lead }: { lead: Lead }) {
  return (
    <Link
      href={`/leads/${lead.id}`}
      className="block rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">{lead.business_name ?? "Unknown business"}</p>
          <p className="truncate text-xs text-slate-500">{lead.website.replace(/^https?:\/\//, "")}</p>
        </div>
        <TemperatureBadge temperature={lead.lead_temperature} />
      </div>
      <p className="mt-3 line-clamp-2 text-sm text-slate-600">{lead.opportunity || "No opportunity summary yet."}</p>
      <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
        <span>{lead.location ?? "Unknown location"}</span>
        <span className="font-semibold text-slate-700">Score {lead.lead_score}</span>
      </div>
    </Link>
  );
}
