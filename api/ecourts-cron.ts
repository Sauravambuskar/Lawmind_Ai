import { timingSafeEqual } from "crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getIntegrationSettings } from "./_integration-settings.js";
import { sendTemplateSms } from "./_sms.js";

const ECOURTS_BASE_URL = "https://webapi.ecourtsindia.com";
const CNR_PATTERN = /^[A-Z]{4}\d{12}$/;
const REQUEST_TIMEOUT_MS = 18_000;
const MAX_BATCH_SIZE = 20;
const DEFAULT_BATCH_SIZE = 10;
const SYNC_COOLDOWN_HOURS = 20;

type JsonObject = Record<string, any>;

type CaseCandidate = {
  id: string;
  cnr_number: string;
  created_by: string;
  updated_at: string | null;
};

type ECourtsSnapshot = {
  cnr: string;
  caseNumber: string | null;
  caseType: string | null;
  caseStatus: string | null;
  courtName: string | null;
  courtNo: string | null;
  district: string | null;
  state: string | null;
  purpose: string | null;
  disposalType: string | null;
  contestedStatus: string | null;
  filingDate: string | null;
  lastHearingDate: string | null;
  nextHearingDate: string | null;
  decisionDate: string | null;
  judges: string[];
  petitioners: string[];
  respondents: string[];
  hearingCount: number;
  orderCount: number;
  judgmentCount: number;
  historyOfCaseHearings: JsonObject[];
  interimOrders: JsonObject[];
  judgmentOrders: JsonObject[];
  firNumber: string | null;
  policeStation: string | null;
  sourceModifiedAt: string | null;
};

type ECourtsChange = {
  field: string;
  label: string;
  oldValue: string | null;
  newValue: string | null;
};

const TRACKED_FIELDS: Array<{ key: keyof ECourtsSnapshot; label: string }> = [
  { key: "caseStatus", label: "Case status" },
  { key: "nextHearingDate", label: "Next hearing date" },
  { key: "lastHearingDate", label: "Last hearing date" },
  { key: "purpose", label: "Hearing purpose" },
  { key: "courtName", label: "Court" },
  { key: "judges", label: "Judge" },
  { key: "disposalType", label: "Disposal type" },
  { key: "decisionDate", label: "Decision date" },
  { key: "hearingCount", label: "Hearing count" },
  { key: "orderCount", label: "Order count" },
  { key: "judgmentCount", label: "Judgment count" },
];

function setPrivateHeaders(res: VercelResponse): void {
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  res.setHeader("X-Content-Type-Options", "nosniff");
}

function secureEqual(actual: string, expected: string): boolean {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

function isAuthorizedCron(req: VercelRequest, cronSecret: string): boolean {
  const authorization = Array.isArray(req.headers.authorization)
    ? req.headers.authorization[0]
    : req.headers.authorization;
  return Boolean(cronSecret && authorization && secureEqual(authorization, `Bearer ${cronSecret}`));
}

async function requestJson(url: string, init: RequestInit): Promise<{ status: number; body: any }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const body = await response.json().catch(() => null);
    return { status: response.status, body };
  } finally {
    clearTimeout(timeout);
  }
}

function supabaseHeaders(key: string, extra: Record<string, string> = {}): Record<string, string> {
  return { apikey: key, Authorization: `Bearer ${key}`, ...extra };
}

async function supabaseRequest(
  path: string,
  key: string,
  init: RequestInit = {},
): Promise<{ status: number; body: any }> {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  if (!supabaseUrl) throw new Error("Missing VITE_SUPABASE_URL");
  const result = await requestJson(`${supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: supabaseHeaders(key, {
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...((init.headers || {}) as Record<string, string>),
    }),
  });
  if (result.status < 200 || result.status >= 300) {
    throw new Error(result.body?.message || `Supabase request failed (${result.status})`);
  }
  return result;
}

async function ecourtsRequest(path: string, apiKey: string, init: RequestInit = {}): Promise<{ status: number; body: any }> {
  if (!apiKey) throw new Error("Missing ECOURTS_API_KEY");
  const result = await requestJson(`${ECOURTS_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
  });
  if (result.status < 200 || result.status >= 300) {
    const error = typeof result.body?.error === "string"
      ? result.body.error
      : result.body?.error?.message || result.body?.message;
    throw new Error(error || `eCourts request failed (${result.status})`);
  }
  return result;
}

