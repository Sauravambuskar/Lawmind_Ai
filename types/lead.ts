export type MobileExperience = "good" | "average" | "poor" | "unknown";
export type LeadTemperature = "hot" | "warm" | "cold";

/** Structured output the AI must produce from scraped page content. */
export interface AIExtractionResult {
  business_name: string | null;
  website: string;
  industry: string | null;
  location: string | null;
  email: string | null;
  phone: string | null;
  description: string | null;
  services: string[];
  website_quality_score: number;
  mobile_experience: MobileExperience;
  has_online_booking: boolean | null;
  has_online_ordering: boolean | null;
  has_contact_form: boolean | null;
  has_whatsapp: boolean | null;
  /** The actual WhatsApp number in E.164-ish form (e.g. "+919876543210"), if one is present
   *  on the page (wa.me link, click-to-chat button, or explicit "WhatsApp: ..." text). Distinct
   *  from `phone`, which may be a landline or a different contact number. */
  whatsapp_number: string | null;
  needs_redesign: boolean;
  needs_seo: boolean;
  lead_score: number;
  lead_temperature: LeadTemperature;
  opportunity: string;
  reason: string;
}

/** better-sqlite3 stores booleans as 0/1/null - reflect that at the row level. */
export interface Lead
  extends Omit<
    AIExtractionResult,
    "has_online_booking" | "has_online_ordering" | "has_contact_form" | "has_whatsapp" | "needs_redesign" | "needs_seo"
  > {
  id: string;
  campaign_id: string;
  services_json: string;
  has_online_booking: 0 | 1 | null;
  has_online_ordering: 0 | 1 | null;
  has_contact_form: 0 | 1 | null;
  has_whatsapp: 0 | 1 | null;
  needs_redesign: 0 | 1;
  needs_seo: 0 | 1;
  source_url: string;
  created_at: string;
}

export interface WhatsAppDraft {
  message: string;
  whatsapp_number: string | null;
  whatsapp_link: string | null;
}

export interface EmailDraft {
  subject: string;
  body: string;
}

export interface ScrapeJob {
  id: string;
  campaign_id: string;
  url: string;
  status: "pending" | "scraping" | "analyzing" | "done" | "failed";
  error: string | null;
  created_at: string;
}
