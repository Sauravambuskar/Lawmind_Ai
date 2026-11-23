import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sendTemplateSms } from "./_sms.js";

function privateHeaders(res: VercelResponse) {
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  res.setHeader("X-Content-Type-Options", "nosniff");
}

/** Verify the caller is a signed-in user and return their id, or null. */
async function getAuthUserId(req: VercelRequest): Promise<string | null> {
  const authorization = req.headers.authorization;
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!authorization?.startsWith("Bearer ") || !supabaseUrl || !anonKey) return null;
  const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: authorization },
  });
  if (!userResponse.ok) return null;
  const user = (await userResponse.json()) as { id?: string };
  return user.id || null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  privateHeaders(res);
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const userId = await getAuthUserId(req);
  if (!userId) return res.status(401).json({ error: "Sign in required" });

  if (!process.env.VITE_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(503).json({ error: "SMS storage is not configured on the server" });
  }

  const body = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
  const templateKey = typeof body.template_key === "string" ? body.template_key.trim() : "";
  if (!templateKey) return res.status(400).json({ error: "A template is required" });

  const result = await sendTemplateSms({
    templateKey,
    numbers: body.numbers,
    variables: Array.isArray(body.variables) ? body.variables.map((v) => String(v ?? "")) : [],
    triggerSource: typeof body.trigger_source === "string" ? body.trigger_source.trim() : "manual",
    sentBy: userId,
  });

  if (result.skipped) {
    return res.status(200).json({ skipped: true, reason: result.reason });
  }
  if (result.ok) {
    return res.status(200).json({ success: true, requestId: result.requestId, numbers: result.sentNumbers, skippedNumbers: result.skippedNumbers });
  }
  return res.status(result.status).json({ success: false, error: result.error, skippedNumbers: result.skippedNumbers });
}
