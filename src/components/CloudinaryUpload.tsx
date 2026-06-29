import { useState, useRef } from "react";
import { Upload, FileCheck, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { uploadToCloudinary, isCloudinaryConfigured, formatFileSize } from "@/lib/cloudinaryUpload";
import { toast } from "sonner";

interface CloudinaryUploadProps {
  onUpload: (url: string, filename: string) => void;
  accept?: string;
  label?: string;
  maxSizeMB?: number;
}

/**
 * File upload button that uploads to Cloudinary and returns the URL.
 * Use this anywhere you need file upload (documents, receipts, etc.)
 */
export function CloudinaryUpload({ onUpload, accept = ".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif", label = "Upload File", maxSizeMB = 10 }: CloudinaryUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState<{ name: string; size: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check if configured
    if (!isCloudinaryConfigured()) {
      toast.error("File storage not configured. Add Cloudinary credentials in .env");
      return;
    }

    // Size check
    if (file.size > maxSizeMB * 1024 * 1024) {
      toast.error(`File too large. Maximum ${maxSizeMB} MB allowed.`);
      return;
    }

    setUploading(true);
    try {
      const result = await uploadToCloudinary(file);
      setUploaded({ name: result.originalFilename, size: result.size });
      onUpload(result.url, result.originalFilename);
      toast.success(`Uploaded: ${result.originalFilename}`);
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  if (!isCloudinaryConfigured()) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground p-2 bg-muted/30 rounded-lg border border-border">
        <AlertCircle className="w-4 h-4 text-amber-500" />
        <span>File upload not configured. Add <code className="bg-muted px-1 rounded">VITE_CLOUDINARY_CLOUD_NAME</code> and <code className="bg-muted px-1 rounded">VITE_CLOUDINARY_UPLOAD_PRESET</code> to .env</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <input ref={fileRef} type="file" accept={accept} onChange={handleFile} className="hidden" id="cloudinary-upload" />
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        className="w-full"
      >
        {uploading ? (
          <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Uploading...</>
        ) : uploaded ? (
          <><FileCheck className="w-4 h-4 mr-2 text-emerald-500" />{uploaded.name} ({formatFileSize(uploaded.size)})</>
        ) : (
          <><Upload className="w-4 h-4 mr-2" />{label}</>
        )}
      </Button>
    </div>
  );
}