function stringOrNull(value: unknown): string | null {
  if (value === null || typeof value === "undefined" || value === "") return null;
  return String(value);
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function toSnapshot(envelope: JsonObject, requestedCnr: string): ECourtsSnapshot {
  const root = envelope?.data || {};
  if (!root.courtCaseData || typeof root.courtCaseData !== "object") {
    throw new Error("No case details returned");
  }
  const value = root.courtCaseData;
  const entity = root.entityInfo || {};
  const fir = value.firDetails || {};
  const returnedCnr = stringOrNull(value.cnr) || requestedCnr;
  if (returnedCnr !== requestedCnr) throw new Error("Returned CNR did not match request");

  return {
    cnr: returnedCnr,
    caseNumber: stringOrNull(value.caseNumber),
    caseType: stringOrNull(value.caseTypeRaw || value.caseTypeSub || value.caseType),
    caseStatus: stringOrNull(value.caseStatus),
    courtName: stringOrNull(value.courtName),
    courtNo: stringOrNull(value.courtNo),
    district: stringOrNull(value.district),
    state: stringOrNull(value.state),
    purpose: stringOrNull(value.purpose),
    disposalType: stringOrNull(value.disposalTypeRaw || value.disposalType),
    contestedStatus: stringOrNull(value.contestedStatus),
    filingDate: stringOrNull(value.filingDate),
    lastHearingDate: stringOrNull(value.lastHearingDate),
    nextHearingDate: stringOrNull(value.nextHearingDate),
    decisionDate: stringOrNull(value.decisionDate),
    judges: stringArray(value.judges),
    petitioners: stringArray(value.petitioners),
    respondents: stringArray(value.respondents),
    hearingCount: Number(value.hearingCount || 0),
    orderCount: Number(value.orderCount || 0),
    judgmentCount: Number(value.judgmentCount || 0),
    historyOfCaseHearings: Array.isArray(value.historyOfCaseHearings) ? value.historyOfCaseHearings : [],
    interimOrders: Array.isArray(value.interimOrders) ? value.interimOrders : [],
    judgmentOrders: Array.isArray(value.judgmentOrders) ? value.judgmentOrders : [],
    firNumber: stringOrNull(fir.caseNumber),
    policeStation: stringOrNull(fir.policeStation),
    sourceModifiedAt: stringOrNull(entity.dateModified),
  };
}

function displayValue(value: unknown): string | null {
  if (value === null || typeof value === "undefined" || value === "") return null;
  if (Array.isArray(value)) return value.length ? value.join(", ") : null;
  return String(value);
}

function findChanges(previous: ECourtsSnapshot | undefined, current: ECourtsSnapshot): ECourtsChange[] {
  if (!previous) {
    return [{ field: "initial_sync", label: "eCourts tracking", oldValue: null, newValue: "Tracking started" }];
  }
  return TRACKED_FIELDS.flatMap(({ key, label }) => {
    const oldValue = displayValue(previous[key]);
    const newValue = displayValue(current[key]);
    return oldValue === newValue ? [] : [{ field: String(key), label, oldValue, newValue }];
  });
}

function mapCaseStatus(status: string | null): string {
  const normalized = String(status || "").toUpperCase();
  if (["DISPOSED", "DISMISSED"].includes(normalized)) return "disposed";
  if (["CLOSED", "WITHDRAWN"].includes(normalized)) return "closed";
  if (normalized === "PENDING") return "pending";
  return "open";
}

function mapCaseUpdate(snapshot: ECourtsSnapshot, syncedAt: string): JsonObject {
  return {
    status: mapCaseStatus(snapshot.caseStatus),
    court_name: snapshot.courtName,
    court_type: snapshot.caseType,
    case_stage: snapshot.purpose,
    stage: snapshot.disposalType || snapshot.contestedStatus,
    filing_date: snapshot.filingDate,
    last_hearing_date: snapshot.lastHearingDate,
    next_hearing_date: snapshot.nextHearingDate,
    disposed_date: snapshot.decisionDate,
    fir_number: snapshot.firNumber,
    police_station: snapshot.policeStation,
    updated_at: syncedAt,
  };
}

function batchSize(configuredValue: number): number {
  const configured = Number(configuredValue || DEFAULT_BATCH_SIZE);
  if (!Number.isFinite(configured)) return DEFAULT_BATCH_SIZE;
  return Math.max(1, Math.min(MAX_BATCH_SIZE, Math.floor(configured)));
}

async function healthCheck(key: string): Promise<void> {
  await supabaseRequest("cases?select=id&limit=1", key);
}

async function loadCandidates(serviceKey: string, configuredBatchSize: number): Promise<CaseCandidate[]> {
  const cutoff = new Date(Date.now() - SYNC_COOLDOWN_HOURS * 60 * 60 * 1000).toISOString();
  const params = new URLSearchParams({
    select: "id,cnr_number,created_by,updated_at",
    cnr_number: "not.is.null",
    created_by: "not.is.null",
    status: "in.(open,pending,in-progress)",
    or: `(updated_at.is.null,updated_at.lt.${cutoff})`,
    order: "updated_at.asc.nullsfirst",
    limit: String(batchSize(configuredBatchSize)),
  });
  const result = await supabaseRequest(`cases?${params}`, serviceKey);
  return (Array.isArray(result.body) ? result.body : []).filter((row: CaseCandidate) =>
    row.id && row.created_by && CNR_PATTERN.test(String(row.cnr_number || "").trim().toUpperCase()),
  );
}

async function claimCase(row: CaseCandidate, serviceKey: string, claimedAt: string): Promise<boolean> {
  const params = new URLSearchParams({ id: `eq.${row.id}` });
  params.set("updated_at", row.updated_at ? `eq.${row.updated_at}` : "is.null");
  const result = await supabaseRequest(`cases?${params}`, serviceKey, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ updated_at: claimedAt }),
  });
  return Array.isArray(result.body) && result.body.length === 1;
}

