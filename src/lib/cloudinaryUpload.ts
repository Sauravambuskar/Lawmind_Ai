/**
 * Cloudinary File Upload Utility
 * 
 * Uses Cloudinary's unsigned upload preset for client-side file uploads.
 * Supports: PDF, DOCX, images, and any file type.
 * 
 * Free Plan: 25 GB storage + 25 GB bandwidth/month
 * 
 * SETUP:
 * 1. Create account at https://cloudinary.com
 * 2. Go to Settings → Upload → Upload Presets → Add Upload Preset
 * 3. Set "Signing Mode" to "Unsigned"
 * 4. Set the preset name (e.g. "lawmind_docs")
 * 5. Set VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET in .env
 */

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string || "";
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET as string || "";

export interface UploadResult {
  url: string;
  publicId: string;
  format: string;
  size: number;
  originalFilename: string;
}

/**
 * Upload a file to Cloudinary (unsigned upload)
 * Returns the secure URL to store in Supabase
 */
export async function uploadToCloudinary(file: File): Promise<UploadResult> {
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    throw new Error("Cloudinary not configured. Set VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET in .env");
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", UPLOAD_PRESET);
  formData.append("folder", "lawmind"); // Organize in a folder

  // Use "raw" resource type for PDFs/docs, "image" for images, "auto" to detect
  const resourceType = file.type.startsWith("image/") ? "image" : "raw";

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`,
    { method: "POST", body: formData }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: "Upload failed" } }));
    throw new Error(err.error?.message || "Cloudinary upload failed");
  }

  const data = await res.json();

  return {
    url: data.secure_url,
    publicId: data.public_id,
    format: data.format || file.name.split(".").pop() || "",
    size: data.bytes || file.size,
    originalFilename: data.original_filename || file.name,
  };
}

/**
 * Delete a file from Cloudinary (requires server-side for signed deletion)
 * For now, just returns true — cleanup can be done via Cloudinary dashboard
 */
export async function deleteFromCloudinary(_publicId: string): Promise<boolean> {
  // Unsigned deletion is not supported by Cloudinary
  // Files can be manually cleaned from dashboard or via server-side API
  return true;
}

/**
 * Check if Cloudinary is configured
 */
export function isCloudinaryConfigured(): boolean {
  return Boolean(CLOUD_NAME && UPLOAD_PRESET);
}

/**
 * Get file size in human readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
