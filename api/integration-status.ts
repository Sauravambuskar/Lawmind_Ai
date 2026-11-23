import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  clearIntegrationSettingsCache,
  getIntegrationSettings,
  hasR2Settings,
  hasFast2SmsSettings,
  masked,
} from "./_integration-settings.js";
import { encryptSecret } from "./_secret-crypto.js";

function privateHeaders(res: VercelResponse) {
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  res.setHeader("X-Content-Type-Options", "nosniff");
}

async function getSuperAdminId(req: VercelRequest): Promise<string | null> {
  const authorization = req.headers.authorization;
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!authorization?.startsWith("Bearer ") || !supabaseUrl || !anonKey) return null;

  const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: authorization },
  });
  if (!userResponse.ok) return null;
  const user = await userResponse.json() as { id?: string };
  if (!user.id) return null;

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const databaseKey = serviceKey || anonKey;
  const databaseAuthorization = serviceKey ? `Bearer ${serviceKey}` : authorization;
  const profileResponse = await fetch(
    `${supabaseUrl}/rest/v1/profiles?select=role&user_id=eq.${encodeURIComponent(user.id)}&limit=1`,
    { headers: { apikey: databaseKey, Authorization: databaseAuthorization } },
  );
  if (!profileResponse.ok) return null;
  const profiles = await profileResponse.json() as Array<{ role?: string }>;
  return profiles[0]?.role === "super_admin" ? user.id : null;
}

const editableFields = [
  "r2_account_id",
  "r2_access_key_id",
  "r2_secret_access_key",
  "r2_bucket_name",
  "ecourts_api_key",
  "fast2sms_api_key",
  "fast2sms_sender_id",
] as const;

const encryptedFields = new Set(["r2_account_id", "r2_access_key_id", "r2_secret_access_key", "ecourts_api_key", "fast2sms_api_key"]);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  privateHeaders(res);
  if (req.method !== "GET" && req.method !== "PUT") {
    res.setHeader("Allow", "GET, PUT");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const superAdminId = await getSuperAdminId(req);
    if (!superAdminId) {
      return res.status(403).json({ error: "Super Admin access required" });
    }

    if (req.method === "PUT") {
      const supabaseUrl = process.env.VITE_SUPABASE_URL;
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!supabaseUrl || !serviceKey) {
        return res.status(503).json({ error: "Server settings storage is not configured" });
      }

      const body = req.body && typeof req.body === "object" ? req.body as Record<string, unknown> : {};
      const update: Record<string, unknown> = {
        id: "system",
        updated_by: superAdminId,
        updated_at: new Date().toISOString(),
      };
      for (const field of editableFields) {
        const value = body[field];
        if (typeof value === "string" && value.trim()) {
          const clean = value.trim();
          if (clean.length > 1024) return res.status(400).json({ error: `${field} is too long` });
          update[field] = encryptedFields.has(field) ? encryptSecret(clean) : clean;
        }
      }
      if (typeof update.r2_bucket_name === "string" && !/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(update.r2_bucket_name)) {
        return res.status(400).json({ error: "Enter a valid Cloudflare R2 bucket name" });
      }
      if (typeof body.ecourts_batch_size !== "undefined") {
        const batchSize = Number(body.ecourts_batch_size);
        if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 20) {
          return res.status(400).json({ error: "eCourts batch size must be between 1 and 20" });
        }
        update.ecourts_batch_size = batchSize;
      }
      if (typeof update.fast2sms_sender_id === "string" && !/^[A-Z0-9]{3,6}$/.test(update.fast2sms_sender_id)) {
        return res.status(400).json({ error: "Sender ID must be 3-6 uppercase letters/digits (your DLT-approved header, e.g. CORADV)" });
      }
      if (typeof body.fast2sms_enabled !== "undefined") {
        update.fast2sms_enabled = Boolean(body.fast2sms_enabled);
      }
      if (typeof body.fast2sms_auto_send !== "undefined") {
        update.fast2sms_auto_send = Boolean(body.fast2sms_auto_send);
      }
      if (typeof body.sms_default_number === "string") {
        const digits = body.sms_default_number.replace(/\D/g, "");
        if (digits === "") {
          update.sms_default_number = null; // cleared
        } else {
          let ten = digits;
          if (ten.length === 12 && ten.startsWith("91")) ten = ten.slice(2);
          if (ten.length === 11 && ten.startsWith("0")) ten = ten.slice(1);
          if (!/^[6-9]\d{9}$/.test(ten)) {
            return res.status(400).json({ error: "Enter a valid 10-digit Indian mobile number for the default SMS number" });
          }
          update.sms_default_number = ten;
        }
      }
      if (typeof body.sms_default_mode !== "undefined") {
        const mode = String(body.sms_default_mode);
        if (!["off", "copy", "route"].includes(mode)) {
          return res.status(400).json({ error: "Default SMS mode must be off, copy or route" });
        }
        update.sms_default_mode = mode;
      }

      const saveResponse = await fetch(`${supabaseUrl}/rest/v1/integration_settings?on_conflict=id`, {
        method: "POST",
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates,return=minimal",
        },
        body: JSON.stringify(update),
      });
      if (!saveResponse.ok) {
        return res.status(500).json({ error: "Could not save server integration settings" });
      }

      const changedFields = Object.keys(update).filter((field) => !["id", "updated_by", "updated_at"].includes(field));
      await fetch(`${supabaseUrl}/rest/v1/audit_logs`, {
        method: "POST",
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          user_id: superAdminId,
          action: "update",
          table_name: "integration_settings",
          new_data: { changed_fields: changedFields },
        }),
      }).catch(() => undefined);
      clearIntegrationSettingsCache();
    }

    const settings = await getIntegrationSettings();

    return res.status(200).json({
      supabase: Boolean(process.env.VITE_SUPABASE_URL && process.env.VITE_SUPABASE_ANON_KEY),
      cloudflareR2: hasR2Settings(settings),
      ecourts: Boolean(settings.ecourtsApiKey),
      scheduledSync: Boolean(settings.cronSecret),
      ecourtsBatchSize: settings.ecourtsBatchSize,
      sms: hasFast2SmsSettings(settings),
      smsEnabled: settings.fast2smsEnabled,
      smsAutoSend: settings.fast2smsAutoSend,
      smsDefaultNumber: settings.smsDefaultNumber || null,
      smsDefaultMode: settings.smsDefaultMode,
      masked: {
        r2AccountId: masked(settings.r2AccountId),
        r2AccessKeyId: masked(settings.r2AccessKeyId),
        r2SecretAccessKey: masked(settings.r2SecretAccessKey),
        r2BucketName: settings.r2BucketName || null,
        ecourtsApiKey: masked(settings.ecourtsApiKey),
        cronSecret: settings.cronSecret ? "Vercel managed" : null,
        fast2smsApiKey: masked(settings.fast2smsApiKey),
        fast2smsSenderId: settings.fast2smsSenderId || null,
      },
    });
  } catch {
    return res.status(500).json({ error: "Could not load integration status" });
  }
}
