import { getIntegrationSettings } from "./_integration-settings.js";

const FAST2SMS_ENDPOINT = "https://www.fast2sms.com/dev/bulkV2";

export interface SmsTemplateRow {
  template_key: string;
  name: string;
  message_id: string;
  sender_id: string | null;
  body: string;
  variables: Array<{ key: string; label: string }> | null;
  auto_send: boolean;
  active: boolean;
}

export interface SendResult {
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  status: number;          // suggested HTTP status for the endpoint
  error?: string;
  requestId?: string | null;
  sentNumbers?: string[];
  skippedNumbers?: string[];
}

export function serviceFetch(path: string, init: RequestInit = {}): Promise<Response> {
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
export function normaliseNumbers(input: unknown): { ok: string[]; bad: string[] } {
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

export function renderBody(body: string, values: string[]): string {
  return body.replace(/\{(\d+)\}/g, (_, n) => values[Number(n) - 1] ?? `{${n}}`);
}

async function logSms(row: Record<string, unknown>): Promise<void> {
  await serviceFetch("sms_logs", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(row),
  }).catch(() => undefined);
}

export async function fetchTemplate(templateKey: string): Promise<SmsTemplateRow | null> {
  const response = await serviceFetch(
    `sms_templates?select=*&template_key=eq.${encodeURIComponent(templateKey)}&limit=1`,
  );
  if (!response.ok) return null;
  const rows = (await response.json()) as SmsTemplateRow[];
  return rows[0] || null;
}

export interface SendTemplateSmsInput {
  templateKey: string;
  numbers: unknown;            // string, comma-list, or string[]
  variables: string[];         // in template order
  triggerSource: string;       // "manual" | "auto:<event>"
  sentBy: string | null;       // user id, or null for system/cron
}

/**
 * Core SMS send used by both the authenticated endpoint and the crons.
 * Enforces: SMS enabled, template active + has a numeric Message ID, the
 * opt-in auto gates (global + per-template) for automatic sends, variable
 * count, and the default-number policy (off/copy/route). Logs every outcome.
 */
export async function sendTemplateSms(input: SendTemplateSmsInput): Promise<SendResult> {
  const triggerSource = input.triggerSource || "manual";
  const isAuto = triggerSource.startsWith("auto");
  const rawVariables = input.variables.map((v) => String(v ?? "").trim());

  const template = await fetchTemplate(input.templateKey);
  if (!template) return { ok: false, status: 404, error: "Unknown SMS template" };
  if (!template.active) {
    return isAuto ? { ok: false, skipped: true, reason: "template_inactive", status: 200 }
      : { ok: false, status: 400, error: "This template is turned off" };
  }
  if (isAuto && !template.auto_send) {
    return { ok: false, skipped: true, reason: "auto_send_disabled", status: 200 };
  }
  if (!/^\d+$/.test(String(template.message_id))) {
    return isAuto ? { ok: false, skipped: true, reason: "no_message_id", status: 200 }
      : { ok: false, status: 400, error: "This template has no DLT Message ID yet" };
  }

  const settings = await getIntegrationSettings();
  if (!settings.fast2smsEnabled || !settings.fast2smsApiKey) {
    return isAuto ? { ok: false, skipped: true, reason: "sms_disabled", status: 200 }
      : { ok: false, status: 503, error: "SMS sending is disabled. A Super Admin must add the Fast2SMS key and enable it." };
  }
  if (isAuto && !settings.fast2smsAutoSend) {
    return { ok: false, skipped: true, reason: "auto_send_globally_off", status: 200 };
  }

  const expectedVars = Array.isArray(template.variables) ? template.variables.length : 0;
  if (rawVariables.length !== expectedVars) {
    return { ok: false, status: 400, error: `This template needs ${expectedVars} value(s); received ${rawVariables.length}.` };
  }
  if (rawVariables.some((v) => v === "")) {
    return { ok: false, status: 400, error: "Please fill every template variable" };
  }

  const { ok: requestedNumbers, bad } = normaliseNumbers(input.numbers);
  if (requestedNumbers.length === 0) {
    return isAuto ? { ok: false, skipped: true, reason: "no_recipient", status: 200 }
      : { ok: false, status: 400, error: bad.length ? `No valid mobile number in: ${bad.join(", ")}` : "A recipient mobile number is required" };
  }

  const defaultNumber = normaliseNumbers(settings.smsDefaultNumber).ok[0];
  let numbers = requestedNumbers;
  if (defaultNumber) {
    if (settings.smsDefaultMode === "route") numbers = [defaultNumber];
    else if (settings.smsDefaultMode === "copy") numbers = Array.from(new Set([...requestedNumbers, defaultNumber]));
  }

  const senderId = (template.sender_id || settings.fast2smsSenderId || "").trim();
  if (!senderId) return { ok: false, status: 400, error: "No DLT sender ID configured" };

  const variablesValues = rawVariables.join("|");
  const rendered = renderBody(template.body, rawVariables);
  const numbersCsv = numbers.join(",");

  let status: "sent" | "failed" = "failed";
  let requestId: string | null = null;
  let errorMsg: string | null = null;

  try {
    const apiResponse = await fetch(FAST2SMS_ENDPOINT, {
      method: "POST",
      headers: { authorization: settings.fast2smsApiKey, "Content-Type": "application/json" },
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
      const msg = payload?.message;
      errorMsg = Array.isArray(msg) ? msg.join("; ") : msg || `Fast2SMS error (HTTP ${apiResponse.status})`;
    }
  } catch (error) {
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
    sent_by: input.sentBy,
  });

  if (status === "sent") {
    return { ok: true, status: 200, requestId, sentNumbers: numbers, skippedNumbers: bad };
  }
  return { ok: false, status: 502, error: errorMsg || "SMS could not be sent", skippedNumbers: bad };
}
