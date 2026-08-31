import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import type { Campaign, CampaignStatus } from "@/types/campaign";
import type { Lead, ScrapeJob, AIExtractionResult } from "@/types/lead";

/**
 * Modular local database layer. Uses SQLite by default (via DATABASE_URL=file:...).
 * Swap this file for a Postgres client later (same exported function signatures)
 * to move to PostgreSQL/Supabase without touching callers.
 */

function resolveDbPath(): string {
  const url = process.env.DATABASE_URL || "file:./data/leadfinder.db";
  if (url.startsWith("file:")) {
    return url.slice("file:".length);
  }
  // Non-sqlite DATABASE_URL values aren't supported by this SQLite layer yet.
  return "./data/leadfinder.db";
}

function getDb() {
  const dbPath = resolveDbPath();
  const absPath = path.isAbsolute(dbPath)
    ? dbPath
    : path.join(/* turbopackIgnore: true */ process.cwd(), dbPath);
  fs.mkdirSync(path.dirname(absPath), { recursive: true });

  const g = globalThis as unknown as { __leadFinderDb?: Database.Database };
  if (!g.__leadFinderDb) {
    const db = new Database(absPath);
    // Single-process access only (globalThis-cached connection) - the default rollback
    // journal avoids WAL's -shm/-wal sidecar files, which Windows locks in ways that can
    // conflict with Next's dev file watcher scanning the project directory.
    db.pragma("journal_mode = DELETE");
    db.pragma("foreign_keys = ON");
    migrate(db);
    g.__leadFinderDb = db;
  }
  return g.__leadFinderDb;
}

