/**
 * Email Service — sends emails via EmailJS (frontend) or logs for SMTP (server-side future)
 * 
 * EmailJS Setup (free 200 emails/month):
 * 1. Go to https://emailjs.com → Create account
 * 2. Add email service (Gmail/Outlook/SMTP)
 * 3. Create email template
 * 4. Get Service ID, Template ID, Public Key
 * 5. Save in Admin → Email Settings
 */

import { supabase } from "@/integrations/supabase/client";
import { restGet, restInsert } from "@/lib/restClient";

export interface EmailConfig {
  provider: "emailjs" | "smtp";
  emailjs_service_id?: string;
  emailjs_template_id?: string;
  emailjs_public_key?: string;
  smtp_host?: string;
  smtp_port?: number;
  smtp_user?: string;
  smtp_pass?: string;
  from_email?: string;
  from_name?: string;
}

export interface SendEmailParams {
  to_email: string;
  subject: string;
  body: string;
  template?: string;
  case_id?: string;
  client_id?: string;
}

/**
 * Load email settings from database
 */
export async function loadEmailConfig(): Promise<EmailConfig | null> {
  const rows = await restGet<EmailConfig>("email_settings?select=*&limit=1");
  return rows[0] || null;
}

/**
 * Send email via EmailJS
 */
async function sendViaEmailJS(config: EmailConfig, params: SendEmailParams): Promise<boolean> {
  if (!config.emailjs_service_id || !config.emailjs_template_id || !config.emailjs_public_key) {
    throw new Error("EmailJS not configured. Go to Admin → Email Settings.");
  }

  const templateParams = {
    to_email: params.to_email,
    subject: params.subject,
    message: params.body,
    from_name: config.from_name || "LawMind AI",
  };

  const res = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      service_id: config.emailjs_service_id,
      template_id: config.emailjs_template_id,
      user_id: config.emailjs_public_key,
      template_params: templateParams,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`EmailJS error: ${err}`);
  }
  return true;
}

/**
 * Main send email function — routes to correct provider
 */
export async function sendEmail(params: SendEmailParams): Promise<{ success: boolean; error?: string }> {
  try {
    const config = await loadEmailConfig();
    if (!config) {
      throw new Error("Email not configured. Go to Admin → Email Settings and set up EmailJS.");
    }

    if (config.provider === "emailjs") {
      await sendViaEmailJS(config, params);
    } else {
      // SMTP — log for server-side processing (future Edge Function)
      throw new Error("SMTP requires server-side setup. Use EmailJS for now.");
    }

    await logEmail(params, "sent");
    return { success: true };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to send email";
    // Best-effort failure log — never let logging mask the original error
    try {
      await logEmail(params, "failed", message);
    } catch {
      /* ignore */
    }
    return { success: false, error: message };
  }
}

/** Write a row to email_logs. Requires an authenticated session (RLS). */
async function logEmail(params: SendEmailParams, status: "sent" | "failed", errorMsg?: string) {
  const { data } = await supabase.auth.getSession();
  await restInsert("email_logs", {
    to_email: params.to_email,
    subject: params.subject,
    body: params.body,
    template: params.template || "custom",
    status,
    error_msg: errorMsg || null,
    case_id: params.case_id || null,
    client_id: params.client_id || null,
    sent_by: data.session?.user?.id || null,
  });
}

/**
 * Pre-built email templates
 */
export function getHearingReminderEmail(caseNumber: string, caseTitle: string, hearingDate: string, courtName: string): SendEmailParams {
  return {
    to_email: "", // caller fills this
    subject: `Hearing Reminder: ${caseNumber} - ${hearingDate}`,
    body: `Dear Client,

This is a reminder that your case hearing is scheduled:

Case Number: ${caseNumber}
Case Title: ${caseTitle}
Hearing Date: ${hearingDate}
Court: ${courtName}

Please ensure you are present at the court on the scheduled date. If you have any concerns or need to discuss anything before the hearing, please contact us.

Regards,
Adv. Manmohan D. Sarda
LawMind AI`,
    template: "hearing_reminder",
  };
}

export function getInvoiceEmail(invoiceNumber: string, amount: string, dueDate: string, clientName: string): SendEmailParams {
  return {
    to_email: "",
    subject: `Invoice #${invoiceNumber} - Payment Due`,
    body: `Dear ${clientName},

Please find the details of your pending invoice:

Invoice Number: #${invoiceNumber}
Amount Due: ₹${amount}
Due Date: ${dueDate}

Kindly arrange for payment at your earliest convenience. You can pay via UPI, bank transfer, or cheque.

If payment has already been made, please disregard this reminder.

Regards,
Adv. Manmohan D. Sarda
LawMind AI`,
    template: "invoice",
  };
}

export function getGeneralNotification(subject: string, message: string): SendEmailParams {
  return {
    to_email: "",
    subject,
    body: message,
    template: "general",
  };
}