async function latestSnapshot(caseId: string, serviceKey: string): Promise<ECourtsSnapshot | undefined> {
  const params = new URLSearchParams({
    select: "new_data",
    table_name: "eq.ecourts_sync",
    record_id: `eq.${caseId}`,
    order: "created_at.desc",
    limit: "1",
  });
  const result = await supabaseRequest(`audit_logs?${params}`, serviceKey);
  return Array.isArray(result.body) ? result.body[0]?.new_data?.snapshot : undefined;
}

function formatCourtDate(value: string | null): string {
  const iso = String(value || "").slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return iso ? `${iso[3]}-${iso[2]}-${iso[1]}` : String(value || "");
}

/** Numbers that should hear about a case: contacts (notify) + client + advocate. */
async function caseRecipients(caseId: string, serviceKey: string): Promise<{ numbers: string[]; caseNumber: string | null }> {
  const caseRes = await supabaseRequest(`cases?select=case_number,client_id,advocate_id&id=eq.${encodeURIComponent(caseId)}&limit=1`, serviceKey);
  const info = (Array.isArray(caseRes.body) ? caseRes.body[0] : null) || {};
  const numbers: string[] = [];
  const contacts = await supabaseRequest(`case_contacts?select=phone&case_id=eq.${encodeURIComponent(caseId)}&notify=eq.true`, serviceKey);
  for (const c of (Array.isArray(contacts.body) ? contacts.body : [])) if (c?.phone) numbers.push(String(c.phone));
  if (info.client_id) {
    const cl = await supabaseRequest(`clients?select=phone&id=eq.${encodeURIComponent(info.client_id)}&limit=1`, serviceKey);
    const phone = Array.isArray(cl.body) ? cl.body[0]?.phone : null;
    if (phone) numbers.push(String(phone));
  }
  if (info.advocate_id) {
    const av = await supabaseRequest(`advocates?select=phone&id=eq.${encodeURIComponent(info.advocate_id)}&limit=1`, serviceKey);
    const phone = Array.isArray(av.body) ? av.body[0]?.phone : null;
    if (phone) numbers.push(String(phone));
  }
  return { numbers: numbers.filter(Boolean), caseNumber: info.case_number || null };
}

