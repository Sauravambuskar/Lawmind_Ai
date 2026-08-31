# AI Lead Finder

A working MVP that discovers business websites for a target industry/location, scrapes them
with a **self-hosted Firecrawl instance**, analyzes the content with the **Groq API**, scores
each lead 0-100 with a transparent rubric, and shows results in a dashboard with CSV export.

Architecture: `User -> Next.js -> local Firecrawl -> website content -> Groq -> AI extraction +
scoring -> SQLite -> Dashboard`.

## 1. Run Firecrawl locally

This app talks to a self-hosted Firecrawl instance - never the hosted API. Clone and start it
separately (see https://github.com/firecrawl/firecrawl for the current self-host instructions,
typically via Docker Compose):

```bash
git clone https://github.com/firecrawl/firecrawl.git
cd firecrawl
cp .env.example .env    # fill in the values Firecrawl's own docs ask for
docker compose up -d
```

By default this exposes the API at `http://localhost:3002`.

## 2. Configure this app

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```
FIRECRAWL_API_URL=http://localhost:3002
FIRECRAWL_API_KEY=            # only if your Firecrawl instance requires auth
GROQ_API_KEY=your_key_here    # required - get one at https://console.groq.com
GROQ_MODEL=llama-3.3-70b-versatile
DATABASE_URL=file:./data/leadfinder.db
```

If `FIRECRAWL_API_URL` is unset or unreachable when you create a campaign, the app
automatically runs in a clearly-labeled **Demo Mode** so you can still exercise the UI - it
does not silently pretend to use real data.

## 3. Install and run

```bash
npm install
npm run dev
```

Open http://localhost:3000, go to **Campaigns**, fill in:

- Campaign: `Pune Restaurant Website Leads`
- Industry: `Restaurants`
- Location: `Pune, Maharashtra, India`
- Requirement: `Find businesses that may need website redesign, SEO, online ordering or digital marketing.`
- Number of Leads: `20`

Click **Find Leads**. You'll be taken to the campaign page, which polls live progress
(searching → scraping → analyzing → complete), then lists scored leads. Click into a lead for
the full AI reasoning, website analysis breakdown, and scoring rubric, or use **Export CSV** on
the campaign page to download results.

Check **Settings** any time to see live Firecrawl / Groq / database connection status and to
test each connection independently.

## Production build

```bash
npm run build
npm start
```

## Project layout

```
app/
  dashboard/        stats + recent activity
  campaigns/         campaign form + list, campaigns/[id] progress + results
  leads/              all leads, leads/[id] lead detail
  settings/           connection status + test buttons
  api/
    campaigns/        create/list campaigns, triggers the pipeline
    leads/             list/read leads
    export/[id]/       CSV download
    firecrawl/test/    Firecrawl connectivity check
    groq/test/         Groq connectivity check
    settings/status/   combined status for the Settings page
components/           LeadForm, LeadTable, LeadCard, StatsCards, ProgressPanel, StatusBadge, NavShell
lib/
  firecrawl.ts         self-hosted Firecrawl client (search + scrape)
  groq.ts               Groq client, extraction prompt, JSON parsing/validation
  scoring.ts            shared scoring rubric + temperature thresholds
  pipeline.ts           orchestrates search -> scrape -> analyze -> store, with demo-mode fallback
  database.ts            SQLite schema + queries (swap for Postgres later without changing callers)
  validators.ts          zod input validation
types/                  Lead, Campaign types shared by server and client code
```

## Notes

- All Firecrawl and Groq calls happen server-side only; `GROQ_API_KEY` and Firecrawl
  credentials are never sent to the browser.
- A single failed website/search-query/Groq call never aborts a whole campaign - it's logged
  in `scrape_jobs` and the pipeline moves on.
- The database layer defaults to SQLite (`DATABASE_URL=file:./data/leadfinder.db`); swap
  `lib/database.ts` for a Postgres client later using the same exported function signatures to
  move to PostgreSQL/Supabase.
