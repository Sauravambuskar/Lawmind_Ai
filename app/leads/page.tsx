import { getStats, listLeads } from "@/lib/database";
import { StatsCards } from "@/components/StatsCards";
import { LeadTable } from "@/components/LeadTable";

export const dynamic = "force-dynamic";

export default function LeadsPage() {
  const leads = listLeads();
  const stats = getStats();

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Leads</h1>
        <p className="mt-1 text-sm text-slate-500">All leads discovered across every campaign.</p>
      </div>

      <StatsCards stats={stats} />

      <LeadTable leads={leads} />
    </div>
  );
}