/** On a detected status / next-hearing change, SMS the recipients (opt-in gated). */
async function sendChangeSms(caseId: string, snapshot: ECourtsSnapshot, changes: ECourtsChange[], serviceKey: string): Promise<void> {
  const relevant = changes.filter((c) => c.field === "caseStatus" || c.field === "nextHearingDate");
  if (!relevant.length) return;
  const { numbers, caseNumber } = await caseRecipients(caseId, serviceKey);
  const number = caseNumber || snapshot.caseNumber;
  if (!numbers.length || !number) return;

  if (relevant.some((c) => c.field === "caseStatus")) {
    await sendTemplateSms({ templateKey: "case_status_update", numbers, variables: [number], triggerSource: "auto:case_status_changed", sentBy: null }).catch(() => undefined);
  }
  if (relevant.some((c) => c.field === "nextHearingDate") && snapshot.nextHearingDate) {
    await sendTemplateSms({ templateKey: "hearing_scheduled", numbers, variables: [number, formatCourtDate(snapshot.nextHearingDate)], triggerSource: "auto:hearing_changed", sentBy: null }).catch(() => undefined);
  }
}

async function saveSync(
  row: CaseCandidate,
  snapshot: ECourtsSnapshot,
  requestId: string | null,
  serviceKey: string,
  syncedAt: string,
): Promise<number> {
  const previous = await latestSnapshot(row.id, serviceKey);
  const changes = findChanges(previous, snapshot);

  await supabaseRequest(`cases?id=eq.${encodeURIComponent(row.id)}`, serviceKey, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(mapCaseUpdate(snapshot, syncedAt)),
  });
  await supabaseRequest("audit_logs", serviceKey, {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      user_id: row.created_by,
      action: "update",
      table_name: "ecourts_sync",
      record_id: row.id,
      old_data: previous ? { snapshot: previous } : null,
      new_data: { snapshot, changes, requestId, refreshStatus: "COMPLETED", automatic: true },
    }),
  });

  // Notify recipients when a real court change was detected (skip the first baseline sync).
  if (!changes.some((c) => c.field === "initial_sync")) {
    await sendChangeSms(row.id, snapshot, changes, serviceKey).catch(() => undefined);
  }
  return changes.length;
}

