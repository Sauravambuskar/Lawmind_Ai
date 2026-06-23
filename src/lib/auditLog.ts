import { supabase } from "@/integrations/supabase/client";

export type AuditAction = "insert" | "update" | "delete";

export interface AuditEntry {
  user_id: string;
  action: AuditAction;
  table_name: string;
  record_id?: string;
  old_data?: Record<string, unknown>;
  new_data?: Record<string, unknown>;
}

/** Write an audit log entry (best-effort, never throws). */
export async function writeAuditLog(entry: AuditEntry): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("audit_logs") as any).insert({
      user_id: entry.user_id,
      action: entry.action,
      table_name: entry.table_name,
      record_id: entry.record_id ?? null,
      old_data: entry.old_data ?? null,
      new_data: entry.new_data ?? null,
    });
  } catch {
    // Logging failure must never crash the main flow
  }
}
