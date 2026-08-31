import Link from "next/link";
import { listCampaigns } from "@/lib/database";
import { LeadForm } from "@/components/LeadForm";
import { StatusBadge } from "@/components/StatusBadge";

export const dynamic = "force-dynamic";

export default function CampaignsPage() {
  const campaigns = listCampaigns();

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Campaigns</h1>
        <p className="mt-1 text-sm text-slate-500">
          Describe the leads you want and we&apos;ll discover, scrape and score them.
        </p>
      </div>

      <LeadForm />

      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-900">All Campaigns</h2>
        {campaigns.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center">
            <p className="text-sm font-medium text-slate-900">No campaigns yet</p>
            <p className="mt-1 text-sm text-slate-500">Fill out the form above to run your first campaign.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    {["Campaign", "Industry", "Location", "Target", "Status", "Created", ""].map((h) => (
                      <th
                        key={h}
                        className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {campaigns.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-slate-900">{c.name}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">{c.industry}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">{c.location}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">{c.target_count}</td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <StatusBadge status={c.status} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-500">
                        {new Date(c.created_at).toLocaleString()}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm">
                        <Link href={`/campaigns/${c.id}`} className="font-medium text-blue-600 hover:underline">
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
