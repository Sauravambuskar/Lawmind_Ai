// Central place for all hardcoded status/enum strings.
// Import from here instead of using raw string literals.

export const CASE_STATUSES = ["pending", "disposed", "not applicable", "open", "closed", "in-progress", "won", "lost"] as const;
export type CaseStatus = (typeof CASE_STATUSES)[number];

export const CASE_STATUS_FILTER = ["all", "pending", "disposed", "not applicable", "court", "affidavit"] as const;

export const CASE_STATUS_CONFIG: Record<string, { bg: string; text: string; border: string }> = {
  "open":            { bg: "bg-blue-500/10",    text: "text-blue-600 dark:text-blue-500",    border: "border-blue-500/20" },
  "pending":         { bg: "bg-amber-500/10",   text: "text-amber-600 dark:text-amber-500",  border: "border-amber-500/20" },
  "disposed":        { bg: "bg-slate-500/10",   text: "text-slate-600 dark:text-slate-400",  border: "border-slate-500/20" },
  "not applicable":  { bg: "bg-gray-500/10",    text: "text-gray-600 dark:text-gray-400",   border: "border-gray-500/20" },
  "in-progress":     { bg: "bg-indigo-500/10",  text: "text-indigo-600 dark:text-indigo-500", border: "border-indigo-500/20" },
  "closed":          { bg: "bg-slate-500/10",   text: "text-slate-600 dark:text-slate-400",  border: "border-slate-500/20" },
  "won":             { bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-500", border: "border-emerald-500/20" },
  "lost":            { bg: "bg-rose-500/10",    text: "text-rose-600 dark:text-rose-500",    border: "border-rose-500/20" },
};

export const ADVICE_STATUSES = ["pending", "completed", "cancelled"] as const;
export type AdviceStatus = (typeof ADVICE_STATUSES)[number];

export const HEARING_STATUSES = ["scheduled", "completed", "adjourned", "cancelled"] as const;
export type HearingStatus = (typeof HEARING_STATUSES)[number];

export const INVOICE_STATUSES = ["draft", "sent", "paid", "overdue", "cancelled"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const ADVOCATE_STATUSES = ["active", "inactive"] as const;
export type AdvocateStatus = (typeof ADVOCATE_STATUSES)[number];

export const USER_ROLES = ["super_admin", "admin", "agent", "lawyer"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const ITEMS_PER_PAGE = 10;
export const MIN_LOADER_MS = 2000;
export const CURRENCY = "₹";
export const LOCALE = "en-IN";
