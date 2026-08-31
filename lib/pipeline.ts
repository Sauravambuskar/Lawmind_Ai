import {
  createScrapeJob,
  insertLead,
  normalizeUrl,
  updateCampaignProgress,
  updateScrapeJob,
} from "@/lib/database";
import { checkFirecrawlHealth, scrapeUrl, searchWeb } from "@/lib/firecrawl";
import { extractLeadFromContent, isGroqConfigured } from "@/lib/groq";
import { clampScore, temperatureFromScore } from "@/lib/scoring";
import { isSafeHttpUrl } from "@/lib/validators";
import type { Campaign } from "@/types/campaign";
import type { AIExtractionResult } from "@/types/lead";

/** Build a set of dynamic, non-hardcoded search queries from the user's inputs. */
export function buildSearchQueries(industry: string, location: string, requirement: string): string[] {
  const base = [
    `${industry} in ${location}`,
    `${industry} ${location} website`,
    `best ${industry} in ${location}`,
    `top ${industry} businesses in ${location}`,
    `${industry} ${location} contact`,
  ];
  const requirementSnippet = requirement.split(/[.,]/)[0]?.trim();
  if (requirementSnippet) {
    base.push(`${industry} ${location} ${requirementSnippet}`.slice(0, 200));
  }
  return Array.from(new Set(base));
}

async function shouldUseDemoMode(): Promise<boolean> {
  if (!process.env.FIRECRAWL_API_URL) return true;
  const health = await checkFirecrawlHealth();
  return !health.ok;
}

export async function determineDemoMode(): Promise<boolean> {
  return shouldUseDemoMode();
}

export async function runCampaignPipeline(campaign: Campaign): Promise<void> {
  try {
    if (campaign.demo_mode) {
      await runDemoPipeline(campaign);
      return;
    }

    if (!isGroqConfigured()) {
      updateCampaignProgress(campaign.id, {
        status: "failed",
        error: "Groq API key is missing. Set GROQ_API_KEY in your environment.",
        progress_message: "Failed: Groq API key is missing.",
      });
      return;
    }

    updateCampaignProgress(campaign.id, { status: "searching", progress_message: "Searching web..." });

    const queries = buildSearchQueries(campaign.industry, campaign.location, campaign.requirement);
    const candidateLimit = Math.max(campaign.target_count * 3, 15);
    const seen = new Set<string>();
    const candidates: { url: string; title?: string }[] = [];

    for (const query of queries) {
      if (candidates.length >= candidateLimit) break;
      try {
        const results = await searchWeb(query, Math.max(5, Math.ceil(candidateLimit / queries.length)));
        for (const r of results) {
          if (!isSafeHttpUrl(r.url)) continue;
          const key = normalizeUrl(r.url);
          if (seen.has(key)) continue;
          seen.add(key);
          candidates.push({ url: r.url, title: r.title });
          if (candidates.length >= candidateLimit) break;
        }
      } catch {
        // A single failed search query must not stop the whole campaign - try the next query.
        continue;
      }
    }

    if (candidates.length === 0) {
      updateCampaignProgress(campaign.id, {
        status: "failed",
        error: "No relevant websites were found.",
        progress_message: "Failed: no relevant websites were found.",
      });
      return;
    }

    updateCampaignProgress(campaign.id, {
      progress_message: `Found ${candidates.length} websites...`,
      progress_total: campaign.target_count,
      progress_current: 0,
    });

    updateCampaignProgress(campaign.id, { status: "scraping" });

    let leadsCollected = 0;
    let processed = 0;

    for (const candidate of candidates) {
      if (leadsCollected >= campaign.target_count) break;
      processed += 1;

      const job = createScrapeJob(campaign.id, candidate.url);
      updateCampaignProgress(campaign.id, {
        progress_message: `Scraping ${processed}/${candidates.length}...`,
      });

      let markdown: string;
      let pageTitle: string | null | undefined;
      try {
        updateScrapeJob(job.id, "scraping");
        const scraped = await scrapeUrl(candidate.url);
        if (!scraped.markdown || scraped.markdown.trim().length < 40) {
          updateScrapeJob(job.id, "failed", "Page had no usable content.");
          continue;
        }
        markdown = scraped.markdown;
        pageTitle = scraped.title;
      } catch (err) {
        updateScrapeJob(job.id, "failed", errMsg(err));
        continue; // a single failed website must not stop the entire campaign
      }

      updateScrapeJob(job.id, "analyzing");
      updateCampaignProgress(campaign.id, {
        progress_message: `Analyzing ${processed}/${candidates.length}...`,
      });

      try {
        const extraction = await extractLeadFromContent(markdown, {
          websiteUrl: candidate.url,
          industry: campaign.industry,
          location: campaign.location,
          requirement: campaign.requirement,
          pageTitle,
        });
        insertLead(campaign.id, candidate.url, extraction);
        updateScrapeJob(job.id, "done");
        leadsCollected += 1;
        updateCampaignProgress(campaign.id, { progress_current: leadsCollected });
      } catch (err) {
        updateScrapeJob(job.id, "failed", errMsg(err));
        continue;
      }
    }

    if (leadsCollected === 0) {
      updateCampaignProgress(campaign.id, {
        status: "failed",
        error: "No leads could be extracted from the discovered websites.",
        progress_message: "Failed: no leads could be extracted.",
      });
      return;
    }

    updateCampaignProgress(campaign.id, {
      status: "completed",
      progress_message: "Complete.",
      progress_current: leadsCollected,
    });
  } catch (err) {
    updateCampaignProgress(campaign.id, {
      status: "failed",
      error: errMsg(err),
      progress_message: `Failed: ${errMsg(err)}`,
    });
  }
}

