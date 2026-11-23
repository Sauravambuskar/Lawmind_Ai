import { supabase } from "@/integrations/supabase/client";
import { fetchWithTimeout } from "@/lib/http";
import { restGet, restInsert, restUpdate } from "@/lib/restClient";

const CNR_PATTERN = /^[A-Z]{4}\d{12}$/;
const FIRST_STATUS_POLL_MS = 8_000;
const POLL_INTERVAL_MS = 12_000;
const MAX_REFRESH_WAIT_MS = 10 * 60_000;
const RECENT_COMPLETION_WINDOW_MS = 20 * 60_000;
const REFRESH_MARKER_PREFIX = "lawmind:ecourts-refresh:";

export interface ECourtsHearing {
  judge?: string;
  businessOnDate?: string;
  hearingDate?: string;
  purposeOfListing?: string;
}

export interface ECourtsOrder {
  orderDate?: string;
  description?: string;
  orderType?: string;
  orderUrl?: string;
}

export interface ECourtsSnapshot {
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
  historyOfCaseHearings: ECourtsHearing[];
  interimOrders: ECourtsOrder[];
  judgmentOrders: ECourtsOrder[];
  firNumber: string | null;
  policeStation: string | null;
  sourceModifiedAt: string | null;
}

export interface ECourtsChange {
  field: string;
  label: string;
  oldValue: string | null;
  newValue: string | null;
}

export interface ECourtsSyncLog {
  id: string;
  created_at: string;
  old_data: { snapshot?: ECourtsSnapshot } | null;
  new_data: {
    snapshot?: ECourtsSnapshot;
    changes?: ECourtsChange[];
    requestId?: string | null;
    refreshStatus?: string;
    automatic?: boolean;
  } | null;
}

type LocalCase = {
  id: string;
  cnr_number?: string | null;
  status?: string | null;
  court_name?: string | null;
  court_type?: string | null;
  case_stage?: string | null;
  stage?: string | null;
  filing_date?: string | null;
  last_hearing_date?: string | null;
  next_hearing_date?: string | null;
  disposed_date?: string | null;
  fir_number?: string | null;
  police_station?: string | null;
};

type ApiEnvelope<T = any> = { data?: T; meta?: { request_id?: string }; error?: string };

type RefreshStatusResult = {
  cnr?: string;
  status?: string;
  requestedAt?: string | null;
  completedAt?: string | null;
  failureReason?: string | null;
  refunded?: boolean;
};

const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

async function callApi<T>(action: "details" | "refresh" | "refresh-status", cnr: string): Promise<ApiEnvelope<T>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Your session has expired. Please sign in again.");

  const response = await fetchWithTimeout("/api/ecourts-case", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ action, cnr }),
  }, 25_000);
  const body = await response.json().catch(() => null) as ApiEnvelope<T> | null;
  if (!response.ok) throw new Error(body?.error || `eCourts request failed (${response.status})`);
  return body || {};
}

function stringOrNull(value: unknown): string | null {
  if (value === null || typeof value === "undefined" || value === "") return null;
  return String(value);
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export function normalizeCnr(value: string | null | undefined): string {
  return String(value || "").trim().toUpperCase();
}

export function isValidCnr(value: string | null | undefined): boolean {
  return CNR_PATTERN.test(normalizeCnr(value));
}

function toSnapshot(envelope: ApiEnvelope): ECourtsSnapshot {
  const root = envelope.data || {};
  if (!root.courtCaseData || typeof root.courtCaseData !== "object") {
    throw new Error("eCourts did not return case details for this CNR");
  }
  const value = root.courtCaseData || {};
  const entity = root.entityInfo || {};
  const fir = value.firDetails || {};
  return {
    cnr: stringOrNull(value.cnr) || "",
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

function mapCaseUpdate(snapshot: ECourtsSnapshot): Record<string, unknown> {
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
  };
}

async function latestSync(caseId: string): Promise<ECourtsSyncLog | undefined> {
  const rows = await restGet<ECourtsSyncLog>(
    `audit_logs?select=id,created_at,old_data,new_data&table_name=eq.ecourts_sync&record_id=eq.${caseId}&order=created_at.desc&limit=1`,
  );
  return rows[0];
}

function markerKey(cnr: string): string {
  return `${REFRESH_MARKER_PREFIX}${cnr}`;
}

function readRefreshMarker(cnr: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(markerKey(cnr));
  } catch {
    return null;
  }
}

function saveRefreshMarker(cnr: string, requestedAt?: string | null): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(markerKey(cnr), requestedAt || new Date().toISOString());
  } catch {
    // Status preflight still prevents duplicate requests while the refresh is pending.
  }
}

