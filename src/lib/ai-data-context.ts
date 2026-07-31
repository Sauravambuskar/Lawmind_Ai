import { restGet, restCount } from "@/lib/restClient";

/** Fetch rows for AI context; returns [] on any failure so the AI still answers. */
async function fetchFromRest(path: string): Promise<any[]> {
  try {
    return await restGet<any>(path);
  } catch {
    return [];
  }
}

/** Fetch summary counts */
async function fetchSummaryStats(): Promise<string> {
  const today = new Date().toISOString().split("T")[0];
  const [totalCases, pendingCases, disposedCases, upcomingHearings] = await Promise.all([
    restCount("cases"),
    restCount("cases", "status=eq.pending"),
    restCount("cases", "status=eq.disposed"),
    restCount("cases", `next_hearing_date=gte.${today}`),
  ]);

  return `- Total Cases: ${totalCases}
- Pending Cases: ${pendingCases}
- Disposed Cases: ${disposedCases}
- Cases with Upcoming Hearings: ${upcomingHearings}
- NOTE: Hearing dates are stored in cases.next_hearing_date column (NOT in a separate hearings table)`;
}

async function fetchCases(limit = 50) {
  return fetchFromRest(`cases?select=case_number,title,status,court_name,court_type,case_stage,next_hearing_date,filing_date,cnr_number,case_side,fir_number,police_station&order=created_at.desc&limit=${limit}`);
}

async function fetchClients(limit = 30) {
  return fetchFromRest(`clients?select=name,email,phone,city,state&order=created_at.desc&limit=${limit}`);
}

async function fetchHearings(limit = 30) {
  // Hearings are stored in cases.next_hearing_date, not a separate table
  return fetchUpcomingHearings();
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
  if (/upcoming|next.*hearing|tomorrow|today.*hearing|calendar|hearing.*date|show.*hearing|hearing/i.test(lower)) {
    parts.push(`\n## Upcoming Hearings (cases with future next_hearing_date)\n${toTable(await fetchUpcomingHearings())}`);
  }
  if (/case|matter|filing|court|all.*case|show.*case|list.*case/i.test(lower)) {
    parts.push(`\n## Cases (latest 50)\n${toTable(await fetchCases())}`);
  }
  if (/client|customer/i.test(lower)) {
    parts.push(`\n## Clients\n${toTable(await fetchClients())}`);
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

  // If no specific keywords matched, provide overview with hearings
  if (parts.length === 1) {
    const [cases, upcoming] = await Promise.all([fetchCases(20), fetchUpcomingHearings()]);
    parts.push(`\n## Recent Cases (top 20)\n${toTable(cases)}`);
    parts.push(`\n## Upcoming Hearings\n${toTable(upcoming)}`);
  }

  return parts.join('\n\n');
}

export function getSystemPrompt(dataContext: string): string {
  return `You are **LawMind AI**, an intelligent legal practice assistant for Advocate Manmohan D. Sarda's law firm in Akola/Washim, Maharashtra, India.

You have DIRECT ACCESS to the firm's LIVE database. The data below is REAL — use it to answer ALL questions.

### IMPORTANT DATA NOTES:
- **Hearing dates are in the "next_hearing_date" column of cases** (NOT a separate hearings table)
- When asked about upcoming hearings → show cases where next_hearing_date is in the future
- All case data (case_number, title, status, court_name, next_hearing_date, filing_date) is REAL

### Your Job:
1. **Answer with REAL data** — never say "data not available" if it's in the tables below
2. **Show tables** when listing multiple records
3. **Include case numbers, dates, court names** from the actual data
4. **Format in Markdown** — use tables, bold, headers
5. **Hearing = cases with next_hearing_date** (that's where hearing info lives)

### LIVE DATABASE:
${dataContext}

### Rules:
- ALWAYS use the data above to answer
- When user asks "show hearings" → show cases with next_hearing_date from the data
- Never say "0 hearings" if there are cases with next_hearing_date values
- All amounts in ₹ (Indian Rupees)
- Be specific — use actual case numbers and dates from the data`;
}
