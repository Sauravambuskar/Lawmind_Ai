import { NextResponse } from "next/server";
import { getLead } from "@/lib/database";
import { draftOpportunityEmail, GroqNotConfiguredError, GroqRequestError } from "@/lib/groq";
import type { EmailDraft } from "@/types/lead";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lead = getLead(id);
  if (!lead) {
    return NextResponse.json({ error: "Lead not found." }, { status: 404 });
  }

  try {
    const { subject, body } = await draftOpportunityEmail({
      businessName: lead.business_name,
      website: lead.website,
      location: lead.location,
      industry: lead.industry,
      opportunity: lead.opportunity ?? "",
      reason: lead.reason ?? "",
      whatsappNumber: lead.whatsapp_number,
      phone: lead.phone,
      email: lead.email,
    });
    const draft: EmailDraft = { subject, body };
    return NextResponse.json({ draft });
  } catch (err) {
    if (err instanceof GroqNotConfiguredError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    if (err instanceof GroqRequestError) {
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
    return NextResponse.json({ error: "Failed to draft opportunity email." }, { status: 500 });
  }
}
