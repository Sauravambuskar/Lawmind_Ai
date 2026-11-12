import { decryptSecret } from "./_secret-crypto.js";

export interface RuntimeIntegrationSettings {
  r2AccountId: string;
  r2AccessKeyId: string;
  r2SecretAccessKey: string;
  r2BucketName: string;
  ecourtsApiKey: string;
  cronSecret: string;
  ecourtsBatchSize: number;
}

interface StoredSettingsRow {
  r2_account_id?: string | null;
  r2_access_key_id?: string | null;
  r2_secret_access_key?: string | null;
  r2_bucket_name?: string | null;
  ecourts_api_key?: string | null;
  ecourts_batch_size?: number | null;
}

const defaults = (): RuntimeIntegrationSettings => ({
  r2AccountId: process.env.R2_ACCOUNT_ID || "",
  r2AccessKeyId: process.env.R2_ACCESS_KEY_ID || "",
  r2SecretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
  r2BucketName: process.env.R2_BUCKET_NAME || "",
  ecourtsApiKey: process.env.ECOURTS_API_KEY || "",
  cronSecret: process.env.CRON_SECRET || "",
  ecourtsBatchSize: Number(process.env.ECOURTS_CRON_BATCH_SIZE || 10),
});

let cached: { value: RuntimeIntegrationSettings; expiresAt: number } | null = null;

export function clearIntegrationSettingsCache(): void {
  cached = null;
}

export async function getIntegrationSettings(): Promise<RuntimeIntegrationSettings> {
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const fallback = defaults();
  const url = process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return fallback;

  try {
    const response = await fetch(
      `${url}/rest/v1/integration_settings?select=*&id=eq.system&limit=1`,
      { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
    );
    if (!response.ok) return fallback;
    const rows = await response.json() as StoredSettingsRow[];
    const row = rows[0];
    if (!row) return fallback;

    const value: RuntimeIntegrationSettings = {
      r2AccountId: row.r2_account_id ? decryptSecret(row.r2_account_id) : fallback.r2AccountId,
      r2AccessKeyId: row.r2_access_key_id ? decryptSecret(row.r2_access_key_id) : fallback.r2AccessKeyId,
      r2SecretAccessKey: row.r2_secret_access_key ? decryptSecret(row.r2_secret_access_key) : fallback.r2SecretAccessKey,
      r2BucketName: row.r2_bucket_name || fallback.r2BucketName,
      ecourtsApiKey: row.ecourts_api_key ? decryptSecret(row.ecourts_api_key) : fallback.ecourtsApiKey,
      // Vercel Cron signs requests with the deployment CRON_SECRET. Keeping
      // this environment-owned prevents a dashboard edit from locking out jobs.
      cronSecret: fallback.cronSecret,
      ecourtsBatchSize: Number(row.ecourts_batch_size || fallback.ecourtsBatchSize || 10),
    };
    cached = { value, expiresAt: Date.now() + 30_000 };
    return value;
  } catch {
    return fallback;
  }
}

export function hasR2Settings(settings: RuntimeIntegrationSettings): boolean {
  return Boolean(
    settings.r2AccountId &&
    settings.r2AccessKeyId &&
    settings.r2SecretAccessKey &&
    settings.r2BucketName
  );
}

export function masked(value: string): string | null {
  if (!value) return null;
  const tail = value.slice(-4);
  return `••••${tail}`;
}
