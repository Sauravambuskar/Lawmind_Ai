import { NextResponse } from "next/server";
import { getLead } from "@/lib/database";
import { draftWhatsAppMessage, GroqNotConfiguredError, GroqRequestError } from "@/lib/groq";
import type { WhatsAppDraft } from "@/types/lead";

/**
 * Lead phone/WhatsApp fields sometimes contain more than one number (e.g. two numbers
 * separated by "/"). Take only the first plausible number so we don't concatenate
 * multiple numbers into one invalid wa.me link.
 */
function firstPlausibleNumber(number: string | null): string | null {
  if (!number) return null;
  const match = number.match(/\+?[\d][\d\s\-().]{6,16}\d/);
  const candidate = (match ? match[0] : number).trim();
  const digitsOnly = candidate.replace(/[^\d]/g, "");
  if (digitsOnly.length < 8 || digitsOnly.length > 15) return null;
  return candidate;
}

function toWhatsAppLink(number: string | null, message: string): string | null {
  const candidate = firstPlausibleNumber(number);
  if (!candidate) return null;
  const digitsOnly = candidate.replace(/[^\d]/g, "");
  return `https://wa.me/${digitsOnly}?text=${encodeURIComponent(message)}`;
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lead = getLead(id);
  if (!lead) {
    return NextResponse.json({ error: "Lead not found." }, { status: 404 });
  }

  try {
    const message = await draftWhatsAppMessage({
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

    // Prefer the number Firecrawl+Groq identified specifically as a WhatsApp number;
    // fall back to the general phone number if that's all we have.
    const number = firstPlausibleNumber(lead.whatsapp_number) || firstPlausibleNumber(lead.phone);
    const draft: WhatsAppDraft = {
      message,
      whatsapp_number: number,
      whatsapp_link: toWhatsAppLink(number, message),
    };
    return NextResponse.json({ draft });
  } catch (err) {
    if (err instanceof GroqNotConfiguredError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    if (err instanceof GroqRequestError) {
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
    return NextResponse.json({ error: "Failed to draft WhatsApp message." }, { status: 500 });
  }
}
