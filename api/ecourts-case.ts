import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getIntegrationSettings } from "./_integration-settings.js";

const ECOURTS_BASE_URL = "https://webapi.ecourtsindia.com";
const CNR_PATTERN = /^[A-Z]{4}\d{12}$/;
const UPSTREAM_TIMEOUT_MS = 20_000;

type Action = "details" | "refresh" | "refresh-status";

function setPrivateHeaders(res: VercelResponse): void {
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  res.setHeader("X-Content-Type-Options", "nosniff");
}
async function getUserId(req: VercelRequest): Promise<string | null> {
  const auth = req.headers.authorization;
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!auth?.startsWith("Bearer ") || !supabaseUrl || !anonKey) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: anonKey, Authorization: auth },
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const user = await response.json();
    return typeof user?.id === "string" ? user.id : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function callECourts(
  path: string,
  apiKey: string,
  init: RequestInit = {},
): Promise<{ status: number; body: unknown }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const response = await fetch(`${ECOURTS_BASE_URL}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
      },
      signal: controller.signal,
    });
    const body = await response.json().catch(() => ({ error: "Invalid response from eCourts" }));
    return { status: response.status, body };
  } finally {
    clearTimeout(timeout);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setPrivateHeaders(res);
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!(await getUserId(req))) {
    return res.status(401).json({ error: "Please sign in again to check eCourts" });
  }

  const apiKey = (await getIntegrationSettings()).ecourtsApiKey;
  if (!apiKey) {
    return res.status(503).json({ error: "eCourts integration is not configured" });
  }

  const action = req.body?.action as Action;
  const cnr = String(req.body?.cnr || "").trim().toUpperCase();
  if (!CNR_PATTERN.test(cnr)) {
    return res.status(400).json({ error: "Enter a valid 16-character CNR number" });
  }
  if (!(["details", "refresh", "refresh-status"] as Action[]).includes(action)) {
    return res.status(400).json({ error: "Invalid eCourts action" });
  }

  try {
    let upstream: { status: number; body: unknown };
    if (action === "details") {
      upstream = await callECourts(`/api/partner/case/${encodeURIComponent(cnr)}`, apiKey);
    } else if (action === "refresh") {
      upstream = await callECourts(`/api/partner/case/${encodeURIComponent(cnr)}/refresh`, apiKey, {
        method: "POST",
      });
    } else {
      upstream = await callECourts("/api/partner/case/bulk-refresh-status", apiKey, {
        method: "POST",
        body: JSON.stringify({ cnrs: [cnr] }),
      });
    }

    if (upstream.status < 200 || upstream.status >= 300) {
      const upstreamBody = upstream.body as { error?: { message?: string } | string; message?: string } | null;
      const message = typeof upstreamBody?.error === "string"
        ? upstreamBody.error
        : upstreamBody?.error?.message || upstreamBody?.message || "eCourts request failed";
      return res.status(upstream.status).json({ error: message });
    }

    return res.status(200).json(upstream.body);
  } catch (error: unknown) {
    const isTimeout = error instanceof Error && error.name === "AbortError";
    return res.status(isTimeout ? 504 : 502).json({
      error: isTimeout ? "eCourts request timed out. Please try again." : "Could not reach eCourts right now.",
    });
  }
}
