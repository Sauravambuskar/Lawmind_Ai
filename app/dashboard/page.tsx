import Link from "next/link";
import { getStats, listCampaigns, listLeads } from "@/lib/database";
import { StatsCards } from "@/components/StatsCards";
import { LeadCard } from "@/components/LeadCard";
import { StatusBadge } from "@/components/StatusBadge";

export const dynamic = "force-dynamic";

export default function DashboardPage() {
  const stats = getStats();
  const recentLeads = listLeads().slice(0, 6);
  const recentCampaigns = listCampaigns().slice(0, 5);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">
            Overview of your lead generation activity.
          </p>
        </div>
        <Link
          href="/campaigns"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
        >
          New Campaign
        </Link>
      </div>

      <StatsCards stats={stats} />

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Recent Leads</h2>
          <Link href="/leads" className="text-sm font-medium text-blue-600 hover:underline">
            View all
          </Link>
        </div>
        {recentLeads.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center">
            <p className="text-sm font-medium text-slate-900">No leads yet</p>
            <p className="mt-1 text-sm text-slate-500">Start a campaign to discover your first leads.</p>
            <Link
              href="/campaigns"
              className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Find Leads
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recentLeads.map((lead) => (
              <LeadCard key={lead.id} lead={lead} />
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Recent Campaigns</h2>
          <Link href="/campaigns" className="text-sm font-medium text-blue-600 hover:underline">
            View all
          </Link>
        </div>
        {recentCampaigns.length === 0 ? (
          <p className="text-sm text-slate-500">No campaigns yet.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <ul className="divide-y divide-slate-100">
              {recentCampaigns.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/campaigns/${c.id}`}
                    className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-slate-50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">{c.name}</p>
                      <p className="truncate text-xs text-slate-500">
                        {c.industry} · {c.location}
                      </p>
                    </div>
                    <StatusBadge status={c.status} />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
