import { NextResponse } from "next/server";
import { getCampaign, listLeads } from "@/lib/database";
import type { Lead } from "@/types/lead";

const HEADERS = [
  "Business Name",
  "Website",
  "Industry",
  "Location",
  "Email",
  "Phone",
  "WhatsApp Number",
  "Website Score",
  "Lead Score",
  "Temperature",
  "Opportunity",
  "Reason",
];

function csvEscape(value: string | number | null | undefined): string {
  const str = value === null || value === undefined ? "" : String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function leadToRow(lead: Lead): string {
  return [
    lead.business_name,
    lead.website,
    lead.industry,
    lead.location,
    lead.email,
    lead.phone,
    lead.whatsapp_number,
    lead.website_quality_score,
    lead.lead_score,
    lead.lead_temperature,
    lead.opportunity,
    lead.reason,
  ]
    .map(csvEscape)
    .join(",");
}

export async function GET(_req: Request, { params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await params;
  const campaign = getCampaign(campaignId);
  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
  }
  const leads = listLeads(campaignId);
  const rows = [HEADERS.join(","), ...leads.map(leadToRow)];
  const csv = rows.join("\r\n");

  const filename = `${campaign.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "leads"}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
