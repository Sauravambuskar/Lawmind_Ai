"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ProgressPanel } from "@/components/ProgressPanel";
import { LeadTable } from "@/components/LeadTable";
import type { Campaign } from "@/types/campaign";
import type { Lead } from "@/types/lead";

const ACTIVE_STATUSES = new Set(["pending", "searching", "scraping", "analyzing"]);

export default function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    async function poll() {
      try {
        const res = await fetch(`/api/campaigns/${id}`, { cache: "no-store" });
        if (res.status === 404) {
          if (!cancelled) setNotFound(true);
          return;
        }
        const json = await res.json();
        if (cancelled) return;
        setCampaign(json.campaign);
        setLeads(json.leads);
        if (ACTIVE_STATUSES.has(json.campaign.status)) {
          timer = setTimeout(poll, 1500);
        }
      } catch {
        if (!cancelled) timer = setTimeout(poll, 3000);
      }
    }

    poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [id]);

  if (notFound) {
    return (
      <div className="mx-auto max-w-6xl">
        <p className="text-sm text-slate-500">Campaign not found.</p>
        <Link href="/campaigns" className="mt-2 inline-block text-sm text-blue-600 hover:underline">
          Back to campaigns
        </Link>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="mx-auto max-w-6xl">
        <p className="text-sm text-slate-500">Loading campaign...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/campaigns" className="text-xs font-medium text-blue-600 hover:underline">
            ← Campaigns
          </Link>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">{campaign.name}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {campaign.industry} · {campaign.location} · Target {campaign.target_count} leads
          </p>
        </div>
        {leads.length > 0 && (
          <a
            href={`/api/export/${campaign.id}`}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            Export CSV
          </a>
        )}
      </div>

      <ProgressPanel campaign={campaign} />

      <div>
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Leads ({leads.length})</h2>
        <LeadTable leads={leads} />
      </div>
    </div>
  );
}
