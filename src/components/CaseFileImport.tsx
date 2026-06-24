import { useState, useRef } from "react";
import { Upload, FileUp, CheckCircle, AlertCircle, XCircle, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

// ── Column Mapping ────────────────────────────────────────────────────
// Maps CSV header names (case-insensitive, trimmed) to DB column names
const CSV_TO_DB_MAP: Record<string, string> = {
  "nexthearingdate": "next_hearing_date",
  "next hearing date": "next_hearing_date",
  "casenumber": "case_number",
  "case number": "case_number",
  "casetitle": "title",
  "case title": "title",
  "cnrnumber": "cnr_number",
  "cnr number": "cnr_number",
  "filenumber": "file_number",
  "file number": "file_number",
  "courttype": "court_type",
  "court type": "court_type",
  "courtname": "court_name",
  "court name": "court_name",
  "filingdate": "filing_date",
  "filing date": "filing_date",
  "casestage": "case_stage",
  "case stage": "case_stage",
  "stage": "stage",
  "client": "description", // stored temporarily in description; client name needs resolution
  "casestatus": "status",
  "case status": "status",
  "lawyer": "case_notes_1", // stored in case_notes_1 as reference
  "lasthearingdate": "last_hearing_date",
  "last hearing date": "last_hearing_date",
  "caseimporteddate": "case_imported_date",
  "case imported date": "case_imported_date",
  "casetag(s)": "case_tags",
  "casetags": "case_tags",
  "case tags": "case_tags",
  "case tag(s)": "case_tags",
  "caseside": "case_side",
  "case side": "case_side",
  "disposeddate": "disposed_date",
  "disposed date": "disposed_date",
  "documentsize": "document_size",
  "document size": "document_size",
  "firnumer": "fir_number",
  "firnumber": "fir_number",
  "fir number": "fir_number",
  "policestation": "police_station",
  "police station": "police_station",
  "casenotes - 1": "case_notes_1",
  "casenotes-1": "case_notes_1",
  "case notes 1": "case_notes_1",
  "casenotes - 2": "case_notes_2",
  "casenotes-2": "case_notes_2",
  "case notes 2": "case_notes_2",
};

// DB columns that are date fields (need formatting)
const DATE_FIELDS = new Set([
  "next_hearing_date", "filing_date", "last_hearing_date",
  "case_imported_date", "disposed_date",
]);

// ── Parse CSV ─────────────────────────────────────────────────────────
function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return { headers: [], rows: [] };

  // Parse header
  const headers = parseCSVLine(lines[0]);

  // Parse data rows
  const rows = lines.slice(1).filter(l => l.trim()).map(line => {
    const values = parseCSVLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = values[i] ?? "";
    });
    return row;
  });

  return { headers, rows };
}

function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (const ch of line) {
    if (ch === '"') { inQuotes = !inQuotes; continue; }
    if (ch === "," && !inQuotes) { values.push(cur.trim()); cur = ""; continue; }
    cur += ch;
  }
  values.push(cur.trim());
  return values;
}

// ── Date Parsing ──────────────────────────────────────────────────────
function parseDate(value: string): string | null {
  if (!value || value === "--" || value === "NA" || value === "N/A") return null;
  // Try common date formats: DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD, DD.MM.YYYY
  const cleaned = value.trim();

  // Already ISO format
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) return cleaned;

  // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const match = cleaned.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (match) {
    const [, day, month, year] = match;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  // MM/DD/YYYY (US format) - try if day > 12
  const matchUS = cleaned.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (matchUS) {
    const [, m, d, y] = matchUS;
    if (Number(m) > 12) {
      return `${y}-${d.padStart(2, "0")}-${m.padStart(2, "0")}`;
    }
  }

  // Try native Date parsing as fallback
  const d = new Date(cleaned);
  if (!isNaN(d.getTime())) {
    return d.toISOString().slice(0, 10);
  }

  return null;
}

