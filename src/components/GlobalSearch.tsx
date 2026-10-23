import { useState, useEffect, useRef } from "react";
import { Search, X, FileText, Users, Briefcase, Scale, Calendar } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface SearchResult {
  type: "case" | "client" | "advocate" | "hearing" | "invoice";
  label: string;
  sub: string;
  path: string;
}

const typeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  case: Briefcase,
  client: Users,
  advocate: Scale,
  hearing: Calendar,
  invoice: FileText,
};

export function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setShowResults(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (query.length < 2) { setResults([]); return; }
    const timeout = setTimeout(async () => {
      setLoading(true);
      const q = `%${query}%`;
      const [cases, clients, advocates, hearings, invoices] = await Promise.all([
        supabase.from("cases").select("id, title, case_number").ilike("title", q).limit(5),
        supabase.from("clients").select("id, name, email").ilike("name", q).limit(5),
        supabase.from("advocates").select("id, name, specialization").ilike("name", q).limit(5),
        (supabase.from("hearings") as any).select("id, title, court_name").ilike("title", q).limit(5),
        supabase.from("invoices").select("id, invoice_number, status").ilike("invoice_number", q).limit(5),
      ]);
      const items: SearchResult[] = [
        ...(cases.data || []).map(c => ({ type: "case" as const, label: c.title, sub: c.case_number, path: `/cases/${c.id}` })),
        ...(clients.data || []).map(c => ({ type: "client" as const, label: c.name, sub: c.email || "", path: `/clients/${c.id}` })),
        ...(advocates.data || []).map(a => ({ type: "advocate" as const, label: a.name, sub: a.specialization || "", path: `/advocates/${a.id}` })),
        ...(hearings.data || []).map((h: any) => ({ type: "hearing" as const, label: h.title || "Hearing", sub: h.court_name || "", path: "/hearings" })),
        ...(invoices.data || []).map(i => ({ type: "invoice" as const, label: i.invoice_number, sub: i.status, path: "/invoices" })),
      ];
      setResults(items);
      setLoading(false);
    }, 300);
    return () => clearTimeout(timeout);
  }, [query]);

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search..."
          className="h-9 w-full min-w-0 pl-9 pr-8 bg-muted/50 border-border"
          value={query}
          onChange={e => { setQuery(e.target.value); setShowResults(true); }}
          onFocus={() => query.length >= 2 && setShowResults(true)}
        />
        {query && (
          <button onClick={() => { setQuery(""); setResults([]); }} className="absolute right-2 top-1/2 -translate-y-1/2">
            <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
          </button>
        )}
      </div>
      {showResults && query.length >= 2 && (
        <div className="fixed left-3 right-3 top-[4.25rem] z-50 max-h-[70vh] overflow-y-auto rounded-lg border border-border bg-card shadow-lg sm:absolute sm:left-0 sm:right-auto sm:top-full sm:mt-1 sm:w-full sm:max-h-80">
          {loading ? (
            <p className="p-4 text-sm text-muted-foreground text-center">Searching...</p>
          ) : results.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground text-center">No results found</p>
          ) : (
            results.map((r, i) => {
              const Icon = typeIcons[r.type];
              return (
                <button
                  key={i}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 transition-colors text-left border-b border-border last:border-0"
                  onClick={() => { navigate(r.path); setShowResults(false); setQuery(""); }}
                >
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{r.label}</p>
                    <p className="text-xs text-muted-foreground truncate">{r.type} • {r.sub}</p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