function migrate(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS campaigns (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      industry TEXT NOT NULL,
      location TEXT NOT NULL,
      requirement TEXT NOT NULL,
      target_count INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      progress_message TEXT,
      progress_current INTEGER NOT NULL DEFAULT 0,
      progress_total INTEGER NOT NULL DEFAULT 0,
      demo_mode INTEGER NOT NULL DEFAULT 0,
      error TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS leads (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      business_name TEXT,
      website TEXT NOT NULL,
      industry TEXT,
      location TEXT,
      email TEXT,
      phone TEXT,
      description TEXT,
      services_json TEXT NOT NULL DEFAULT '[]',
      website_quality_score INTEGER,
      mobile_experience TEXT,
      has_online_booking INTEGER,
      has_online_ordering INTEGER,
      has_contact_form INTEGER,
      has_whatsapp INTEGER,
      whatsapp_number TEXT,
      needs_redesign INTEGER,
      needs_seo INTEGER,
      lead_score INTEGER NOT NULL,
      lead_temperature TEXT NOT NULL,
      opportunity TEXT,
      reason TEXT,
      source_url TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS scrape_jobs (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      url TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      error TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_leads_campaign ON leads(campaign_id);
    CREATE INDEX IF NOT EXISTS idx_scrape_jobs_campaign ON scrape_jobs(campaign_id);
  `);

  // Additive migration for DBs created before whatsapp_number existed.
  const columns = db.prepare(`PRAGMA table_info(leads)`).all() as { name: string }[];
  if (!columns.some((c) => c.name === "whatsapp_number")) {
    db.exec(`ALTER TABLE leads ADD COLUMN whatsapp_number TEXT`);
  }
}

// ---------- Campaigns ----------

export function createCampaign(input: {
  id: string;
  name: string;
  industry: string;
  location: string;
  requirement: string;
  target_count: number;
  demo_mode: boolean;
}): Campaign {
  const db = getDb();
  db.prepare(
    `INSERT INTO campaigns (id, name, industry, location, requirement, target_count, status, demo_mode)
     VALUES (@id, @name, @industry, @location, @requirement, @target_count, 'pending', @demo_mode)`
  ).run({ ...input, demo_mode: input.demo_mode ? 1 : 0 });
  return getCampaign(input.id)!;
}

export function getCampaign(id: string): Campaign | undefined {
  const db = getDb();
  return db.prepare(`SELECT * FROM campaigns WHERE id = ?`).get(id) as Campaign | undefined;
}

export function listCampaigns(): Campaign[] {
  const db = getDb();
  return db.prepare(`SELECT * FROM campaigns ORDER BY created_at DESC`).all() as Campaign[];
}

export function updateCampaignProgress(
  id: string,
  fields: Partial<{
    status: CampaignStatus;
    progress_message: string;
    progress_current: number;
    progress_total: number;
    error: string | null;
  }>
) {
  const db = getDb();
  const keys = Object.keys(fields);
  if (keys.length === 0) return;
  const setClause = keys.map((k) => `${k} = @${k}`).join(", ");
  db.prepare(`UPDATE campaigns SET ${setClause} WHERE id = @id`).run({ id, ...fields });
}

// ---------- Leads ----------

export function insertLead(
  campaignId: string,
  sourceUrl: string,
  extraction: AIExtractionResult
): Lead {
  const db = getDb();
  const id = crypto.randomUUID();
  db.prepare(
    `INSERT INTO leads (
      id, campaign_id, business_name, website, industry, location, email, phone, description,
      services_json, website_quality_score, mobile_experience, has_online_booking,
      has_online_ordering, has_contact_form, has_whatsapp, whatsapp_number, needs_redesign, needs_seo,
      lead_score, lead_temperature, opportunity, reason, source_url
    ) VALUES (
      @id, @campaign_id, @business_name, @website, @industry, @location, @email, @phone, @description,
      @services_json, @website_quality_score, @mobile_experience, @has_online_booking,
      @has_online_ordering, @has_contact_form, @has_whatsapp, @whatsapp_number, @needs_redesign, @needs_seo,
      @lead_score, @lead_temperature, @opportunity, @reason, @source_url
    )`
  ).run({
    id,
    campaign_id: campaignId,
    business_name: extraction.business_name,
    website: extraction.website,
    industry: extraction.industry,
    location: extraction.location,
    email: extraction.email,
    phone: extraction.phone,
    description: extraction.description,
    services_json: JSON.stringify(extraction.services ?? []),
    website_quality_score: extraction.website_quality_score,
    mobile_experience: extraction.mobile_experience,
    has_online_booking: boolToInt(extraction.has_online_booking),
    has_online_ordering: boolToInt(extraction.has_online_ordering),
    has_contact_form: boolToInt(extraction.has_contact_form),
    has_whatsapp: boolToInt(extraction.has_whatsapp),
    whatsapp_number: extraction.whatsapp_number,
    needs_redesign: boolToInt(extraction.needs_redesign),
    needs_seo: boolToInt(extraction.needs_seo),
    lead_score: extraction.lead_score,
    lead_temperature: extraction.lead_temperature,
    opportunity: extraction.opportunity,
    reason: extraction.reason,
    source_url: sourceUrl,
  });
  return getLead(id)!;
}

function boolToInt(v: boolean | null): number | null {
  if (v === null || v === undefined) return null;
  return v ? 1 : 0;
}

export function getLead(id: string): Lead | undefined {
  const db = getDb();
  return db.prepare(`SELECT * FROM leads WHERE id = ?`).get(id) as Lead | undefined;
}

export function listLeads(campaignId?: string): Lead[] {
  const db = getDb();
  if (campaignId) {
    return db
      .prepare(`SELECT * FROM leads WHERE campaign_id = ? ORDER BY lead_score DESC`)
      .all(campaignId) as Lead[];
  }
  return db.prepare(`SELECT * FROM leads ORDER BY created_at DESC`).all() as Lead[];
}

export function existingWebsitesForCampaign(campaignId: string): Set<string> {
  const db = getDb();
  const rows = db
    .prepare(`SELECT website FROM leads WHERE campaign_id = ?`)
    .all(campaignId) as { website: string }[];
  return new Set(rows.map((r) => normalizeUrl(r.website)));
}

export function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname.replace(/^www\./, "")}${u.pathname}`.replace(/\/$/, "").toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

// ---------- Scrape Jobs ----------

export function createScrapeJob(campaignId: string, url: string): ScrapeJob {
  const db = getDb();
  const id = crypto.randomUUID();
  db.prepare(
    `INSERT INTO scrape_jobs (id, campaign_id, url, status) VALUES (?, ?, ?, 'pending')`
  ).run(id, campaignId, url);
  return db.prepare(`SELECT * FROM scrape_jobs WHERE id = ?`).get(id) as ScrapeJob;
}

export function updateScrapeJob(
  id: string,
  status: ScrapeJob["status"],
  error?: string | null
) {
  const db = getDb();
  db.prepare(`UPDATE scrape_jobs SET status = ?, error = ? WHERE id = ?`).run(
    status,
    error ?? null,
    id
  );
}

export function listScrapeJobs(campaignId: string): ScrapeJob[] {
  const db = getDb();
  return db
    .prepare(`SELECT * FROM scrape_jobs WHERE campaign_id = ? ORDER BY created_at ASC`)
    .all(campaignId) as ScrapeJob[];
}

// ---------- Stats ----------

export function getStats() {
  const db = getDb();
  const totals = db
    .prepare(
      `SELECT
        COUNT(*) as total,
        SUM(CASE WHEN lead_temperature = 'hot' THEN 1 ELSE 0 END) as hot,
        SUM(CASE WHEN lead_temperature = 'warm' THEN 1 ELSE 0 END) as warm,
        SUM(CASE WHEN lead_temperature = 'cold' THEN 1 ELSE 0 END) as cold,
        AVG(lead_score) as avg_score
      FROM leads`
    )
    .get() as {
    total: number;
    hot: number | null;
    warm: number | null;
    cold: number | null;
    avg_score: number | null;
  };
  return {
    total: totals.total ?? 0,
    hot: totals.hot ?? 0,
    warm: totals.warm ?? 0,
    cold: totals.cold ?? 0,
    avgScore: totals.avg_score ? Math.round(totals.avg_score) : 0,
  };
}