function errMsg(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

// ---------- Demo mode (UI testing only, clearly labeled) ----------

const DEMO_SUFFIXES = [
  "Co.", "Studio", "House", "Hub", "Corner", "Point", "Group", "Works", "Junction", "Plaza",
];

async function runDemoPipeline(campaign: Campaign): Promise<void> {
  updateCampaignProgress(campaign.id, { status: "searching", progress_message: "Searching web... (Demo Mode)" });
  await sleep(400);

  updateCampaignProgress(campaign.id, {
    progress_message: `Found ${campaign.target_count} websites... (Demo Mode)`,
    progress_total: campaign.target_count,
    progress_current: 0,
    status: "scraping",
  });

  for (let i = 1; i <= campaign.target_count; i++) {
    await sleep(150);
    updateCampaignProgress(campaign.id, {
      status: i < campaign.target_count ? "analyzing" : "analyzing",
      progress_message: `Analyzing ${i}/${campaign.target_count}... (Demo Mode)`,
    });
    const extraction = generateDemoLead(campaign, i);
    const demoUrl = `https://example-${campaign.industry.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${i}.demo`;
    insertLead(campaign.id, demoUrl, extraction);
    updateCampaignProgress(campaign.id, { progress_current: i });
  }

  updateCampaignProgress(campaign.id, {
    status: "completed",
    progress_message: "Complete. (Demo Mode - connect Firecrawl for real results.)",
    progress_current: campaign.target_count,
  });
}

function generateDemoLead(campaign: Campaign, index: number): AIExtractionResult {
  const suffix = DEMO_SUFFIXES[index % DEMO_SUFFIXES.length];
  const name = `${campaign.industry} ${suffix} ${index}`;
  const score = clampScore(30 + ((index * 37) % 70));
  const temp = temperatureFromScore(score);
  const needsRedesign = score >= 50;
  const needsSeo = score >= 40;

  return {
    business_name: name,
    website: `https://example-${campaign.industry.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${index}.demo`,
    industry: campaign.industry,
    location: campaign.location,
    email: null,
    phone: null,
    description: `[Demo Mode] Simulated ${campaign.industry.toLowerCase()} business in ${campaign.location} for UI testing. Connect a local Firecrawl instance for real leads.`,
    services: [],
    website_quality_score: clampScore(100 - score),
    mobile_experience: score >= 70 ? "poor" : score >= 40 ? "average" : "good",
    has_online_booking: score < 60,
    has_online_ordering: score < 50,
    has_contact_form: score < 70,
    has_whatsapp: score < 60,
    whatsapp_number: score < 60 ? `+91${(9000000000 + index * 137).toString().slice(0, 10)}` : null,
    needs_redesign: needsRedesign,
    needs_seo: needsSeo,
    lead_score: score,
    lead_temperature: temp,
    opportunity: needsRedesign ? "Website Redesign + SEO" : "SEO & Digital Marketing",
    reason: `[Demo Mode] Simulated scoring for UI testing based on requirement: "${campaign.requirement}".`,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
