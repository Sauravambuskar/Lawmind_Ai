/**
 * Cloudflare R2 uploads. The browser never sees R2 credentials: /api/r2-upload
 * returns a short-lived presigned PUT URL, and files are read back via /files/*.
 */

export type R2Folder = "evidence" | "documents" | "case-documents" | "receipts" | "important-docs";

export interface R2UploadResult {
  url: string;
  key: string;
  size: number;
  filename: string;
}

export async function uploadToR2(file: File, folder: R2Folder = "evidence"): Promise<R2UploadResult> {
  const contentType = file.type || "application/octet-stream";

  const response = await fetch("/api/r2-upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
