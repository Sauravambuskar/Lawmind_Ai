"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Lead } from "@/types/lead";
import { TemperatureBadge } from "@/components/StatusBadge";

type SortKey = "lead_score" | "whatsapp";
type SortDir = "asc" | "desc";

function hasWhatsApp(lead: Lead): boolean {
  return Boolean(lead.whatsapp_number) || lead.has_whatsapp === 1;
}

function SortableHeader({
  label,
  sortableKey,
  sortKey,
  sortDir,
  onToggle,
}: {
  label: string;
  sortableKey: SortKey;
  sortKey: SortKey;
  sortDir: SortDir;
  onToggle: (key: SortKey) => void;
}) {
  const active = sortKey === sortableKey;
  return (
    <button
      type="button"
      onClick={() => onToggle(sortableKey)}
      className={`flex items-center gap-1 whitespace-nowrap text-xs font-semibold uppercase tracking-wide ${
        active ? "text-blue-700" : "text-slate-500"
      }`}
    >
      {label}
      <span className="text-[10px]">{active ? (sortDir === "desc" ? "▼" : "▲") : ""}</span>
    </button>
  );
}

export function LeadTable({ leads }: { leads: Lead[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("lead_score");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [whatsappOnly, setWhatsappOnly] = useState(false);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const visibleLeads = useMemo(() => {
    const filtered = whatsappOnly ? leads.filter(hasWhatsApp) : leads;
    const sorted = [...filtered].sort((a, b) => {
      let cmp: number;
      if (sortKey === "whatsapp") {
        cmp = Number(hasWhatsApp(a)) - Number(hasWhatsApp(b));
      } else {
        cmp = a.lead_score - b.lead_score;
      }
      return sortDir === "desc" ? -cmp : cmp;
    });
    return sorted;
  }, [leads, sortKey, sortDir, whatsappOnly]);

  const whatsappCount = useMemo(() => leads.filter(hasWhatsApp).length, [leads]);

  if (leads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center">
        <p className="text-sm font-medium text-slate-900">No leads yet</p>
        <p className="mt-1 text-sm text-slate-500">Run a campaign to start discovering leads.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={whatsappOnly}
            onChange={(e) => setWhatsappOnly(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          Only show leads with WhatsApp ({whatsappCount})
        </label>
        <p className="text-xs text-slate-400">
          Click &ldquo;Lead Score&rdquo; or &ldquo;WhatsApp&rdquo; column headers to sort.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Business
                </th>
                <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Website
                </th>
                <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Location
                </th>
                <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Industry
                </th>
                <th className="whitespace-nowrap px-4 py-3 text-left">
                  <SortableHeader
                    label="Lead Score"
                    sortableKey="lead_score"
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onToggle={toggleSort}
                  />
                </th>
                <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Temperature
                </th>
                <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Opportunity
                </th>
                <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Website Score
                </th>
                <th className="whitespace-nowrap px-4 py-3 text-left">
                  <SortableHeader
                    label="WhatsApp"
                    sortableKey="whatsapp"
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onToggle={toggleSort}
                  />
                </th>
                <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleLeads.map((lead) => (
                <tr key={lead.id} className="hover:bg-slate-50">
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-slate-900">
                    {lead.business_name ?? "Unknown"}
                  </td>
                  <td className="max-w-[220px] truncate px-4 py-3 text-sm text-blue-600">
                    <a href={lead.website} target="_blank" rel="noreferrer" className="hover:underline">
                      {lead.website.replace(/^https?:\/\//, "")}
                    </a>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">{lead.location ?? "—"}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">{lead.industry ?? "—"}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-semibold text-slate-900">{lead.lead_score}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <TemperatureBadge temperature={lead.lead_temperature} />
                  </td>
                  <td className="max-w-[240px] truncate px-4 py-3 text-sm text-slate-600">{lead.opportunity ?? "—"}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">
                    {lead.website_quality_score ?? "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm">
                    {lead.whatsapp_number ? (
                      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                        {lead.whatsapp_number}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm">
                    <Link href={`/leads/${lead.id}`} className="font-medium text-blue-600 hover:underline">
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
