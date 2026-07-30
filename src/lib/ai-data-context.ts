import { supabase } from "@/integrations/supabase/client";

/** Helper: raw fetch from Supabase REST API (bypasses schema cache) */
async function fetchFromRest(path: string): Promise<any[]> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
  const session = (await supabase.auth.getSession()).data.session;
  const authToken = session?.access_token || supabaseKey;
  const res = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    headers: { "apikey": supabaseKey, "Authorization": `Bearer ${authToken}` },
  });
  if (!res.ok) return [];
  return await res.json();
}

/** Fetch summary counts */
async function fetchSummaryStats(): Promise<string> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
  const session = (await supabase.auth.getSession()).data.session;
  const authToken = session?.access_token || supabaseKey;
  const headers = { "apikey": supabaseKey, "Authorization": `Bearer ${authToken}`, "Prefer": "count=exact" };

  const tables = ['cases', 'clients', 'advocates', 'hearings', 'invoices', 'expenses', 'documents'];
  const counts: Record<string, string> = {};

  for (const t of tables) {
    const res = await fetch(`${supabaseUrl}/rest/v1/${t}?select=id&limit=1`, { headers });
    const range = res.headers.get("content-range") || "*/0";
    const total = range.split("/")[1] || "0";
    counts[t] = total;
  }

  return Object.entries(counts).map(([k, v]) => `- ${k}: ${v} records`).join('\n');
}

async function fetchCases(limit = 50) {
  return fetchFromRest(`cases?select=case_number,title,status,court_name,court_type,case_stage,next_hearing_date,filing_date,cnr_number,case_side,fir_number,police_station&order=created_at.desc&limit=${limit}`);
}

async function fetchClients(limit = 30) {
  return fetchFromRest(`clients?select=name,email,phone,city,state&order=created_at.desc&limit=${limit}`);
}

async function fetchHearings(limit = 30) {
  return fetchFromRest(`hearings?select=hearing_date,status,court_name,judge_name,purpose,notes&order=hearing_date.desc&limit=${limit}`);
}

async function fetchInvoices(limit = 30) {
  return fetchFromRest(`invoices?select=invoice_number,amount,tax,total,status,due_date,paid_date&order=created_at.desc&limit=${limit}`);
}

async function fetchExpenses(limit = 30) {
  return fetchFromRest(`expenses?select=title,amount,category,expense_date,description&order=expense_date.desc&limit=${limit}`);
}

async function fetchAdvocates(limit = 30) {
  return fetchFromRest(`advocates?select=name,email,phone,specialization,status&order=created_at.desc&limit=${limit}`);
}

async function fetchDocuments(limit = 30) {
  return fetchFromRest(`documents?select=title,document_type,description&order=created_at.desc&limit=${limit}`);
}

async function fetchUpcomingHearings() {
  const today = new Date().toISOString().split("T")[0];
  return fetchFromRest(`cases?select=case_number,title,next_hearing_date,court_name,case_stage&next_hearing_date=gte.${today}&order=next_hearing_date.asc&limit=20`);
}

async function fetchPendingCases() {
  return fetchFromRest(`cases?select=case_number,title,status,court_name,case_stage,next_hearing_date,filing_date&status=eq.pending&order=next_hearing_date.asc&limit=50`);
}

async function fetchDisposedCases() {
  return fetchFromRest(`cases?select=case_number,title,status,court_name,case_stage,disposed_date&status=eq.disposed&order=disposed_date.desc&limit=30`);
}

function toTable(rows: Record<string, unknown>[]): string {
  if (!rows.length) return '_No records found._';
  const keys = Object.keys(rows[0]);
  const header = `| ${keys.join(' | ')} |`;
  const sep = `| ${keys.map(() => '---').join(' | ')} |`;
  const body = rows.map((r) => `| ${keys.map((k) => String(r[k] ?? '—')).join(' | ')} |`).join('\n');
  return `${header}\n${sep}\n${body}`;
}

