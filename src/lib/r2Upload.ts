/**
 * Cloudflare R2 uploads. The browser never sees R2 credentials: /api/r2-upload
 * returns a short-lived presigned PUT URL, and files are read back via /files/*.
 */
import { supabase } from "@/integrations/supabase/client";

export type R2Folder = "evidence" | "documents" | "case-documents" | "receipts" | "important-docs";

export interface R2UploadResult {
  url: string;
  key: string;
  size: number;
  filename: string;
}

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Your session has expired. Please sign in again.");
  return { Authorization: `Bearer ${token}` };
}

export async function uploadToR2(file: File, folder: R2Folder = "evidence"): Promise<R2UploadResult> {
  const contentType = file.type || "application/octet-stream";

  const response = await fetch("/api/r2-upload", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeader()) },
    body: JSON.stringify({ filename: file.name, contentType, folder }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `Could not start upload (${response.status})`);
  }

  const { uploadUrl, publicUrl, key } = await response.json();

  const uploadResponse = await fetch(uploadUrl, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": contentType },
  });
  if (!uploadResponse.ok) {
    throw new Error(`Upload failed (${uploadResponse.status})`);
  }

  return { url: publicUrl, key, size: file.size, filename: file.name };
}

/**
 * Removes an R2 file referenced by a stored /files/... URL. Other URLs
 * (legacy Cloudinary links) are ignored. Never throws: a leftover file must
 * not block deleting the database record.
 */
export async function deleteR2File(url: string | null | undefined): Promise<void> {
  if (!url?.startsWith("/files/")) return;
  try {
    await fetch("/api/r2-delete", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeader()) },
      body: JSON.stringify({ key: decodeURIComponent(url.slice("/files/".length)) }),
    });
  } catch (err) {
    console.warn("Could not delete stored file:", err);
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
