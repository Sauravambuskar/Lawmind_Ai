import { supabase } from "@/integrations/supabase/client";

/** Fetch summary counts for the practice */
async function fetchSummaryStats(): Promise<string> {
  const tables = ['cases', 'clients', 'advocates', 'hearings', 'invoices', 'expenses', 'documents', 'evidence', 'notes', 'contacts', 'advice'] as const;
  const counts: Record<string, number> = {};

  for (const t of tables) {
    const { count } = await supabase.from(t).select('*', { count: 'exact', head: true });
    counts[t] = count ?? 0;
  }

  return Object.entries(counts)
    .map(([k, v]) => `- ${k}: ${v} records`)
    .join('\n');
}

async function fetchCases(limit = 30) {
  const { data } = await supabase
    .from('cases')
    .select('case_number, title, status, case_type, court_name, filing_date')
    .order('created_at', { ascending: false })
    .limit(limit);
  return data ?? [];
}

async function fetchClients(limit = 30) {
  const { data } = await supabase
    .from('clients')
    .select('name, email, phone, city, state')
    .order('created_at', { ascending: false })
    .limit(limit);
  return data ?? [];
}

async function fetchHearings(limit = 30) {
  const { data } = await supabase
    .from('hearings')
    .select('hearing_date, status, court_name, judge_name, purpose, notes')
    .order('hearing_date', { ascending: false })
    .limit(limit);
  return data ?? [];
}

async function fetchInvoices(limit = 30) {
  const { data } = await supabase
    .from('invoices')
    .select('invoice_number, amount, tax, total, status, due_date, paid_date')
    .order('created_at', { ascending: false })
    .limit(limit);
  return data ?? [];
}

async function fetchExpenses(limit = 30) {
  const { data } = await supabase
    .from('expenses')
    .select('title, amount, category, expense_date, description')
    .order('expense_date', { ascending: false })
    .limit(limit);
  return data ?? [];
}

async function fetchAdvocates(limit = 30) {
  const { data } = await supabase
    .from('advocates')
    .select('name, email, phone, specialization, bar_number, status')
    .order('created_at', { ascending: false })
    .limit(limit);
  return data ?? [];
}

async function fetchDocuments(limit = 30) {
  const { data } = await supabase
    .from('documents')
    .select('title, document_type, description')
    .order('created_at', { ascending: false })
    .limit(limit);
  return data ?? [];
}

async function fetchNotes(limit = 30) {
  const { data } = await supabase
    .from('notes')
    .select('title, content')
    .order('created_at', { ascending: false })
    .limit(limit);
  return data ?? [];
}

function toTable(rows: Record<string, unknown>[]): string {
  if (!rows.length) return '_No records found._';
  const keys = Object.keys(rows[0]);
  const header = `| ${keys.join(' | ')} |`;
  const sep = `| ${keys.map(() => '---').join(' | ')} |`;
  const body = rows
    .map((r) => `| ${keys.map((k) => String(r[k] ?? '—')).join(' | ')} |`)
    .join('\n');
  return `${header}\n${sep}\n${body}`;
}

/** Build a context string to inject into the AI system prompt */
export async function buildDataContext(userMessage: string): Promise<string> {
  const lower = userMessage.toLowerCase();
  const parts: string[] = [];

  // Always include summary
  const stats = await fetchSummaryStats();
  parts.push(`## Practice Summary\n${stats}`);

  // Fetch relevant data based on keywords in the user message
  if (/case|matter|filing|court/i.test(lower)) {
    parts.push(`\n## Cases\n${toTable(fetchCases ? await fetchCases() : [])}`);
  }
  if (/client|customer/i.test(lower)) {
    parts.push(`\n## Clients\n${toTable(await fetchClients())}`);
  }
  if (/hearing|schedule|date|calendar|judge/i.test(lower)) {
    parts.push(`\n## Hearings\n${toTable(await fetchHearings())}`);
  }
  if (/invoice|bill|payment|amount|revenue/i.test(lower)) {
    parts.push(`\n## Invoices\n${toTable(await fetchInvoices())}`);
  }
  if (/expense|cost|spend/i.test(lower)) {
    parts.push(`\n## Expenses\n${toTable(await fetchExpenses())}`);
  }
  if (/advocate|lawyer|attorney/i.test(lower)) {
    parts.push(`\n## Advocates\n${toTable(await fetchAdvocates())}`);
  }
  if (/document|file|upload/i.test(lower)) {
    parts.push(`\n## Documents\n${toTable(await fetchDocuments())}`);
  }
  if (/note/i.test(lower)) {
    parts.push(`\n## Notes\n${toTable(await fetchNotes())}`);
  }

  // If no specific keywords matched, fetch everything briefly
  if (parts.length === 1) {
    const [cases, clients, hearings] = await Promise.all([
      fetchCases(10),
      fetchClients(10),
      fetchHearings(10),
    ]);
    parts.push(`\n## Recent Cases\n${toTable(cases)}`);
    parts.push(`\n## Recent Clients\n${toTable(clients)}`);
    parts.push(`\n## Recent Hearings\n${toTable(hearings)}`);
  }

  return parts.join('\n\n');
}

export function getSystemPrompt(dataContext: string): string {
  return `You are **LawMind AI**, an intelligent legal practice management assistant built into the LawMind software platform.

You help lawyers, advocates, and legal staff by:
1. Analyzing practice data (cases, clients, hearings, invoices, expenses, etc.)
2. Generating reports and summaries
3. Answering questions about the firm's data
4. Drafting legal advice and documents
5. Providing insights on case status, deadlines, and financials
6. Offering general legal research assistance

### Current Practice Data
${dataContext}

### Guidelines
- Always be professional, accurate, and concise.
- When presenting data, use **tables** and **lists** for clarity.
- If data is missing or insufficient, say so honestly.
- Format responses in **Markdown** (bold, headers, tables, lists, code blocks).
- When generating reports, include date, title, and structured sections.
- Never fabricate data — only reference what is provided above.
- If asked to search or analyze, work ONLY with the provided data.`;
}
