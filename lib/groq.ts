import Groq from "groq-sdk";
import type { AIExtractionResult } from "@/types/lead";

/**
 * All Groq calls live here and only ever run server-side. GROQ_API_KEY must never
 * reach client bundles - this module is only imported from route handlers / server code.
 */

const DEFAULT_MODEL = "llama-3.3-70b-versatile";

export class GroqNotConfiguredError extends Error {
  constructor() {
    super("Groq API key is missing. Set GROQ_API_KEY in your environment.");
    this.name = "GroqNotConfiguredError";
  }
}

export class GroqRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GroqRequestError";
  }
}

let client: Groq | null = null;

function getClient(): Groq {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new GroqNotConfiguredError();
  if (!client) client = new Groq({ apiKey });
  return client;
}

export function isGroqConfigured(): boolean {
  return Boolean(process.env.GROQ_API_KEY);
}

export function getGroqModel(): string {
  return process.env.GROQ_MODEL || DEFAULT_MODEL;
}

export async function checkGroqHealth(): Promise<{ ok: boolean; message: string }> {
  if (!isGroqConfigured()) {
    return { ok: false, message: "Groq API key is missing. Set GROQ_API_KEY in your environment." };
  }
  try {
    const groq = getClient();
    await groq.chat.completions.create({
      model: getGroqModel(),
      messages: [{ role: "user", content: "Reply with the single word: ok" }],
      max_tokens: 5,
    });
    return { ok: true, message: `Connected to Groq (model: ${getGroqModel()}).` };
  } catch (err) {
    return { ok: false, message: `Groq request failed: ${errMsg(err)}` };
  }
}

function errMsg(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

const SYSTEM_PROMPT = `You are a strict data extraction and B2B lead-qualification analyst.

You will be given the scraped Markdown content of a single business website, plus the
industry/location/requirement a sales user is searching for.

RULES (follow exactly):
1. Extract ONLY facts that are explicitly present in the provided content. NEVER invent,
   guess, or hallucinate an email, phone number, address, company name, service, price, or
   any other fact. If a field is not clearly supported by the content, set it to null
   (or false/"unknown" for boolean/enum fields as specified in the schema below).
2. Judge website quality, mobile-friendliness, SEO, and presence of features (booking,
   ordering, contact form, WhatsApp link) only from signals actually present in the
   Markdown (e.g. presence of a "Book Now" link/button, a <form>-like contact section,
   a wa.me/WhatsApp link, structure/length/freshness/quality of the copy). If content is
   too sparse to judge a signal, use "unknown" / false / null rather than guessing positively.
   If a WhatsApp click-to-chat link (wa.me/<number> or api.whatsapp.com/send?phone=<number>)
   or an explicit "WhatsApp: <number>" label appears, set "whatsapp_number" to that number
   normalized to E.164-ish form (leading "+", digits only after it). It may differ from
   "phone". If no WhatsApp-specific number is present, set it to null even if "phone" is set.
3. Score the lead 0-100 using this transparent rubric, additively, capped at 100. Only add
   points for signals you can actually support from the content:
   - Outdated-looking website / no modern design signals: +20
   - Poor or unknown mobile experience: +20
   - No clear call-to-action: +10
   - No online booking or ordering: +10
   - Poor or thin SEO/content signals: +10
   - No WhatsApp / no contact form: +10
   - Old-looking design (dated copyright year, legacy tech signals, etc.): +10
   - Business appears active/operating (recent content, working links, real info): +10
   Set "lead_score" to the resulting total (0-100), and briefly justify it in "reason" by
   naming which of the above factors applied.
4. Map lead_score to lead_temperature: 80-100 = "hot", 60-79 = "warm", 0-59 = "cold".
5. "opportunity" is a short (1-2 sentence) actionable sales angle, e.g. "Website Redesign + SEO".
6. "reason" is a short paragraph explaining, in plain language, why this business is/isn't a
   good lead for the stated requirement, citing the specific scoring factors that applied.
7. Return ONLY a single JSON object matching this exact schema, no prose, no markdown fences:

{
  "business_name": string | null,
  "website": string,
  "industry": string | null,
  "location": string | null,
  "email": string | null,
  "phone": string | null,
  "description": string | null,
  "services": string[],
  "website_quality_score": number,
  "mobile_experience": "good" | "average" | "poor" | "unknown",
  "has_online_booking": boolean | null,
  "has_online_ordering": boolean | null,
  "has_contact_form": boolean | null,
  "has_whatsapp": boolean | null,
  "whatsapp_number": string | null,
  "needs_redesign": boolean,
  "needs_seo": boolean,
  "lead_score": number,
  "lead_temperature": "hot" | "warm" | "cold",
  "opportunity": string,
  "reason": string
}`;

/** Truncate/chunk page content so we never send unbounded text to the model. */
export function prepareContentForAnalysis(markdown: string, maxChars = 8000): string {
  const cleaned = markdown
    .replace(/\n{3,}/g, "\n\n")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "") // strip image markdown, keeps token count down
    .trim();
  if (cleaned.length <= maxChars) return cleaned;
  // Keep the head (nav/hero/about, usually most informative) and a tail slice (footer/contact).
  const head = cleaned.slice(0, Math.floor(maxChars * 0.75));
  const tail = cleaned.slice(-Math.floor(maxChars * 0.2));
  return `${head}\n\n...[truncated]...\n\n${tail}`;
}