// ── Component ─────────────────────────────────────────────────────────
export function CaseFileImport() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);
  const [mappedCount, setMappedCount] = useState(0);
  const [unmappedHeaders, setUnmappedHeaders] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ success: number; failed: number; errors: string[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setHeaders([]);
    setRawRows([]);
    setMappedCount(0);
    setUnmappedHeaders([]);
    setResult(null);
    setImporting(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setResult(null);

    const reader = new FileReader();
    reader.onload = ev => {
      const text = ev.target?.result as string;
      const { headers: h, rows } = parseCSV(text);
      setHeaders(h);
      setRawRows(rows);

      // Check mapping
      let mapped = 0;
      const unmapped: string[] = [];
      h.forEach(header => {
        const normalized = header.toLowerCase().trim().replace(/\s+/g, " ");
        const noSpaces = normalized.replace(/\s/g, "");
        if (CSV_TO_DB_MAP[normalized] || CSV_TO_DB_MAP[noSpaces]) {
          mapped++;
        } else {
          unmapped.push(header);
        }
      });
      setMappedCount(mapped);
      setUnmappedHeaders(unmapped);
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!user || rawRows.length === 0) return;
    setImporting(true);
    setResult(null);

    const errors: string[] = [];
    let success = 0;
    let failed = 0;

    // Batch transform rows
    const dbRows: Record<string, any>[] = [];

    for (let i = 0; i < rawRows.length; i++) {
      const csvRow = rawRows[i];
      const dbRow: Record<string, any> = {
        created_by: user.id,
        status: "open",
        case_imported_date: new Date().toISOString().slice(0, 10),
      };

      // Map each CSV column to DB column
      for (const [csvHeader, csvValue] of Object.entries(csvRow)) {
        if (!csvValue || csvValue.trim() === "" || csvValue === "--" || csvValue === "NA") continue;

        const normalized = csvHeader.toLowerCase().trim().replace(/\s+/g, " ");
        const noSpaces = normalized.replace(/\s/g, "");
        const dbCol = CSV_TO_DB_MAP[normalized] || CSV_TO_DB_MAP[noSpaces];

        if (!dbCol) continue;

        // Handle date fields
        if (DATE_FIELDS.has(dbCol)) {
          const parsed = parseDate(csvValue);
          if (parsed) dbRow[dbCol] = parsed;
        }
        // Handle status field mapping
        else if (dbCol === "status") {
          const statusLower = csvValue.toLowerCase().trim();
          if (["open", "closed", "pending", "disposed", "settled", "archived"].includes(statusLower)) {
            dbRow[dbCol] = statusLower;
          } else {
            dbRow[dbCol] = "open";
            if (!dbRow.case_stage) dbRow.case_stage = csvValue;
          }
        }
        // Handle "Client" column — store in description
        else if (dbCol === "description" && csvHeader.toLowerCase().trim() === "client") {
          dbRow["description"] = `Client: ${csvValue}`;
        }
        // Handle "Lawyer" column — store in case_notes_1
        else if (dbCol === "case_notes_1" && csvHeader.toLowerCase().trim() === "lawyer") {
          dbRow.case_notes_1 = `Lawyer: ${csvValue}`;
        }
        else {
          dbRow[dbCol] = csvValue.trim();
        }
      }

      // Ensure required fields have values
      if (!dbRow.case_number) {
        dbRow.case_number = `IMP-${String(i + 1).padStart(4, "0")}`;
      }
      if (!dbRow.title) {
        dbRow.title = dbRow.case_number;
      }

      dbRows.push(dbRow);
    }

    // ── Normalize all rows to have the same keys (PostgREST requirement) ──
    // Only allow columns that actually exist in the DB schema
    const VALID_DB_COLUMNS = new Set([
      "id", "title", "case_number", "description", "status", "client_id", "advocate_id",
      "court_name", "filing_date", "next_hearing_date", "tags", "template_id", "created_by",
      "created_at", "updated_at", "cnr_number", "file_number", "court_type", "case_stage",
      "stage", "last_hearing_date", "case_imported_date", "case_tags", "case_side",
      "disposed_date", "document_size", "fir_number", "police_station", "case_notes_1", "case_notes_2",
    ]);

    // Filter each row to only include valid columns
    const filteredRows = dbRows.map(row => {
      const filtered: Record<string, any> = {};
      for (const [k, v] of Object.entries(row)) {
        if (VALID_DB_COLUMNS.has(k)) {
          filtered[k] = v;
        }
      }
      return filtered;
    });

    const allKeys = new Set<string>();
    filteredRows.forEach(row => Object.keys(row).forEach(k => allKeys.add(k)));
    const normalizedRows = filteredRows.map(row => {
      const normalized: Record<string, any> = {};
      allKeys.forEach(k => {
        normalized[k] = row[k] !== undefined ? row[k] : null;
      });
      return normalized;
    });

    // Batch insert (Supabase supports up to 1000 rows per insert)
    // Use raw fetch to bypass PostgREST schema cache issues after ALTER TABLE
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
    const session = (await supabase.auth.getSession()).data.session;
    const authToken = session?.access_token || supabaseKey;

    const batchSize = 500;
    for (let i = 0; i < normalizedRows.length; i += batchSize) {
      const batch = normalizedRows.slice(i, i + batchSize);
      try {
        const res = await fetch(`${supabaseUrl}/rest/v1/cases`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": supabaseKey,
            "Authorization": `Bearer ${authToken}`,
            "Prefer": "return=minimal,resolution=ignore-duplicates",
          },
          body: JSON.stringify(batch),
        });
        if (!res.ok) {
          const errBody = await res.json().catch(() => ({ message: res.statusText }));
          failed += batch.length;
          errors.push(`Batch ${Math.floor(i / batchSize) + 1}: ${errBody.message || res.statusText}`);
        } else {
          success += batch.length;
        }
      } catch (e: any) {
        failed += batch.length;
        errors.push(`Batch ${Math.floor(i / batchSize) + 1}: ${e.message || "Network error"}`);
      }
    }

    setResult({ success, failed, errors });
    setImporting(false);

    if (success > 0) {
      queryClient.invalidateQueries({ queryKey: ["cases"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-cases"] });
      toast.success(`Imported ${success} case(s) successfully`);
    }
    if (failed > 0) {
      toast.error(`${failed} row(s) failed to import`);
    }
  };

  const preview = rawRows.slice(0, 5);

  return (
    <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Upload className="w-4 h-4 mr-2" /> Import Cases
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-primary" />
            Import Cases from CSV File
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Expected columns info */}
          <div className="bg-muted/30 border border-border rounded-lg p-3">
            <p className="text-xs font-semibold text-muted-foreground mb-1.5">Expected CSV columns (any order, case-insensitive):</p>
            <p className="text-[11px] text-muted-foreground font-mono leading-relaxed">
              NextHearingDate, CaseNumber, CaseTitle, CNRNumber, FileNumber, CourtType, CourtName, FilingDate, CaseStage, Stage, Client, CaseStatus, Lawyer, LastHearingDate, caseImportedDate, CaseTag(s), CaseSide, DisposedDate, DocumentSize, FIRNumer, policeStation, CaseNotes&nbsp;-&nbsp;1, CaseNotes&nbsp;-&nbsp;2
            </p>
          </div>

          {/* File upload area */}
          <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
            <FileUp className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleFile} className="hidden" id="case-csv-upload" />
            <label htmlFor="case-csv-upload" className="text-sm text-primary cursor-pointer hover:underline font-semibold">
              Choose CSV file to import
            </label>
            <p className="text-xs text-muted-foreground mt-1">Supports .csv files with comma-separated values</p>
            {rawRows.length > 0 && (
              <div className="mt-3 inline-flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-full px-3 py-1">
                <CheckCircle className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs font-medium text-primary">{rawRows.length} rows detected</span>
              </div>
            )}
          </div>

          {/* Mapping status */}
          {headers.length > 0 && (
            <div className="rounded-lg border border-border p-3 space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-500" />
                <span className="text-sm font-medium text-foreground">{mappedCount} of {headers.length} columns mapped</span>
              </div>
              {unmappedHeaders.length > 0 && (
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">Unmapped columns (will be skipped):</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{unmappedHeaders.join(", ")}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Preview table */}
          {preview.length > 0 && (
            <div className="overflow-x-auto border border-border rounded-lg">
              <p className="text-xs text-muted-foreground px-3 py-2 bg-muted/30 border-b border-border font-medium">
                Preview (first {preview.length} of {rawRows.length} rows):
              </p>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/20">
                    {headers.slice(0, 7).map(k => (
                      <th key={k} className="text-left py-2 px-2.5 text-muted-foreground font-semibold whitespace-nowrap">{k}</th>
                    ))}
                    {headers.length > 7 && <th className="py-2 px-2.5 text-muted-foreground">+{headers.length - 7} more</th>}
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, i) => (
                    <tr key={i} className="border-b border-border last:border-0">
                      {headers.slice(0, 7).map(h => (
                        <td key={h} className="py-1.5 px-2.5 truncate max-w-[120px] text-foreground">{row[h] || "—"}</td>
                      ))}
                      {headers.length > 7 && <td className="py-1.5 px-2.5 text-muted-foreground">…</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className={`p-3 rounded-lg border ${result.failed === 0 ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-700" : "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700"}`}>
              <div className="flex items-center gap-2 mb-1">
                {result.failed === 0
                  ? <CheckCircle className="w-5 h-5 text-emerald-600" />
                  : <AlertCircle className="w-5 h-5 text-amber-600" />}
                <span className="text-sm font-semibold">{result.success} imported successfully</span>
                {result.failed > 0 && <span className="text-sm text-destructive ml-2">• {result.failed} failed</span>}
              </div>
              {result.errors.length > 0 && (
                <div className="mt-2 space-y-1">
                  {result.errors.map((err, i) => (
                    <p key={i} className="text-xs text-destructive flex items-start gap-1.5">
                      <XCircle className="w-3 h-3 mt-0.5 shrink-0" /> {err}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Import button */}
          <Button
            onClick={handleImport}
            disabled={rawRows.length === 0 || importing}
            className="w-full"
            size="lg"
          >
            {importing
              ? "Importing..."
              : rawRows.length === 0
                ? "Select a file to begin"
                : `Import ${rawRows.length} Cases`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
