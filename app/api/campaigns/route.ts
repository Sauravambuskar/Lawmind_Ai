import { NextRequest, NextResponse } from "next/server";
import { createCampaign, listCampaigns } from "@/lib/database";
import { determineDemoMode, runCampaignPipeline } from "@/lib/pipeline";
import { createCampaignSchema } from "@/lib/validators";

export async function GET() {
  const campaigns = listCampaigns();
  return NextResponse.json({ campaigns });
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = createCampaignSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((i) => i.message).join(" ") },
      { status: 400 }
    );
  }

  const demoMode = await determineDemoMode();

  const campaign = createCampaign({
    id: crypto.randomUUID(),
    name: parsed.data.name,
    industry: parsed.data.industry,
    location: parsed.data.location,
    requirement: parsed.data.requirement,
    target_count: parsed.data.target_count,
    demo_mode: demoMode,
  });

  // Fire and forget - progress is polled via GET /api/campaigns/[id].
  runCampaignPipeline(campaign).catch(() => {
    // runCampaignPipeline already persists failures to the campaign row.
  });

  return NextResponse.json({ campaign }, { status: 201 });
}
