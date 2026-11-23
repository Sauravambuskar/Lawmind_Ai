import { timingSafeEqual } from "crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getIntegrationSettings } from "./_integration-settings.js";
import { sendTemplateSms, serviceFetch } from "./_sms.js";

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function setPrivateHeaders(res: VercelResponse): void {
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  res.setHeader("X-Content-Type-Options", "nosniff");
}

function secureEqual(actual: string, expected: string): boolean {
  const a = Buffer.from(actual);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function isAuthorizedCron(req: VercelRequest, cronSecret: string): boolean {
  const authorization = Array.isArray(req.headers.authorization)
    ? req.headers.authorization[0]
    : req.headers.authorization;
  return Boolean(cronSecret && authorization && secureEqual(authorization, `Bearer ${cronSecret}`));
}

/** The IST calendar date, `offsetDays` from today, as YYYY-MM-DD. */
function istDate(offsetDays: number): string {
  return new Date(Date.now() + IST_OFFSET_MS + offsetDays * 86_400_000).toISOString().slice(0, 10);
}

/** Format a stored date (YYYY-MM-DD or ISO) as DD-MM-YYYY for the SMS. */
function formatHearingDate(value: string): string {
  const iso = String(value).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return iso ? `${iso[3]}-${iso[2]}-${iso[1]}` : String(value);
}

interface CaseRow {
  id: string;
  case_number: string;
  next_hearing_date: string;
  client_id: string | null;
  advocate_id: string | null;
}

async function rows<T>(path: string): Promise<T[]> {
  const response = await serviceFetch(path);
  if (!response.ok) return [];
  const body = await response.json().catch(() => []);
  return Array.isArray(body) ? (body as T[]) : [];
}

/** Collect every number that should hear about this case: contacts + client + advocate. */
async function gatherRecipients(c: CaseRow): Promise<string[]> {
  const numbers: string[] = [];
  const contacts = await rows<{ phone: string }>(`case_contacts?select=phone&case_id=eq.${c.id}&notify=eq.true`);
  for (const contact of contacts) if (contact.phone) numbers.push(contact.phone);
  if (c.client_id) {
    const client = await rows<{ phone: string | null }>(`clients?select=phone&id=eq.${c.client_id}&limit=1`);
    if (client[0]?.phone) numbers.push(client[0].phone);
  }
  if (c.advocate_id) {
    const advocate = await rows<{ phone: string | null }>(`advocates?select=phone&id=eq.${c.advocate_id}&limit=1`);
    if (advocate[0]?.phone) numbers.push(advocate[0].phone);
  }
  return numbers.filter(Boolean);
}

/** Skip if a reminder for this case already went out in the last ~20h (re-run safety). */
async function alreadyReminded(caseNumber: string): Promise<boolean> {
  const since = new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString();
  const match = encodeURIComponent(`${caseNumber}|%`);
  const found = await rows<{ id: string }>(
    `sms_logs?select=id&template_key=eq.hearing_reminder&trigger_source=eq.auto:hearing_reminder&status=eq.sent&variables_values=like.${match}&created_at=gte.${since}&limit=1`,
  );
  return found.length > 0;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setPrivateHeaders(res);
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const settings = await getIntegrationSettings();
  if (!settings.cronSecret) return res.status(503).json({ error: "Cron protection is not configured" });
  if (!isAuthorizedCron(req, settings.cronSecret)) return res.status(401).json({ error: "Unauthorized" });
  if (!process.env.VITE_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(200).json({ ok: true, reminders: "skipped", reason: "Supabase service role not configured" });
  }

  // Cases whose next hearing is tomorrow (IST).
  const tomorrow = istDate(1);
  const dayAfter = istDate(2);
  const cases = await rows<CaseRow>(
    `cases?select=id,case_number,next_hearing_date,client_id,advocate_id` +
      `&next_hearing_date=gte.${tomorrow}&next_hearing_date=lt.${dayAfter}` +
      `&status=in.(open,pending,in-progress)&case_number=not.is.null`,
  );

  let sent = 0, skipped = 0, failed = 0, noRecipients = 0;
  for (const c of cases) {
    if (await alreadyReminded(c.case_number)) { skipped++; continue; }
    const recipients = await gatherRecipients(c);
    if (recipients.length === 0) { noRecipients++; continue; }

    const result = await sendTemplateSms({
      templateKey: "hearing_reminder",
      numbers: recipients,
      variables: [c.case_number, formatHearingDate(c.next_hearing_date)],
      triggerSource: "auto:hearing_reminder",
      sentBy: null,
    });
    if (result.ok) sent++;
    else if (result.skipped) skipped++;
    else failed++;
  }

  return res.status(200).json({
    ok: true,
    hearingDate: tomorrow,
    casesFound: cases.length,
    sent,
    skipped,
    failed,
    noRecipients,
  });
}