/** Build a context string to inject into the AI system prompt */
export async function buildDataContext(userMessage: string): Promise<string> {
  const lower = userMessage.toLowerCase();
  const parts: string[] = [];

  // Always include summary
  const stats = await fetchSummaryStats();
  parts.push(`## Practice Summary\n${stats}`);

  // Smart data fetching based on user intent
  if (/pending|active|open/i.test(lower)) {
    parts.push(`\n## Pending Cases (status=pending)\n${toTable(await fetchPendingCases())}`);
  }
  if (/disposed|closed|completed/i.test(lower)) {
    parts.push(`\n## Disposed Cases\n${toTable(await fetchDisposedCases())}`);
  }
  if (/upcoming|next.*hearing|tomorrow|today.*hearing|calendar|hearing.*date|show.*hearing/i.test(lower)) {
    parts.push(`\n## Upcoming Hearings (next hearing dates from cases)\n${toTable(await fetchUpcomingHearings())}`);
  }
  if (/case|matter|filing|court|all.*case|show.*case|list.*case/i.test(lower)) {
    parts.push(`\n## Cases (latest 50)\n${toTable(await fetchCases())}`);
  }
  if (/client|customer/i.test(lower)) {
    parts.push(`\n## Clients\n${toTable(await fetchClients())}`);
  }
  if (/hearing|schedule|judge|court.*date/i.test(lower)) {
    parts.push(`\n## Hearings (from hearings table)\n${toTable(await fetchHearings())}`);
    // Also include upcoming from cases table
    if (!/upcoming/i.test(lower)) {
      parts.push(`\n## Upcoming Hearings (from cases.next_hearing_date)\n${toTable(await fetchUpcomingHearings())}`);
    }
  }
  if (/invoice|bill|payment|amount|revenue|money/i.test(lower)) {
    parts.push(`\n## Invoices\n${toTable(await fetchInvoices())}`);
  }
  if (/expense|cost|spend/i.test(lower)) {
    parts.push(`\n## Expenses\n${toTable(await fetchExpenses())}`);
  }
  if (/advocate|lawyer|attorney/i.test(lower)) {
    parts.push(`\n## Advocates\n${toTable(await fetchAdvocates())}`);
  }
  if (/document|file/i.test(lower)) {
    parts.push(`\n## Documents\n${toTable(await fetchDocuments())}`);
  }

  // If no specific keywords matched, provide overview
  if (parts.length === 1) {
    const [cases, upcoming] = await Promise.all([fetchCases(20), fetchUpcomingHearings()]);
    parts.push(`\n## Recent Cases (top 20)\n${toTable(cases)}`);
    parts.push(`\n## Upcoming Hearings\n${toTable(upcoming)}`);
  }

  return parts.join('\n\n');
}

export function getSystemPrompt(dataContext: string): string {
  return `You are **LawMind AI**, an intelligent legal practice management assistant for Advocate Manmohan D. Sarda's law firm in Akola/Washim, Maharashtra, India.

You have DIRECT ACCESS to the firm's real database. The data below is LIVE and REAL — use it to answer questions accurately.

### Your Capabilities:
1. **Answer questions about cases** — status, hearing dates, court names, case stages
2. **Generate reports** — pending cases, upcoming hearings, financial summaries
3. **Provide case analysis** — filter, sort, and present case data clearly
4. **Draft legal documents** — based on case data
5. **Calendar & scheduling** — show upcoming hearings, deadlines

### LIVE DATABASE DATA:
${dataContext}

### Response Rules:
- **USE the data above** to answer — it is REAL, not sample data
- Present data in **tables** when showing multiple records
- Be **specific** — include case numbers, dates, court names from the actual data
- If asked "show pending cases" → filter and display the pending cases from the data above
- If asked about hearings → show the actual upcoming hearing dates
- Format in **Markdown** (tables, bold, lists)
- If data is insufficient for the question, say which specific data is missing
- Never say "I don't have access" — you DO have access via the data provided above
- All monetary values are in ₹ (Indian Rupees)`;
}