function clearRefreshMarker(cnr: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(markerKey(cnr));
  } catch {
    // Storage may be disabled in strict privacy modes; completion is still safe.
  }
}

function timestamp(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function getRefreshStatus(cnr: string): Promise<RefreshStatusResult> {
  const envelope = await callApi<{ results?: RefreshStatusResult[] }>("refresh-status", cnr);
  return envelope.data?.results?.[0] || {};
}

function isUnconsumedCompletion(
  result: RefreshStatusResult,
  latestSyncedAt: string | undefined,
  queuedAt: string | null,
): boolean {
  if (String(result.status || "").toUpperCase() !== "COMPLETED") return false;
  const completedAt = timestamp(result.completedAt);
  if (completedAt === null) return false;

  const lastSyncAt = timestamp(latestSyncedAt);
  if (lastSyncAt !== null && completedAt > lastSyncAt) return true;

  const markerAt = timestamp(queuedAt);
  if (markerAt !== null && completedAt >= markerAt - 60_000) return true;

  return lastSyncAt === null && Date.now() - completedAt <= RECENT_COMPLETION_WINDOW_MS;
}

async function waitForRefresh(cnr: string): Promise<RefreshStatusResult> {
  const deadline = Date.now() + MAX_REFRESH_WAIT_MS;
  let nextDelay = FIRST_STATUS_POLL_MS;

  while (Date.now() < deadline) {
    await wait(nextDelay);
    nextDelay = POLL_INTERVAL_MS;
    const result = await getRefreshStatus(cnr);
    const status = String(result.status || "").toUpperCase();
    if (status === "COMPLETED") return result;
    if (status === "FAILED" || status === "INVALID") {
      clearRefreshMarker(cnr);
      throw new Error(result.failureReason || `eCourts refresh ${status.toLowerCase()}`);
    }
  }
  throw new Error("Official refresh is still processing. No duplicate refresh was sent; open this case later and click Refresh again to resume checking.");
}

export async function syncCaseWithECourts(localCase: LocalCase, userId: string): Promise<{
  snapshot: ECourtsSnapshot;
  changes: ECourtsChange[];
}> {
  const cnr = normalizeCnr(localCase.cnr_number);
  if (!isValidCnr(cnr)) throw new Error("Add a valid 16-character CNR number before refreshing");

  const previousLog = await latestSync(localCase.id);
  const previousSnapshot = previousLog?.new_data?.snapshot;
  const existingStatus = await getRefreshStatus(cnr);
  const existingState = String(existingStatus.status || "").toUpperCase();
  const queuedAt = readRefreshMarker(cnr);
  let refreshResult: RefreshStatusResult;

  if (existingState === "PENDING") {
    saveRefreshMarker(cnr, existingStatus.requestedAt);
    refreshResult = await waitForRefresh(cnr);
  } else if (isUnconsumedCompletion(existingStatus, previousLog?.created_at, queuedAt)) {
    refreshResult = existingStatus;
  } else {
    await callApi("refresh", cnr);
    saveRefreshMarker(cnr);
    refreshResult = await waitForRefresh(cnr);
  }

  const details = await callApi("details", cnr);
  const snapshot = toSnapshot(details);
  if (!snapshot.cnr) snapshot.cnr = cnr;
  if (snapshot.cnr !== cnr) throw new Error("eCourts returned a different CNR than requested");

  const changes = findChanges(previousSnapshot, snapshot);

  await restUpdate("cases", `id=eq.${localCase.id}`, mapCaseUpdate(snapshot));
  await restInsert("audit_logs", {
    user_id: userId,
    action: "update",
    table_name: "ecourts_sync",
    record_id: localCase.id,
    old_data: previousSnapshot ? { snapshot: previousSnapshot } : null,
    new_data: {
      snapshot,
      changes,
      requestId: details.meta?.request_id || null,
      refreshStatus: String(refreshResult.status || "COMPLETED").toUpperCase(),
      automatic: false,
    },
  });

  clearRefreshMarker(cnr);

  return { snapshot, changes };
}

// ── Add a NEW case from eCourts by CNR ──────────────────────────────────────

export interface CaseImportFields {
  case_number: string;
  title: string;
  description: string;
  cnr_number: string;
  status: string;
  court_name: string;
  court_type: string;
  case_stage: string;
  stage: string;
  filing_date: string;
  last_hearing_date: string;
  next_hearing_date: string;
  disposed_date: string;
  fir_number: string;
  police_station: string;
}

/** Normalise an eCourts date into the YYYY-MM-DD that <input type="date"> needs. */
function toDateInput(value: string | null): string {
  if (!value) return "";
  const s = String(value).trim();
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dmy = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  const parsed = Date.parse(s);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString().slice(0, 10) : "";
}

function buildCaseTitle(s: ECourtsSnapshot): string {
  const petitioner = s.petitioners[0];
  const respondent = s.respondents[0];
  if (petitioner && respondent) return `${petitioner} vs ${respondent}`;
  return petitioner || respondent || s.caseNumber || s.cnr;
}

/** Map an eCourts snapshot onto the "Create Case" form fields. */
export function snapshotToCaseFields(s: ECourtsSnapshot): CaseImportFields {
  const description = [
    s.petitioners.length ? `Petitioner(s): ${s.petitioners.join(", ")}` : "",
    s.respondents.length ? `Respondent(s): ${s.respondents.join(", ")}` : "",
    s.judges.length ? `Judge(s): ${s.judges.join(", ")}` : "",
  ].filter(Boolean).join(" | ");

  return {
    case_number: s.caseNumber || s.cnr,
    title: buildCaseTitle(s),
    description,
    cnr_number: s.cnr,
    status: mapCaseStatus(s.caseStatus),
    court_name: s.courtName || "",
    court_type: s.caseType || "",
    case_stage: s.purpose || "",
    stage: s.disposalType || s.contestedStatus || "",
    filing_date: toDateInput(s.filingDate),
    last_hearing_date: toDateInput(s.lastHearingDate),
    next_hearing_date: toDateInput(s.nextHearingDate),
    disposed_date: toDateInput(s.decisionDate),
    fir_number: s.firNumber || "",
    police_station: s.policeStation || "",
  };
}

async function tryDetails(cnr: string): Promise<ECourtsSnapshot | null> {
  try {
    const details = await callApi("details", cnr);
    const snapshot = toSnapshot(details);
    if (!snapshot.cnr) snapshot.cnr = cnr;
    return snapshot.cnr === cnr ? snapshot : null;
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    // Real configuration/auth problems should surface, not trigger a slow refresh.
    if (message.includes("not configured") || message.includes("sign in") || message.includes("session")) {
      throw error;
    }
    return null; // Most likely "not cached yet" — caller will request a fresh pull.
  }
}

/**
 * Look up a case on eCourts by CNR for import. Returns the snapshot if the
 * provider already has it; otherwise requests a fresh pull from the court and
 * polls until it is ready (can take a few minutes for a brand-new CNR).
 */
export async function fetchCaseSnapshotForImport(cnrInput: string): Promise<ECourtsSnapshot> {
  const cnr = normalizeCnr(cnrInput);
  if (!isValidCnr(cnr)) throw new Error("Enter a valid 16-character CNR number, e.g. MHAK01012345672024");

  const cached = await tryDetails(cnr);
  if (cached) return cached;

  const existing = await getRefreshStatus(cnr);
  if (String(existing.status || "").toUpperCase() === "PENDING") {
    saveRefreshMarker(cnr, existing.requestedAt);
  } else {
    await callApi("refresh", cnr);
    saveRefreshMarker(cnr);
  }
  await waitForRefresh(cnr);

  const details = await callApi("details", cnr);
  const snapshot = toSnapshot(details);
  if (!snapshot.cnr) snapshot.cnr = cnr;
  if (snapshot.cnr !== cnr) throw new Error("eCourts returned a different CNR than requested");
  clearRefreshMarker(cnr);
  return snapshot;
}

/**
 * Store a freshly fetched snapshot as the first eCourts sync log for a case.
 * Called right after a case is created via "Add by CNR", so its full court
 * history is available immediately without a second (slow, paid) refresh.
 */
export async function saveInitialSnapshot(caseId: string, snapshot: ECourtsSnapshot, userId: string): Promise<void> {
  await restInsert("audit_logs", {
    user_id: userId,
    action: "update",
    table_name: "ecourts_sync",
    record_id: caseId,
    old_data: null,
    new_data: {
      snapshot,
      changes: [{ field: "initial_sync", label: "eCourts tracking", oldValue: null, newValue: "Imported on case creation" }],
      requestId: null,
      refreshStatus: "COMPLETED",
      automatic: false,
    },
  });
}

export async function getECourtsSyncLogs(caseId: string): Promise<ECourtsSyncLog[]> {
  return restGet<ECourtsSyncLog>(
    `audit_logs?select=id,created_at,old_data,new_data&table_name=eq.ecourts_sync&record_id=eq.${caseId}&order=created_at.desc&limit=100`,
  );
}