function parsedTimestamp(value: unknown): number | null {
  if (typeof value !== "string" || !value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function refreshBatch(rows: CaseCandidate[], apiKey: string): Promise<{
  ready: Set<string>;
  queued: Set<string>;
  failed: Set<string>;
}> {
  const byCnr = new Map(rows.map(row => [row.cnr_number.trim().toUpperCase(), row]));
  const cnrs = Array.from(byCnr.keys());
  const ready = new Set<string>();
  const queued = new Set<string>();
  const failed = new Set<string>();
  const needsRefresh = new Set<string>();

  // Poll first. A prior cron/manual request may still be running, and submitting it
  // again would create a second paid refresh for the same CNR.
  const status = await ecourtsRequest("/api/partner/case/bulk-refresh-status", apiKey, {
    method: "POST",
    body: JSON.stringify({ cnrs }),
  });
  const seen = new Set<string>();
  for (const result of status.body?.data?.results || []) {
    const cnr = String(result?.cnr || "").toUpperCase();
    const row = byCnr.get(cnr);
    if (!row) continue;
    seen.add(cnr);
    const state = String(result?.status || "").toUpperCase();
    if (state === "PENDING") {
      queued.add(cnr);
      continue;
    }
    if (state === "COMPLETED") {
      const completedAt = parsedTimestamp(result?.completedAt);
      const lastCaseUpdate = parsedTimestamp(row.updated_at);
      if (completedAt !== null && (lastCaseUpdate === null || completedAt > lastCaseUpdate)) {
        ready.add(cnr);
        continue;
      }
    }
    needsRefresh.add(cnr);
  }
  for (const cnr of cnrs) {
    if (!seen.has(cnr)) needsRefresh.add(cnr);
  }

  if (needsRefresh.size) {
    const refresh = await ecourtsRequest("/api/partner/case/bulk-refresh", apiKey, {
      method: "POST",
      body: JSON.stringify({ cnrs: Array.from(needsRefresh) }),
    });
    for (const value of refresh.body?.data?.refreshed || []) {
      ready.add(String(value).toUpperCase());
    }
    for (const value of refresh.body?.data?.queued || []) {
      queued.add(String(value).toUpperCase());
    }
    for (const value of refresh.body?.data?.invalid || []) {
      failed.add(String(value).toUpperCase());
    }
  }

  return { ready, queued, failed };
}

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, task: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  let cursor = 0;
  const worker = async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await task(items[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setPrivateHeaders(res);
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const settings = await getIntegrationSettings();
  if (!settings.cronSecret) {
    return res.status(503).json({ error: "Cron protection is not configured" });
  }
  if (!isAuthorizedCron(req, settings.cronSecret)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!anonKey) return res.status(503).json({ error: "Supabase is not configured" });

  const startedAt = Date.now();
  try {
    // A successful database query creates real project activity even when no cases need syncing.
    await healthCheck(serviceKey || anonKey);

    if (!serviceKey || !settings.ecourtsApiKey) {
      return res.status(200).json({
        ok: true,
        database: "healthy",
        caseSync: "skipped",
        reason: !serviceKey ? "SUPABASE_SERVICE_ROLE_KEY is not configured" : "ECOURTS_API_KEY is not configured",
      });
    }

    const candidates = await loadCandidates(serviceKey, settings.ecourtsBatchSize);
    const claimedAt = new Date().toISOString();
    const claimResults = await Promise.all(candidates.map(async row => ({
      row,
      claimed: await claimCase(row, serviceKey, claimedAt),
    })));
    const claimed = claimResults.filter(result => result.claimed).map(result => result.row);
    if (!claimed.length) {
      return res.status(200).json({ ok: true, database: "healthy", caseSync: "complete", checked: 0, changed: 0 });
    }

    const byCnr = new Map(claimed.map(row => [row.cnr_number.trim().toUpperCase(), row]));
    const refreshState = await refreshBatch(claimed, settings.ecourtsApiKey);
    const syncResults = await mapWithConcurrency(Array.from(refreshState.ready), 5, async cnr => {
      const row = byCnr.get(cnr);
      if (!row) return { ok: false, changes: 0 };
      try {
        const details = await ecourtsRequest(`/api/partner/case/${encodeURIComponent(cnr)}`, settings.ecourtsApiKey);
        const snapshot = toSnapshot(details.body, cnr);
        const changes = await saveSync(
          row,
          snapshot,
          stringOrNull(details.body?.meta?.request_id),
          serviceKey,
          new Date().toISOString(),
        );
        return { ok: true, changes };
      } catch {
        return { ok: false, changes: 0 };
      }
    });

    return res.status(200).json({
      ok: true,
      database: "healthy",
      caseSync: "complete",
      claimed: claimed.length,
      checked: syncResults.filter(result => result.ok).length,
      queued: refreshState.queued.size,
      failed: syncResults.filter(result => !result.ok).length + refreshState.failed.size,
      changed: syncResults.filter(result => result.changes > 0).length,
      durationMs: Date.now() - startedAt,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Scheduled sync failed";
    return res.status(500).json({ ok: false, error: message, durationMs: Date.now() - startedAt });
  }
}
