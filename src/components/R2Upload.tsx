import { useState, useRef } from "react";
import { Upload, FileCheck, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { uploadToR2, formatFileSize, type R2Folder } from "@/lib/r2Upload";
import { toast } from "sonner";

interface R2UploadProps {
  onUpload: (url: string, filename: string) => void;
  value?: string;
  accept?: string;
  label?: string;
  maxSizeMB?: number;
  folder?: R2Folder;
}

/**
 * Cloudflare R2 file upload component
 * Uploads files to R2 bucket and returns public URL
 */
export function R2Upload({ 
  onUpload, 
  value = "",
  accept = ".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.webp", 
  label = "Upload File", 
  maxSizeMB = 15,
  folder = "evidence"
}: R2UploadProps) {
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState<{ name: string; size: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Size check
    if (file.size > maxSizeMB * 1024 * 1024) {
      toast.error(`File too large. Maximum ${maxSizeMB} MB allowed.`);
      return;
    }

    setUploading(true);
    try {
      const result = await uploadToR2(file, folder);
      setUploaded({ name: result.filename, size: result.size });
      onUpload(result.url, result.filename);
      toast.success(`Uploaded: ${result.filename}`);
    } catch (err: any) {
      console.error("R2 upload error:", err);
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleClear = () => {
    setUploaded(null);
    onUpload("", "");
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="space-y-2">
      <input 
        ref={fileRef} 
        type="file" 
        accept={accept} 
        onChange={handleFile} 
        className="hidden" 
      />
      
      {value || uploaded ? (
        <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg border border-border">
          <FileCheck className="w-4 h-4 text-emerald-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-foreground truncate">
              {uploaded?.name || "File uploaded"}
            </div>
            {uploaded?.size && (
              <div className="text-xs text-muted-foreground">
                {formatFileSize(uploaded.size)}
              </div>
            )}
          </div>
          {value && (
            <a 
              href={value} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline shrink-0"
            >
              View
            </a>
          )}
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-7 w-7 shrink-0" 
            onClick={handleClear}
            type="button"
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="w-full"
        >
          {uploading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Uploading to R2...
            </>
          ) : (
            <>
              <Upload className="w-4 h-4 mr-2" />
              {label}
            </>
          )}
        </Button>
      )}
    </div>
  );
}
