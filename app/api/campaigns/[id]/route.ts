import { NextResponse } from "next/server";
import { getCampaign, listLeads, listScrapeJobs } from "@/lib/database";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const campaign = getCampaign(id);
  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
  }
  const leads = listLeads(id);
  const scrapeJobs = listScrapeJobs(id);
  return NextResponse.json({ campaign, leads, scrapeJobs });
}
