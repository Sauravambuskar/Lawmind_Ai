import { useState, useRef } from "react";
import { Upload, FileUp, CheckCircle, AlertCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface CSVImportProps {
  table: string;
  fields: string[];
  queryKey: string;
  label?: string;
}

interface ValidationError {
  row: number;
  field: string;
  message: string;
}

interface ParsedRow {
  data: Record<string, string | null>;
  errors: ValidationError[];
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_"));
  return lines.slice(1).filter(l => l.trim()).map(line => {
    // Handle quoted values containing commas
    const values: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (const ch of line) {
      if (ch === '"') { inQuotes = !inQuotes; continue; }
      if (ch === "," && !inQuotes) { values.push(cur.trim()); cur = ""; continue; }
      cur += ch;
    }
    values.push(cur.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = values[i] ?? ""; });
    return row;
  });
}

function validateRows(
  rows: Record<string, string>[],
  fields: string[],
  userId: string,
): ParsedRow[] {
  const requiredField = fields[0]; // convention: first field is required

  return rows.map((row, idx) => {
    const errors: ValidationError[] = [];
    const data: Record<string, string | null> = { user_id: userId };

    fields.forEach(f => {
      const value = row[f] ?? row[f.replace(/_/g, " ")] ?? "";
      data[f] = value || null;
    });

    // Required field check
    if (!data[requiredField]) {
      errors.push({ row: idx + 2, field: requiredField, message: `"${requiredField}" is required` });
    }

    return { data, errors };
  });
}

export function CSVImport({ table, fields, queryKey, label = "Import CSV" }: CSVImportProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ success: number; failed: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setResult(null);
    setValidationErrors([]);

    const reader = new FileReader();
    reader.onload = ev => {
      const text = ev.target?.result as string;
      const rows = parseCSV(text);
      setRawRows(rows);

      // Run validation immediately on file selection
      const parsed = validateRows(rows, fields, user.id);
      const allErrors = parsed.flatMap(p => p.errors);
      setValidationErrors(allErrors);
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!user || rawRows.length === 0) return;
    if (validationErrors.length > 0) {
      toast.error("Fix validation errors before importing");
      return;
    }

    setImporting(true);

    const parsed = validateRows(rawRows, fields, user.id);
    const validRows = parsed.filter(p => p.errors.length === 0).map(p => p.data);

    // Batch insert all valid rows in a single request
    const { error } = await (supabase.from(table as any) as any).insert(validRows);

    const success = error ? 0 : validRows.length;
    const failed = error ? validRows.length : 0;

    setResult({ success, failed });
    setImporting(false);

    if (!error) {
      queryClient.invalidateQueries({ queryKey: [queryKey] });
      toast.success(`Imported ${success} records successfully`);
    } else {
      toast.error(error.message || "Import failed");
    }
  };

  const reset = () => {
    setRawRows([]);
    setValidationErrors([]);
    setResult(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const preview = rawRows.slice(0, 5);
  const hasErrors = validationErrors.length > 0;

  return (
    <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm"><Upload className="w-4 h-4 mr-2" /> {label}</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Import from CSV</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Required columns: <span className="font-mono text-xs bg-muted px-1 py-0.5 rounded">{fields.join(", ")}</span>
          </p>

          <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
            <FileUp className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} className="hidden" id="csv-upload" />
            <label htmlFor="csv-upload" className="text-sm text-primary cursor-pointer hover:underline font-medium">
              Choose CSV file
            </label>
            {rawRows.length > 0 && (
              <p className="text-xs text-muted-foreground mt-1">{rawRows.length} rows detected</p>
            )}
          </div>

          {/* Validation errors */}
          {hasErrors && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-1.5 max-h-36 overflow-y-auto">
              <div className="flex items-center gap-2 text-sm font-semibold text-destructive mb-2">
                <XCircle className="w-4 h-4" />
                {validationErrors.length} validation error(s) — fix your CSV before importing
              </div>
              {validationErrors.map((err, i) => (
                <p key={i} className="text-xs text-destructive">
                  Row {err.row}: {err.message}
                </p>
              ))}
            </div>
          )}

          {/* Preview table */}
          {preview.length > 0 && !hasErrors && (
            <div className="overflow-x-auto">
              <p className="text-xs text-muted-foreground mb-2">Preview (first {preview.length} rows):</p>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    {Object.keys(preview[0]).slice(0, 5).map(k => (
                      <th key={k} className="text-left py-1 px-2 text-muted-foreground">{k}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, i) => (
                    <tr key={i} className="border-b border-border">
                      {Object.values(row).slice(0, 5).map((v, j) => (
                        <td key={j} className="py-1 px-2 truncate max-w-[120px]">{v}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              {result.failed === 0
                ? <CheckCircle className="w-5 h-5 text-emerald-500" />
                : <AlertCircle className="w-5 h-5 text-amber-500" />}
              <div className="text-sm">
                <span className="font-medium text-foreground">{result.success} imported</span>
                {result.failed > 0 && <span className="text-destructive ml-2">• {result.failed} failed</span>}
              </div>
            </div>
          )}

          <Button
            onClick={handleImport}
            disabled={rawRows.length === 0 || hasErrors || importing}
            className="w-full"
          >
            {importing
              ? "Importing..."
              : hasErrors
                ? "Fix errors to import"
                : `Import ${rawRows.length} Records`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
