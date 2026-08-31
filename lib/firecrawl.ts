/**
 * Client for a self-hosted/local Firecrawl instance (https://github.com/firecrawl/firecrawl).
 *
 * Self-hosted Firecrawl exposes the same v1 REST API as the hosted service, just on your
 * own host/port (default http://localhost:3002 when run via the project's docker-compose).
 * We never call the hosted api.firecrawl.dev - only FIRECRAWL_API_URL.
 */

export interface FirecrawlSearchResult {
  url: string;
  title?: string;
  description?: string;
}

export interface FirecrawlScrapeResult {
  url: string;
  markdown: string;
  title?: string | null;
  description?: string | null;
}

export class FirecrawlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FirecrawlError";
  }
}

function getBaseUrl(): string {
  const url = process.env.FIRECRAWL_API_URL || "http://localhost:3002";
  return url.replace(/\/+$/, "");
}

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
  return headers;
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await promise;
  } finally {
    clearTimeout(timer);
  }
}

export function isFirecrawlConfigured(): boolean {
  return Boolean(process.env.FIRECRAWL_API_URL);
}

/** Lightweight reachability check used by /settings and demo-mode fallback decisions. */
export async function checkFirecrawlHealth(): Promise<{ ok: boolean; message: string }> {
  const base = getBaseUrl();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`${base}/v1/scrape`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ url: "https://example.com", formats: ["markdown"] }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (res.status === 401 || res.status === 403) {
      return { ok: false, message: "Firecrawl reachable but rejected the request (check FIRECRAWL_API_KEY)." };
    }
    if (!res.ok && res.status >= 500) {
      return { ok: false, message: `Firecrawl responded with server error ${res.status}.` };
    }
    return { ok: true, message: `Connected to Firecrawl at ${base}.` };
  } catch (err) {
    return {
      ok: false,
      message: `Firecrawl is not reachable at ${base}. Check FIRECRAWL_API_URL. (${errMsg(err)})`,
    };
  }
}

function errMsg(err: unknown): string {
  if (err instanceof Error) {
    if (err.name === "AbortError") return "request timed out";
    return err.message;
  }
  return String(err);
}

/** Discover public web pages for a query via Firecrawl's /v1/search endpoint. */
export async function searchWeb(query: string, limit: number): Promise<FirecrawlSearchResult[]> {
  const base = getBaseUrl();
  try {
    const res = await withTimeout(
      fetch(`${base}/v1/search`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ query, limit }),
      }),
      20000
    );
    if (!res.ok) {
      throw new FirecrawlError(`Firecrawl search failed with status ${res.status}`);
    }
    const json = await res.json();
    const data = json?.data ?? [];
    const items: { url?: string; title?: string; description?: string }[] = Array.isArray(data)
      ? data
      : [];
    const results: FirecrawlSearchResult[] = [];
    for (const item of items) {
      if (!item.url) continue;
      results.push({ url: item.url, title: item.title, description: item.description });
    }
    return results;
  } catch (err) {
    if (err instanceof FirecrawlError) throw err;
    throw new FirecrawlError(`Firecrawl search request failed: ${errMsg(err)}`);
  }
}

/** Scrape a single public page and return clean markdown content + metadata. */
export async function scrapeUrl(url: string): Promise<FirecrawlScrapeResult> {
  const base = getBaseUrl();
  try {
    const res = await withTimeout(
      fetch(`${base}/v1/scrape`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          url,
          formats: ["markdown"],
          onlyMainContent: true,
        }),
      }),
      30000
    );
    if (!res.ok) {
      throw new FirecrawlError(`Firecrawl scrape failed with status ${res.status} for ${url}`);
    }
    const json = await res.json();
    if (!json?.success || !json?.data) {
      throw new FirecrawlError(`Firecrawl returned no data for ${url}`);
    }
    const data = json.data;
    return {
      url,
      markdown: data.markdown ?? "",
      title: data.metadata?.title ?? null,
      description: data.metadata?.description ?? null,
    };
  } catch (err) {
    if (err instanceof FirecrawlError) throw err;
    throw new FirecrawlError(`Firecrawl scrape request failed for ${url}: ${errMsg(err)}`);
  }
}
