import { supabase } from "@/integrations/supabase/client";

export interface ErrorLogEntry {
  message: string;
  context?: string;   // e.g. "CasesPage.saveMutation"
  stack?: string;
  user_id?: string;
}

/** Log an error to the error_logs Supabase table (best-effort, never throws). */
export async function logError(entry: ErrorLogEntry): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("error_logs") as any).insert({
      message: entry.message,
      context: entry.context ?? null,
      stack: entry.stack ?? null,
      user_id: entry.user_id ?? null,
    });
  } catch {
    // Silently ignore — logging must never crash the app
  }
}

/** Convenience wrapper to log a caught Error object. */
export function logCaughtError(err: unknown, context?: string, userId?: string): void {
  const e = err instanceof Error ? err : new Error(String(err));
  logError({ message: e.message, context, stack: e.stack, user_id: userId });
}
