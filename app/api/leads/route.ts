import { NextRequest, NextResponse } from "next/server";
import { getStats, listLeads } from "@/lib/database";

export async function GET(req: NextRequest) {
  const campaignId = req.nextUrl.searchParams.get("campaignId") ?? undefined;
  const leads = listLeads(campaignId);
  const stats = getStats();
  return NextResponse.json({ leads, stats });
}
