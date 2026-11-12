import type { VercelRequest, VercelResponse } from "@vercel/node";

function privateHeaders(res: VercelResponse) {
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  res.setHeader("X-Content-Type-Options", "nosniff");
}

async function getSuperAdmin(req: VercelRequest): Promise<boolean> {
  const authorization = req.headers.authorization;
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!authorization?.startsWith("Bearer ") || !supabaseUrl || !anonKey) return false;

  const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: authorization },
  });
  if (!userResponse.ok) return false;
  const user = await userResponse.json() as { id?: string };
  if (!user.id) return false;

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const databaseKey = serviceKey || anonKey;
  const databaseAuthorization = serviceKey ? `Bearer ${serviceKey}` : authorization;
  const profileResponse = await fetch(
    `${supabaseUrl}/rest/v1/profiles?select=role&user_id=eq.${encodeURIComponent(user.id)}&limit=1`,
    { headers: { apikey: databaseKey, Authorization: databaseAuthorization } },
  );
  if (!profileResponse.ok) return false;
  const profiles = await profileResponse.json() as Array<{ role?: string }>;
  return profiles[0]?.role === "super_admin";
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  privateHeaders(res);
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    if (!(await getSuperAdmin(req))) {
      return res.status(403).json({ error: "Super Admin access required" });
    }

    return res.status(200).json({
      supabase: Boolean(process.env.VITE_SUPABASE_URL && process.env.VITE_SUPABASE_ANON_KEY),
      cloudflareR2: Boolean(
        process.env.R2_ACCOUNT_ID &&
        process.env.R2_ACCESS_KEY_ID &&
        process.env.R2_SECRET_ACCESS_KEY &&
        process.env.R2_BUCKET_NAME
      ),
      ecourts: Boolean(process.env.ECOURTS_API_KEY),
      scheduledSync: Boolean(process.env.CRON_SECRET),
      ecourtsBatchSize: Number(process.env.ECOURTS_CRON_BATCH_SIZE || 10),
    });
  } catch {
    return res.status(500).json({ error: "Could not load integration status" });
  }
}