export interface ExtractionContext {
  websiteUrl: string;
  industry: string;
  location: string;
  requirement: string;
  pageTitle?: string | null;
}

export async function extractLeadFromContent(
  markdown: string,
  ctx: ExtractionContext
): Promise<AIExtractionResult> {
  const groq = getClient();
  const content = prepareContentForAnalysis(markdown);

  const userPrompt = `Search context:
- Industry the user is targeting: ${ctx.industry}
- Location the user is targeting: ${ctx.location}
- Lead requirement: ${ctx.requirement}

Website: ${ctx.websiteUrl}
Page title: ${ctx.pageTitle ?? "unknown"}

Scraped website content (Markdown, possibly truncated):
"""
${content}
"""

Analyze this content and return the JSON object described in your instructions.`;

  let raw: string;
  try {
    const completion = await groq.chat.completions.create({
      model: getGroqModel(),
      temperature: 0.2,
      max_tokens: 1200,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
    });
    raw = completion.choices[0]?.message?.content ?? "";
  } catch (err) {
    throw new GroqRequestError(`Groq request failed: ${errMsg(err)}`);
  }

  return parseExtraction(raw, ctx.websiteUrl);
}

function parseExtraction(raw: string, websiteUrl: string): AIExtractionResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new GroqRequestError("Groq returned malformed JSON for lead extraction.");
  }
  if (typeof parsed !== "object" || parsed === null) {
    throw new GroqRequestError("Groq returned an unexpected JSON shape for lead extraction.");
  }
  const p = parsed as Partial<AIExtractionResult>;

  const clampScore = (n: unknown): number => {
    const num = typeof n === "number" && Number.isFinite(n) ? n : 0;
    return Math.max(0, Math.min(100, Math.round(num)));
  };
  const leadScore = clampScore(p.lead_score);
  const temperature =
    leadScore >= 80 ? "hot" : leadScore >= 60 ? "warm" : "cold";

  return {
    business_name: nullableString(p.business_name),
    website: typeof p.website === "string" && p.website ? p.website : websiteUrl,
    industry: nullableString(p.industry),
    location: nullableString(p.location),
    email: nullableString(p.email),
    phone: nullableString(p.phone),
    description: nullableString(p.description),
    services: Array.isArray(p.services) ? p.services.filter((s) => typeof s === "string") : [],
    website_quality_score: clampScore(p.website_quality_score),
    mobile_experience: validMobileExperience(p.mobile_experience),
    has_online_booking: nullableBool(p.has_online_booking),
    has_online_ordering: nullableBool(p.has_online_ordering),
    has_contact_form: nullableBool(p.has_contact_form),
    has_whatsapp: nullableBool(p.has_whatsapp),
    whatsapp_number: nullableString(p.whatsapp_number),
    needs_redesign: Boolean(p.needs_redesign),
    needs_seo: Boolean(p.needs_seo),
    lead_score: leadScore,
    // Trust the deterministic mapping over whatever the model said, in case it drifted.
    lead_temperature: temperature,
    opportunity: typeof p.opportunity === "string" ? p.opportunity : "",
    reason: typeof p.reason === "string" ? p.reason : "",
  };
}

