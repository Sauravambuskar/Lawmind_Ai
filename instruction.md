Build a complete working MVP called "AI Lead Finder".

IMPORTANT:
This is a real working application, not a UI mockup. Everything must be functional.

GOAL:
The application should allow a user to enter:
1. Industry/business type
2. Location
3. What kind of leads they want
4. Number of leads

Example:
Industry: Restaurants
Location: Pune, India
Requirement: Businesses with outdated websites that may need website redesign
Number of leads: 20

The application should discover relevant business websites, scrape their public website content using a SELF-HOSTED/LOCAL Firecrawl instance, analyze the content using the Groq API, score the lead, and display the results.

==================================================
IMPORTANT ARCHITECTURE
==================================================

DO NOT use the hosted Firecrawl API.

I have the Firecrawl GitHub repository and want Firecrawl to run locally/self-hosted.

Firecrawl repository:
https://github.com/firecrawl/firecrawl

Architecture:

User
 ↓
Next.js application
 ↓
Local Firecrawl instance
 ↓
Website content
 ↓
Groq API
 ↓
AI extraction + lead scoring
 ↓
PostgreSQL/SQLite
 ↓
Dashboard

Use Firecrawl only for web search/crawling/scraping.
Use Groq only for AI analysis.

The Groq API key will be provided through environment variables.

==================================================
TECH STACK
==================================================

Frontend:
- Next.js
- TypeScript
- Tailwind CSS
- Modern responsive dashboard

Backend:
- Next.js API routes/server actions
- TypeScript

Scraping:
- Self-hosted/local Firecrawl
- Firecrawl must be configurable using an environment variable such as:
  FIRECRAWL_API_URL

AI:
- Groq API
- Use the official Groq/OpenAI-compatible SDK
- GROQ_API_KEY from environment variables

Database:
- Use PostgreSQL if available.
- If PostgreSQL is not available in the Replit environment, use SQLite for the MVP.
- Keep the database layer modular so PostgreSQL/Supabase can be added later.

==================================================
ENVIRONMENT VARIABLES
==================================================

Create a .env.example:

FIRECRAWL_API_URL=http://localhost:3002
GROQ_API_KEY=
DATABASE_URL=

Never expose GROQ_API_KEY or any secret to browser/client-side code.

==================================================
CORE USER FLOW
==================================================

Create a dashboard with a lead generation form.

Form:

Campaign Name
Industry
Location
Lead Requirement
Number of Leads

Example:

Campaign:
Pune Restaurant Website Leads

Industry:
Restaurants

Location:
Pune, Maharashtra, India

Requirement:
Find businesses that may need website redesign, SEO, online ordering or digital marketing.

Number:
20

Button:
"Find Leads"

==================================================
LEAD GENERATION PIPELINE
==================================================

When the user clicks "Find Leads":

STEP 1:
Validate the form.

STEP 2:
Generate relevant search queries based on:
- industry
- location
- requirement

For example:

"restaurants in Pune"
"restaurants Pune website"
"restaurants Pune Maharashtra"
"best restaurants Pune"

Do not hardcode only restaurant searches.
The system must dynamically generate queries based on user input.

STEP 3:
Use the local Firecrawl instance to discover/search relevant public web pages according to the installed Firecrawl capabilities.

STEP 4:
Collect unique business/company website URLs.

STEP 5:
For every relevant URL:
- scrape the public page using Firecrawl
- retrieve clean Markdown/content
- collect metadata when available
- avoid duplicate URLs
- handle failed pages gracefully

STEP 6:
Send the scraped content to Groq.

DO NOT send unlimited content to Groq.
Clean, truncate and intelligently summarize/chunk large pages before AI processing.

==================================================
AI EXTRACTION
==================================================

Create a strong system prompt for Groq.

The AI must extract ONLY information supported by the scraped content.

Never invent:
- email
- phone
- address
- company name
- services
- pricing
- facts

If information is unavailable, return null.

Return structured JSON.

Schema:

{
  "business_name": string | null,
  "website": string,
  "industry": string | null,
  "location": string | null,
  "email": string | null,
  "phone": string | null,
  "description": string | null,
  "services": string[],
  "website_quality_score": number,
  "mobile_experience": "good" | "average" | "poor" | "unknown",
  "has_online_booking": boolean | null,
  "has_online_ordering": boolean | null,
  "has_contact_form": boolean | null,
  "has_whatsapp": boolean | null,
  "needs_redesign": boolean,
  "needs_seo": boolean,
  "lead_score": number,
  "lead_temperature": "hot" | "warm" | "cold",
  "opportunity": string,
  "reason": string
}

==================================================
LEAD SCORING
==================================================

Create a transparent scoring system from 0-100.

Example factors:

Outdated website:
+20

Poor mobile experience:
+20

No clear CTA:
+10

No online booking/order:
+10

Poor SEO/content:
+10

No WhatsApp/contact option:
+10

Old-looking design:
+10

Business appears active:
+10

Maximum 100.

Do not allow the AI to randomly assign scores.
Give the AI the scoring criteria and make the reasoning visible.

Lead temperature:

80-100 = HOT
60-79 = WARM
0-59 = COLD

==================================================
DASHBOARD
==================================================

Create a professional SaaS dashboard.

Top stats:

Total Leads
Hot Leads
Warm Leads
Average Lead Score

Lead table:

Business
Website
Location
Industry
Lead Score
Temperature
Opportunity
Website Score
Actions

Each lead should be clickable.

==================================================
LEAD DETAIL PAGE
==================================================

Show:

Business name
Website
Industry
Location
Email
Phone

Lead Score

Why this is a lead:
- detailed AI reasoning

Website Analysis:
- Website quality
- Mobile experience
- SEO
- CTA
- Online booking
- Online ordering
- WhatsApp

Recommended service:

Example:
"Website Redesign + SEO"

Also display:
"Why should I contact this business?"

Create an AI-generated short sales opportunity explanation.

==================================================
EXPORT
==================================================

Add CSV export.

CSV fields:

Business Name
Website
Industry
Location
Email
Phone
Website Score
Lead Score
Temperature
Opportunity
Reason

The CSV must actually download.

==================================================
DATABASE
==================================================

Create tables/models:

campaigns

id
name
industry
location
requirement
target_count
status
created_at

leads

id
campaign_id
business_name
website
industry
location
email
phone
description
services
website_quality_score
mobile_experience
has_online_booking
has_online_ordering
has_contact_form
has_whatsapp
needs_redesign
needs_seo
lead_score
lead_temperature
opportunity
reason
source_url
created_at

scrape_jobs

id
campaign_id
url
status
error
created_at

==================================================
JOB PROCESSING
==================================================

Do not freeze the UI while processing many leads.

Show progress:

Searching web...
Found 12 websites...
Scraping 5/20...
Analyzing 5/20...
Scoring leads...
Complete.

Handle:
- Firecrawl failures
- invalid URLs
- timeout
- Groq failures
- duplicate websites
- malformed AI JSON

A single failed website must NOT stop the entire campaign.

==================================================
SECURITY
==================================================

Never expose:

GROQ_API_KEY
database credentials
Firecrawl credentials

to frontend JavaScript.

All external API calls must happen server-side.

Validate all user input.

Do not execute arbitrary URLs locally.

Respect robots.txt, website terms, rate limits, and applicable laws.
Only collect publicly available business information.
Do not collect sensitive personal information.

==================================================
UI DESIGN
==================================================

Design should look like a professional B2B SaaS.

Not a generic template.

Use:
- clean white/gray background
- dark text
- blue primary action
- cards
- data table
- badges
- responsive layout
- good empty states
- loading states
- error states

Main navigation:

Dashboard
Campaigns
Leads
Settings

==================================================
SETTINGS
==================================================

Create a simple settings page showing:

Firecrawl connection status
Groq connection status
Database status

Add buttons:

"Test Firecrawl"
"Test Groq"

Do not reveal API keys.

==================================================
DEMO MODE
==================================================

Create a demo/mock mode only for UI testing if Firecrawl is not connected.

Clearly label it:

"Demo Mode"

But the real application must use Firecrawl when FIRECRAWL_API_URL is configured.

==================================================
ERROR HANDLING
==================================================

Display useful errors.

Examples:

"Firecrawl is not reachable. Check FIRECRAWL_API_URL."

"Groq API key is missing."

"Groq request failed."

"No relevant websites were found."

Do not expose raw secrets or internal stack traces to users.

==================================================
PROJECT STRUCTURE
==================================================

Keep code clean and modular.

Suggested structure:

app/
  page.tsx
  dashboard/
  campaigns/
  leads/
  settings/
  api/
    campaigns/
    leads/
    firecrawl/
    groq/
    export/

components/
  LeadForm
  LeadTable
  LeadCard
  StatsCards
  ProgressPanel
  StatusBadge

lib/
  firecrawl.ts
  groq.ts
  scoring.ts
  database.ts
  validators.ts

types/
  lead.ts
  campaign.ts

==================================================
IMPORTANT FIRECRAWL REQUIREMENT
==================================================

Do not replace Firecrawl with Cheerio, Puppeteer, Playwright or another scraper.

The purpose of this project is specifically to use the Firecrawl GitHub project as the scraping/crawling engine.

If the exact Firecrawl self-hosted API endpoint differs depending on the installed repository version, inspect the installed Firecrawl documentation/source and adapt the integration to the actual running API instead of inventing endpoints.

Make FIRECRAWL_API_URL configurable.

==================================================
IMPORTANT GROQ REQUIREMENT
==================================================

Use the Groq API for:
- extracting structured lead information
- analyzing website quality
- generating lead score
- generating opportunity/reason
- generating sales angle

Keep Groq integration in:

lib/groq.ts

Use environment variable:

GROQ_API_KEY

Make the model configurable:

GROQ_MODEL=

If GROQ_MODEL is not provided, use a currently supported Groq model.

==================================================
FINAL REQUIREMENTS
==================================================

Do not just generate frontend screens.

Implement the actual backend pipeline.

I should be able to:

1. Start Firecrawl locally.
2. Start this Next.js application.
3. Enter:
   Restaurants
   Pune
   Website redesign opportunities
   20
4. Click "Find Leads".
5. Firecrawl discovers/scrapes websites.
6. Groq analyzes them.
7. Leads appear in the dashboard.
8. I can open lead details.
9. I can export CSV.

Before finishing:
- install dependencies
- run TypeScript checks
- fix build errors
- verify API routes
- verify environment variable handling
- make sure the application starts successfully
- provide exact commands needed to run the application locally.

Do not stop at a plan.
Actually implement the application.