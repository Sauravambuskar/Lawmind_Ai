import { supabase } from "@/integrations/supabase/client";

/**
 * Authenticated REST client for Supabase PostgREST.
 *
 * Why this exists: the generated Supabase types are out of sync with the live
 * schema (columns added via ALTER TABLE aren't in the client's schema cache),
 * so `supabase.from(...)` rejects valid columns. These helpers call PostgREST
 * directly while still sending the logged-in user's JWT.
 *
 * RLS is enabled on all tables, so an unauthenticated request would silently
 * return zero rows. We throw a clear error instead of showing empty pages.
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export class NotAuthenticatedError extends Error {
  constructor() {
    super("Your session has expired. Please sign in again.");
    this.name = "NotAuthenticatedError";
  }
}

/** Get headers with the current user's access token. Throws if not logged in. */
async function authHeaders(extra: Record<string, string> = {}): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new NotAuthenticatedError();
  return {
    apikey: ANON_KEY,
    Authorization: `Bearer ${token}`,
    ...extra,
  };
}

/** GET rows. `path` is everything after /rest/v1/ e.g. `cases?select=*&limit=10` */
export async function restGet<T = unknown>(path: string): Promise<T[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: await authHeaders(),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(body.message || `Request failed (${res.status})`);
  }
  return res.json();
}

/** GET a single row (throws if not exactly one). */
export async function restGetOne<T = unknown>(path: string): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: await authHeaders({ Accept: "application/vnd.pgrst.object+json" }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(body.message || `Request failed (${res.status})`);
  }
  return res.json();
}

/**
 * GET all rows, paginating past PostgREST's 1000-row cap.
 * `path` must NOT already contain offset/limit.
 */
export async function restGetAll<T = unknown>(path: string, pageSize = 1000): Promise<T[]> {
  const all: T[] = [];
  let offset = 0;
  const joiner = path.includes("?") ? "&" : "?";
  // Hard cap to avoid an infinite loop on unexpected responses
  for (let page = 0; page < 100; page++) {
    const batch = await restGet<T>(`${path}${joiner}offset=${offset}&limit=${pageSize}`);
    all.push(...batch);
    if (batch.length < pageSize) break;
    offset += pageSize;
  }
  return all;
}

/** INSERT. Returns the created rows when `returning` is true. */
export async function restInsert<T = unknown>(
  table: string,
  body: unknown,
  opts: { returning?: boolean; ignoreDuplicates?: boolean } = {},
): Promise<T[]> {
  const prefer = [
    opts.returning ? "return=representation" : "return=minimal",
    opts.ignoreDuplicates ? "resolution=ignore-duplicates" : null,
  ].filter(Boolean).join(",");

  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: await authHeaders({ "Content-Type": "application/json", Prefer: prefer }),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || `Insert failed (${res.status})`);
  }
  return opts.returning ? res.json() : [];
}

/** UPDATE rows matching `filter` (e.g. `id=eq.123`). */
export async function restUpdate(table: string, filter: string, body: unknown): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, {
    method: "PATCH",
    headers: await authHeaders({ "Content-Type": "application/json", Prefer: "return=minimal" }),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || `Update failed (${res.status})`);
  }
}

/** DELETE rows matching `filter` (e.g. `id=eq.123`). */
export async function restDelete(table: string, filter: string): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, {
    method: "DELETE",
    headers: await authHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || `Delete failed (${res.status})`);
  }
}

/** Exact row count for a table + optional filter, without downloading rows. */
export async function restCount(table: string, filter = ""): Promise<number> {
  const q = filter ? `${table}?select=id&${filter}&limit=1` : `${table}?select=id&limit=1`;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${q}`, {
    headers: await authHeaders({ Prefer: "count=exact" }),
  });
  if (!res.ok) return 0;
  const range = res.headers.get("content-range") || "*/0";
  return Number(range.split("/")[1]) || 0;
}