function nullableString(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function nullableBool(v: unknown): boolean | null {
  if (typeof v === "boolean") return v;
  return null;
}

function validMobileExperience(v: unknown): AIExtractionResult["mobile_experience"] {
  if (v === "good" || v === "average" || v === "poor" || v === "unknown") return v;
  return "unknown";
}

// ---------- Outreach drafting (WhatsApp DM + opportunity email) ----------
// These generate DRAFTS ONLY for a human to review and send manually (via wa.me / mailto
// links in the UI). This app never sends messages automatically - unsolicited automated
// WhatsApp/email outreach can violate platform terms and anti-spam law, so a human stays
// in the loop for every send.

export interface OutreachLeadContext {
  businessName: string | null;
  website: string;
  location: string | null;
  industry: string | null;
  opportunity: string;
  reason: string;
  whatsappNumber: string | null;
  phone: string | null;
  email: string | null;
}

function senderSignature(): { name: string; company: string; role: string; contact: string } {
  return {
    name: process.env.SENDER_NAME || "Your Name",
    company: process.env.SENDER_COMPANY || "Your Company",
    role: process.env.SENDER_ROLE || "Growth Consultant",
    contact: process.env.SENDER_CONTACT || "",
  };
}

const WHATSAPP_SYSTEM_PROMPT = `You write short, friendly, human-sounding WhatsApp outreach
messages for a B2B sales rep reaching out to a local business.

RULES:
- Only reference facts given to you (business name, location, opportunity, reason). Never
  invent details, prices, or claims about the business you weren't given.
- Keep it under 60 words, casual but professional, no emojis beyond at most one, no hard sell.
- Open with the business name if known, mention one specific, credible observation (from the
  "opportunity"/"reason" given), and end with a soft, low-pressure question inviting a reply
  (not a link, not a meeting demand).
- Sign off with the sender's first name only.
- Return ONLY the message text. No quotes, no markdown, no subject line.`;

export async function draftWhatsAppMessage(ctx: OutreachLeadContext): Promise<string> {
  const groq = getClient();
  const sender = senderSignature();
  const userPrompt = `Business name: ${ctx.businessName ?? "Unknown business"}
Location: ${ctx.location ?? "unknown"}
Opportunity: ${ctx.opportunity || "General digital consult"}
Why they're a fit: ${ctx.reason || "not specified"}
Sender first name: ${sender.name.split(" ")[0]}
Sender company: ${sender.company}

Write the WhatsApp message now.`;

  try {
    const completion = await groq.chat.completions.create({
      model: getGroqModel(),
      temperature: 0.5,
      max_tokens: 200,
      messages: [
        { role: "system", content: WHATSAPP_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
    });
    const text = completion.choices[0]?.message?.content?.trim();
    if (!text) throw new GroqRequestError("Groq returned an empty WhatsApp draft.");
    return text;
  } catch (err) {
    if (err instanceof GroqRequestError) throw err;
    throw new GroqRequestError(`Groq request failed: ${errMsg(err)}`);
  }
}

const EMAIL_SYSTEM_PROMPT = `You write short, warm, non-spammy B2B cold outreach emails
proposing a specific service to a local business, on behalf of a named sender.

RULES:
- Only reference facts you were given (business name, location, opportunity, reason). Never
  invent details, case studies, prices, or claims.
- Subject line: under 8 words, specific, no clickbait, no ALL CAPS, no excessive punctuation.
- Body: 100-150 words. Open by naming something specific and credible about their site/business
  (from "opportunity"/"reason"). Propose one clear next step (a short reply or a 15-minute call).
  No pressure tactics, no fake urgency, no generic filler.
- Sign off with the sender's name, role, and company exactly as given.
- Return ONLY a JSON object: {"subject": string, "body": string}. No markdown fences.`;

export async function draftOpportunityEmail(ctx: OutreachLeadContext): Promise<{ subject: string; body: string }> {
  const groq = getClient();
  const sender = senderSignature();
  const userPrompt = `Business name: ${ctx.businessName ?? "Unknown business"}
Website: ${ctx.website}
Location: ${ctx.location ?? "unknown"}
Industry: ${ctx.industry ?? "unknown"}
Opportunity: ${ctx.opportunity || "General digital consult"}
Why they're a fit: ${ctx.reason || "not specified"}

Sender name: ${sender.name}
Sender role: ${sender.role}
Sender company: ${sender.company}
Sender contact (include only if non-empty, otherwise omit a contact line): ${sender.contact}

Write the email now as the JSON object described in your instructions.`;

  let raw: string;
  try {
    const completion = await groq.chat.completions.create({
      model: getGroqModel(),
      temperature: 0.5,
      max_tokens: 500,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: EMAIL_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
    });
    raw = completion.choices[0]?.message?.content ?? "";
  } catch (err) {
    throw new GroqRequestError(`Groq request failed: ${errMsg(err)}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new GroqRequestError("Groq returned malformed JSON for the email draft.");
  }
  if (typeof parsed !== "object" || parsed === null) {
    throw new GroqRequestError("Groq returned an unexpected JSON shape for the email draft.");
  }
  const p = parsed as { subject?: unknown; body?: unknown };
  const subject = typeof p.subject === "string" && p.subject.trim() ? p.subject.trim() : "A quick idea for your website";
  const body = typeof p.body === "string" && p.body.trim() ? p.body.trim() : "";
  if (!body) throw new GroqRequestError("Groq returned an empty email body.");
  return { subject, body };
}
