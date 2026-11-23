import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getIntegrationSettings } from "./_integration-settings.js";

const FAST2SMS_ENDPOINT = "https://www.fast2sms.com/dev/bulkV2";

interface SmsTemplateRow {
  template_key: string;
  name: string;
  message_id: string;
  sender_id: string | null;
  body: string;
  variables: Array<{ key: string; label: string }> | null;
  auto_send: boolean;
  active: boolean;
}

function privateHeaders(res: VercelResponse) {
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  res.setHeader("X-Content-Type-Options", "nosniff");
}

/** Verify the caller is a signed-in user and return their id, or null. */
async function getAuthUserId(req: VercelRequest): Promise<string | null> {
  const authorization = req.headers.authorization;
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!authorization?.startsWith("Bearer ") || !supabaseUrl || !anonKey) return null;
  const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: authorization },
  });
  if (!userResponse.ok) return null;
  const user = (await userResponse.json()) as { id?: string };
  return user.id || null;
}

async function serviceFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: serviceKey || "",
      Authorization: `Bearer ${serviceKey || ""}`,
      "Content-Type": "application/json",
      ...(init.headers as Record<string, string> | undefined),
    },
  });
}

/** Normalise a free-text recipient list into comma-joined 10-digit Indian mobiles. */
function normaliseNumbers(input: unknown): { ok: string[]; bad: string[] } {
  const raw = Array.isArray(input) ? input.join(",") : String(input ?? "");
  const ok: string[] = [];
  const bad: string[] = [];
  for (const piece of raw.split(/[\s,;]+/).filter(Boolean)) {
    const digits = piece.replace(/\D/g, "");
    let ten = digits;
    if (ten.length === 12 && ten.startsWith("91")) ten = ten.slice(2);
    if (ten.length === 11 && ten.startsWith("0")) ten = ten.slice(1);
    if (/^[6-9]\d{9}$/.test(ten)) ok.push(ten);
    else bad.push(piece);
  }
  return { ok: Array.from(new Set(ok)), bad };
}

/** Fill {1},{2}… markers in the template body for a human-readable log line. */
function renderBody(body: string, values: string[]): string {
  return body.replace(/\{(\d+)\}/g, (_, n) => values[Number(n) - 1] ?? `{${n}}`);
}

async function logSms(row: Record<string, unknown>): Promise<void> {
  await serviceFetch("sms_logs", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(row),
  }).catch(() => undefined);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  privateHeaders(res);
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const userId = await getAuthUserId(req);
  if (!userId) return res.status(401).json({ error: "Sign in required" });

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return res.status(503).json({ error: "SMS storage is not configured on the server" });
  }

  const body = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
  const templateKey = typeof body.template_key === "string" ? body.template_key.trim() : "";
  const triggerSource = typeof body.trigger_source === "string" ? body.trigger_source.trim() : "manual";
  const isAuto = triggerSource.startsWith("auto");
  const rawVariables = Array.isArray(body.variables) ? body.variables.map((v) => String(v ?? "").trim()) : [];

  if (!templateKey) return res.status(400).json({ error: "A template is required" });

  // Authoritative template lookup — the client never supplies the Message ID.
  const templateResponse = await serviceFetch(
    `sms_templates?select=*&template_key=eq.${encodeURIComponent(templateKey)}&limit=1`,
  );
  const templates = templateResponse.ok ? ((await templateResponse.json()) as SmsTemplateRow[]) : [];
  const template = templates[0];
  if (!template) return res.status(404).json({ error: "Unknown SMS template" });
  if (!template.active) {
    if (isAuto) return res.status(200).json({ skipped: true, reason: "template_inactive" });
    return res.status(400).json({ error: "This template is turned off" });
  }

  // Automatic sends are opt-in per template.
  if (isAuto && !template.auto_send) {
    return res.status(200).json({ skipped: true, reason: "auto_send_disabled" });
  }

  const settings = await getIntegrationSettings();
  if (!settings.fast2smsEnabled || !settings.fast2smsApiKey) {
    if (isAuto) return res.status(200).json({ skipped: true, reason: "sms_disabled" });
    return res.status(503).json({ error: "SMS sending is disabled. A Super Admin must add the Fast2SMS key and enable it." });
  }

  // Master switch for automatic SMS. Off = no auto-trigger ever fires; manual
  // sends are unaffected.
  if (isAuto && !settings.fast2smsAutoSend) {
    return res.status(200).json({ skipped: true, reason: "auto_send_globally_off" });
  }

  const expectedVars = Array.isArray(template.variables) ? template.variables.length : 0;
  if (rawVariables.length !== expectedVars) {
    return res.status(400).json({ error: `This template needs ${expectedVars} value(s); received ${rawVariables.length}.` });
  }
  if (rawVariables.some((v) => v === "")) {
    return res.status(400).json({ error: "Please fill every template variable" });
  }

  const { ok: requestedNumbers, bad } = normaliseNumbers(body.numbers);
  if (requestedNumbers.length === 0) {
    return res.status(400).json({ error: bad.length ? `No valid mobile number in: ${bad.join(", ")}` : "A recipient mobile number is required" });
  }

  // Default-number policy: route all SMS to one number, or send it a copy.
  const defaultNumber = normaliseNumbers(settings.smsDefaultNumber).ok[0];
  let numbers = requestedNumbers;
  if (defaultNumber) {
    if (settings.smsDefaultMode === "route") {
      numbers = [defaultNumber];
    } else if (settings.smsDefaultMode === "copy") {
      numbers = Array.from(new Set([...requestedNumbers, defaultNumber]));
    }
  }

  const senderId = (template.sender_id || settings.fast2smsSenderId || "").trim();
  if (!senderId) return res.status(400).json({ error: "No DLT sender ID configured" });

  const variablesValues = rawVariables.join("|");
  const rendered = renderBody(template.body, rawVariables);
  const numbersCsv = numbers.join(",");

  let status: "sent" | "failed" = "failed";
  let requestId: string | null = null;
  let errorMsg: string | null = null;

  try {
    const apiResponse = await fetch(FAST2SMS_ENDPOINT, {
      method: "POST",
      headers: {
        authorization: settings.fast2smsApiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        route: "dlt",
        sender_id: senderId,
        message: Number(template.message_id),
        variables_values: variablesValues,
        numbers: numbersCsv,
      }),
    });
    const payload = (await apiResponse.json().catch(() => null)) as
      | { return?: boolean; request_id?: string; message?: string[] | string }
      | null;

    if (apiResponse.ok && payload?.return === true) {
      status = "sent";
      requestId = payload.request_id || null;
    } else {
      status = "failed";
      const msg = payload?.message;
      errorMsg = Array.isArray(msg) ? msg.join("; ") : msg || `Fast2SMS error (HTTP ${apiResponse.status})`;
    }
  } catch (error) {
    status = "failed";
    errorMsg = error instanceof Error ? error.message : "Could not reach Fast2SMS";
  }

  await logSms({
    template_key: template.template_key,
    message_id: template.message_id,
    sender_id: senderId,
    to_number: numbersCsv,
    variables_values: variablesValues,
    rendered_message: rendered,
    status,
    request_id: requestId,
    error_msg: errorMsg,
    trigger_source: triggerSource,
    sent_by: userId,
  });

  if (status === "sent") {
    return res.status(200).json({ success: true, requestId, numbers, skippedNumbers: bad });
  }
  return res.status(502).json({ success: false, error: errorMsg || "SMS could not be sent", skippedNumbers: bad });
}
