import { supabase } from "@/integrations/supabase/client";

const BUCKET = "legal-files";

/**
 * Extract the storage file path from either a full public URL or a relative path.
 * Handles both legacy Supabase URLs and the PHP /uploads paths.
 */
export function extractFilePath(pathOrUrl: string): string {
  if (!pathOrUrl) return pathOrUrl;
  if (pathOrUrl.startsWith("http")) {
    // Legacy Supabase storage URL
    const marker = `/storage/v1/object/public/${BUCKET}/`;
    const idx = pathOrUrl.indexOf(marker);
    if (idx !== -1) return decodeURIComponent(pathOrUrl.substring(idx + marker.length));

    const signedMarker = `/storage/v1/object/sign/${BUCKET}/`;
    const sIdx = pathOrUrl.indexOf(signedMarker);
    if (sIdx !== -1) return decodeURIComponent(pathOrUrl.substring(sIdx + signedMarker.length).split("?")[0]);
  }
  // PHP /uploads/<path> — strip the leading /uploads/ prefix if present
  const uploadsMarker = "/uploads/";
  if (pathOrUrl.startsWith(uploadsMarker)) {
    return pathOrUrl.substring(uploadsMarker.length);
  }
  return pathOrUrl;
}

/**
 * Get a URL for a file.
 * Uses the PHP storage layer (mysqlClient shim), which returns a public /uploads/ URL.
 * Returns null on failure.
 */
export async function getSignedFileUrl(pathOrUrl: string): Promise<string | null> {
  if (!pathOrUrl) return null;
  const filePath = extractFilePath(pathOrUrl);
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(filePath, 3600);
  if (error) {
    console.error("Failed to get file URL:", error.message);
    return null;
  }
  return data.signedUrl;
}
