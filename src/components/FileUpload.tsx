import { useState, useRef, useEffect } from "react";
import { Upload, X, FileIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { getSignedFileUrl, extractFilePath } from "@/lib/storage";

interface FileUploadProps {
  value: string;
  onChange: (url: string) => void;
  folder?: string;
}

export function FileUpload({ value, onChange, folder = "general" }: FileUploadProps) {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [displayUrl, setDisplayUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!value) { setDisplayUrl(null); return; }
    getSignedFileUrl(value).then(url => setDisplayUrl(url));
  }, [value]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const filePath = `${user.id}/${folder}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("legal-files")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Store the file path, not a public URL
      onChange(filePath);
      toast.success("File uploaded");
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const fileName = value ? extractFilePath(value).split("/").pop() : "";

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={handleUpload}
        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
      />
      {value ? (
        <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg border border-border">
          <FileIcon className="w-4 h-4 text-primary shrink-0" />
          {displayUrl ? (
            <a
              href={displayUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline truncate flex-1"
            >
              {fileName}
            </a>
          ) : (
            <span className="text-sm text-muted-foreground truncate flex-1">{fileName}</span>
          )}
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onChange("")}>
            <X className="w-3 h-3" />
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          <Upload className="w-4 h-4 mr-2" />
          {uploading ? "Uploading..." : "Upload File"}
        </Button>
      )}
    </div>
  );
}
