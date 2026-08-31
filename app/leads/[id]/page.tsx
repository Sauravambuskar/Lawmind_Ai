import Link from "next/link";
import { notFound } from "next/navigation";
import { getLead } from "@/lib/database";
import { TemperatureBadge } from "@/components/StatusBadge";
import { SCORING_FACTORS } from "@/lib/scoring";
import { OutreachPanel } from "@/components/OutreachPanel";

export const dynamic = "force-dynamic";

function BoolPill({ label, value }: { label: string; value: boolean | null }) {
  const text = value === null ? "Unknown" : value ? "Yes" : "No";
  const style =
    value === null
      ? "bg-slate-100 text-slate-500"
      : value
        ? "bg-emerald-50 text-emerald-700"
        : "bg-red-50 text-red-700";
  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
      <span className="text-sm text-slate-600">{label}</span>
      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${style}`}>{text}</span>
    </div>
  );
}

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lead = getLead(id);
  if (!lead) notFound();

  const services: string[] = JSON.parse(lead.services_json || "[]");

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div>
        <Link href="/leads" className="text-xs font-medium text-blue-600 hover:underline">
          ← Leads
        </Link>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">{lead.business_name ?? "Unknown business"}</h1>
            <a
              href={lead.website}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-block text-sm text-blue-600 hover:underline"
            >
              {lead.website}
            </a>
          </div>
          <div className="flex items-center gap-3">
            <TemperatureBadge temperature={lead.lead_temperature} />
            <div className="text-right">
              <p className="text-3xl font-semibold text-slate-900">{lead.lead_score}</p>
              <p className="text-xs text-slate-400">Lead Score</p>
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-5">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Industry</p>
            <p className="text-sm text-slate-800">{lead.industry ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Location</p>
            <p className="text-sm text-slate-800">{lead.location ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Email</p>
            <p className="text-sm text-slate-800">{lead.email ?? "Not found"}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Phone</p>
            <p className="text-sm text-slate-800">{lead.phone ?? "Not found"}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">WhatsApp</p>
            <p className="text-sm text-slate-800">{lead.whatsapp_number ?? "Not found"}</p>
          </div>
        </div>

        {lead.description && <p className="mt-6 text-sm text-slate-600">{lead.description}</p>}

        {services.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {services.map((s) => (
              <span
                key={s}
                className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600"
              >
                {s}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Why this is a lead</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">{lead.reason || "No reasoning available."}</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Why should I contact this business?</h2>
        <p className="mt-2 text-sm font-medium text-blue-700">{lead.opportunity || "No opportunity identified."}</p>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Outreach</h2>
        <OutreachPanel leadId={lead.id} leadEmail={lead.email} />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">Website Analysis</h2>
        <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Website Quality</p>
            <p className="text-sm text-slate-800">{lead.website_quality_score ?? "—"} / 100</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Mobile Experience</p>
            <p className="text-sm capitalize text-slate-800">{lead.mobile_experience ?? "unknown"}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Recommended Service</p>
            <p className="text-sm text-slate-800">
              {lead.needs_redesign && lead.needs_seo
                ? "Website Redesign + SEO"
                : lead.needs_redesign
                  ? "Website Redesign"
                  : lead.needs_seo
                    ? "SEO"
                    : "General digital consult"}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <BoolPill label="Online Booking" value={boolFromInt(lead.has_online_booking)} />
          <BoolPill label="Online Ordering" value={boolFromInt(lead.has_online_ordering)} />
          <BoolPill label="Contact Form" value={boolFromInt(lead.has_contact_form)} />
          <BoolPill label="WhatsApp" value={boolFromInt(lead.has_whatsapp)} />
          <BoolPill label="Needs Redesign" value={boolFromInt(lead.needs_redesign)} />
          <BoolPill label="Needs SEO" value={boolFromInt(lead.needs_seo)} />
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Scoring Rubric (0-100)</h2>
        <ul className="grid grid-cols-1 gap-1.5 text-sm text-slate-600 sm:grid-cols-2">
          {SCORING_FACTORS.map((f) => (
            <li key={f.label} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-1.5">
              <span>{f.label}</span>
              <span className="font-medium text-slate-800">+{f.points}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-slate-400">
          Source page: <a className="text-blue-600 hover:underline" href={lead.source_url}>{lead.source_url}</a>
        </p>
      </div>
    </div>
  );
}

function boolFromInt(v: unknown): boolean | null {
  if (v === null || v === undefined) return null;
  return Boolean(v);
}
