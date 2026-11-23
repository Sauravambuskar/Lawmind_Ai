import { supabase } from "@/integrations/supabase/client";

export interface SmsTemplate {
  id: string;
  template_key: string;
  name: string;
  category: string;
  message_id: string;
  sender_id: string | null;
  body: string;
  variables: Array<{ key: string; label: string }>;
  auto_send: boolean;
  trigger_event: string | null;
  active: boolean;
  sort_order: number;
}

export interface SmsLog {
  id: string;
  template_key: string | null;
  to_number: string;
  rendered_message: string | null;
  status: string;
  request_id: string | null;
  error_msg: string | null;
  trigger_source: string | null;
  created_at: string;
}

export interface SendSmsInput {
  templateKey: string;
  numbers: string | string[];
  /** Variable values in the template's declared order. */
  variables: string[];
  /** "manual" for the Custom SMS center, "auto:<event>" for automatic triggers. */
  triggerSource?: string;
}

export interface SendSmsResult {
  success: boolean;
  skipped?: boolean;
  reason?: string;
  requestId?: string | null;
  error?: string;
  skippedNumbers?: string[];
}

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Your session has expired. Please sign in again.");
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

/**
 * Send a DLT template SMS via the server-side Fast2SMS function. The API key
 * never leaves the server; this only passes a template key, recipients and
 * the ordered variable values.
 */
export async function sendSms(input: SendSmsInput): Promise<SendSmsResult> {
  try {
    const response = await fetch("/api/sms-send", {
      method: "POST",
      headers: await authHeader(),
      body: JSON.stringify({
        template_key: input.templateKey,
        numbers: input.numbers,
        variables: input.variables,
        trigger_source: input.triggerSource || "manual",
      }),
    });
    const data = (await response.json().catch(() => ({}))) as SendSmsResult & { skipped?: boolean };
    if (data.skipped) return { success: false, skipped: true, reason: data.reason };
    if (!response.ok || !data.success) {
      return { success: false, error: data.error || `SMS failed (${response.status})`, skippedNumbers: data.skippedNumbers };
    }
    return { success: true, requestId: data.requestId, skippedNumbers: data.skippedNumbers };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Could not send SMS" };
  }
}

/**
 * Fire an automatic trigger. Safe to call from create/update flows: it never
 * throws, and the server silently skips it unless the template has auto-send
 * enabled and SMS is turned on. A missing phone number is a no-op.
 */
export async function triggerSms(
  event: "hearing_created" | "case_status_changed" | "advocate_assigned" | "client_onboarded",
  templateKey: string,
  numbers: string | string[] | null | undefined,
  variables: string[],
): Promise<void> {
  const hasNumber = Array.isArray(numbers) ? numbers.some(Boolean) : Boolean(numbers && String(numbers).trim());
  if (!hasNumber) return;
  if (variables.some((v) => !v || !String(v).trim())) return;
  try {
    await sendSms({ templateKey, numbers: numbers as string | string[], variables, triggerSource: `auto:${event}` });
  } catch {
    // Automatic SMS must never break the primary action.
  }
}
