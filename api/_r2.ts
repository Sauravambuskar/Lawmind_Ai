import type { VercelRequest } from '@vercel/node';
import { S3Client } from '@aws-sdk/client-s3';

export const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || '';

export const ALLOWED_FOLDERS = [
  'evidence',
  'documents',
  'case-documents',
  'receipts',
  'important-docs',
] as const;

export const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID || ''}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  },
});

export function isAllowedKey(key: string): boolean {
  if (!key || key.includes('..') || key.startsWith('/')) return false;
  return ALLOWED_FOLDERS.some((f) => key.startsWith(`${f}/`));
}

/** Returns the Supabase user id for the request's bearer token, or null. */
export async function getUserId(req: VercelRequest): Promise<string | null> {
  const auth = req.headers.authorization;
  const url = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!auth?.startsWith('Bearer ') || !url || !anonKey) return null;

  const res = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: auth },
  });
  if (!res.ok) return null;
  const user = await res.json();
  return user?.id ?? null;
}
