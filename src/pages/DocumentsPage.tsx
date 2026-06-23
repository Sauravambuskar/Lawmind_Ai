import { useState } from "react";
import { useMinLoader } from "@/hooks/useMinLoader";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Pencil, FileText, Download, Files, Eye, X, ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { usePagination } from "@/hooks/usePagination";
import { TablePagination } from "@/components/TablePagination";
import { DeleteConfirm } from "@/components/DeleteConfirm";
import { FileUpload } from "@/components/FileUpload";
import { PageLoader } from "@/components/PageLoader";
import { exportToCSV } from "@/lib/export";

type DocumentRow = {
  id: string;
  title: string;
  description: string | null;
  document_type: string | null;
  file_url: string | null;
  case_id: string | null;
  created_at: string;
  cases?: { title: string; case_number: string } | null;
};

const emptyForm = { title: "", description: "", document_type: "", file_url: "", case_id: "" };

function getFileType(url: string): "pdf" | "image" | "other" {
  const lower = url.toLowerCase().split("?")[0];
  if (lower.endsWith(".pdf")) return "pdf";
  if (/\.(png|jpe?g|gif|webp|svg|bmp)$/.test(lower)) return "image";
  return "other";
}

// ── Document Preview Dialog ───────────────────────────────────────────────
function DocumentPreview({ doc, onClose }: { doc: DocumentRow; onClose: () => void }) {
  const fileType = doc.file_url ? getFileType(doc.file_url) : "other";

  return (
    <Dialog open onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-5 py-4 border-b border-border flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-base font-bold">{doc.title}</DialogTitle>
              {doc.description && <p className="text-xs text-muted-foreground mt-0.5">{doc.description}</p>}
            </div>
            <div className="flex items-center gap-2">
              {doc.file_url && (
                <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm">
                    <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> Open in Tab
                  </Button>
                </a>
              )}
              <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden bg-muted/30">
          {!doc.file_url ? (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium">No file attached to this document</p>
              </div>
            </div>
          ) : fileType === "pdf" ? (
            <iframe
              src={doc.file_url}
              title={doc.title}
              className="w-full h-full border-0"
            />
          ) : fileType === "image" ? (
            <div className="h-full flex items-center justify-center p-4">
              <img
                src={doc.file_url}
                alt={doc.title}
                className="max-w-full max-h-full object-contain rounded-lg shadow-md"
              />
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium">Preview not available for this file type</p>
                <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block">
                  <Button variant="outline" size="sm" className="mt-3">
                    <Download className="w-3.5 h-3.5 mr-1.5" /> Download File
                  </Button>
                </a>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function DocumentsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [previewDoc, setPreviewDoc] = useState<DocumentRow | null>(null);

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ["documents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("*, cases(title, case_number)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as DocumentRow[];
    },
  });

  const { data: cases = [] } = useQuery({
    queryKey: ["cases"],
    queryFn: async () => {
      const { data } = await supabase.from("cases").select("id, title, case_number");
      return data || [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = { ...form, case_id: form.case_id || null };
      if (editId) {
        const { error } = await supabase.from("documents").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("documents").insert({ ...payload, user_id: user!.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      closeDialog();
      toast.success(editId ? "Document updated successfully" : "Document added successfully");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("documents").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      toast.success("Document deleted");
    },
  });

  const filtered = documents.filter(d => (d.title || "").toLowerCase().includes(search.toLowerCase()));
  const { paginatedItems, currentPage, totalPages, totalItems, startIndex, nextPage, prevPage, goToPage } = usePagination(filtered);
  const showLoader = useMinLoader(isLoading);
  if (showLoader) return <PageLoader />;

  const closeDialog = () => { setOpen(false); setEditId(null); setForm(emptyForm); };
  const openEdit = (d: DocumentRow) => {
    setEditId(d.id);
    setForm({ title: d.title, description: d.description || "", document_type: d.document_type || "", file_url: d.file_url || "", case_id: d.case_id || "" });
    setOpen(true);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Document preview overlay */}
      {previewDoc && <DocumentPreview doc={previewDoc} onClose={() => setPreviewDoc(null)} />}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <PageHeader title="Document Center" breadcrumbs={[{ label: "Dashboard", path: "/" }, { label: "Documents" }]} />
        <div className="flex gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            onClick={() =>
              exportToCSV(
                filtered.map(d => ({
                  title: d.title,
                  type: d.document_type || "",
                  case: d.cases?.case_number || "",
                  date: new Date(d.created_at).toLocaleDateString(),
                })),
                "documents",
              )
            }
            className="bg-background"
          >
            <Download className="w-4 h-4 mr-2" /> Export
          </Button>
          <Dialog open={open} onOpenChange={v => { if (!v) closeDialog(); else setOpen(true); }}>
            <DialogTrigger asChild>
              <Button onClick={() => { setEditId(null); setForm(emptyForm); }} className="bg-primary text-primary-foreground shadow-sm hover:shadow-md transition-all">
                <Plus className="w-4 h-4 mr-2" /> Add Document
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle className="text-xl font-bold">{editId ? "Edit Document" : "Upload New Document"}</DialogTitle></DialogHeader>
              <div className="grid gap-4 py-4 px-1 custom-scrollbar">
                <div className="grid gap-2"><Label className="font-semibold text-muted-foreground">Title *</Label><Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} className="bg-muted/50" /></div>
                <div className="grid gap-2"><Label className="font-semibold text-muted-foreground">Description</Label><Input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} className="bg-muted/50" /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label className="font-semibold text-muted-foreground">Type</Label>
                    <Input value={form.document_type} onChange={e => setForm(p => ({ ...p, document_type: e.target.value }))} placeholder="e.g. Contract" className="bg-muted/50" />
                  </div>
                  <div className="grid gap-2">
                    <Label className="font-semibold text-muted-foreground">Case Link</Label>
                    <Select value={form.case_id} onValueChange={v => setForm(p => ({ ...p, case_id: v }))}>
                      <SelectTrigger className="bg-muted/50"><SelectValue placeholder="Select case" /></SelectTrigger>
                      <SelectContent>{cases.map(c => <SelectItem key={c.id} value={c.id}>{c.case_number}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-2"><Label className="font-semibold text-muted-foreground">File Attachment</Label><FileUpload value={form.file_url} onChange={url => setForm(p => ({ ...p, file_url: url }))} folder="documents" /></div>
              </div>
              <Button onClick={() => saveMutation.mutate()} disabled={!form.title || saveMutation.isPending} className="w-full">
                {saveMutation.isPending ? "Saving..." : editId ? "Update Document" : "Upload Document"}
              </Button>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="bg-card border border-border shadow-sm rounded-xl overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 border-b border-border bg-muted/10 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search documents by title..." className="pl-9 bg-background" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium px-2">
            Showing <span className="text-foreground mx-1">{paginatedItems.length}</span> of <span className="text-foreground mx-1">{totalItems}</span> documents
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b border-border text-muted-foreground">
              <tr>
                <th className="text-left py-3.5 px-5 font-semibold text-[11px] uppercase tracking-widest w-12">#</th>
                <th className="text-left py-3.5 px-5 font-semibold text-[11px] uppercase tracking-widest">Document</th>
                <th className="text-left py-3.5 px-5 font-semibold text-[11px] uppercase tracking-widest">Case Link</th>
                <th className="text-left py-3.5 px-5 font-semibold text-[11px] uppercase tracking-widest">Type</th>
                <th className="text-left py-3.5 px-5 font-semibold text-[11px] uppercase tracking-widest">Date Added</th>
                <th className="text-right py-3.5 px-5 font-semibold text-[11px] uppercase tracking-widest">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                        <Files className="w-8 h-8 text-muted-foreground opacity-50" />
                      </div>
                      <p className="text-base font-semibold text-foreground">No documents found</p>
                      <p className="text-sm text-muted-foreground mt-1 max-w-sm">There are no documents matching your search. Upload a new document to get started.</p>
                    </div>
                  </td>
                </tr>
              ) : paginatedItems.map((d, i) => (
                <tr key={d.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors group">
                  <td className="py-4 px-5 text-muted-foreground font-mono">{startIndex + i + 1}</td>
                  <td className="py-4 px-5">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 w-8 h-8 rounded-md bg-blue-500/10 flex items-center justify-center shrink-0 border border-blue-500/20">
                        <FileText className="w-4 h-4 text-blue-600" />
                      </div>
                      <div>
                        <div className="font-semibold text-foreground">{d.title}</div>
                        {d.description && <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{d.description}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-5">
                    {d.case_id ? (
                      <span className="font-mono font-medium text-foreground bg-muted/50 px-2 py-0.5 rounded text-xs border border-border/50">
                        {d.cases?.case_number || "Unknown Case"}
                      </span>
                    ) : (
                      <span className="text-muted-foreground italic text-xs">Unlinked</span>
                    )}
                  </td>
                  <td className="py-4 px-5">
                    <span className="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border bg-muted text-muted-foreground border-border/50">
                      {d.document_type || "General"}
                    </span>
                  </td>
                  <td className="py-4 px-5 text-muted-foreground font-medium">
                    {new Date(d.created_at).toLocaleDateString()}
                  </td>
                  <td className="py-4 px-5 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                      {d.file_url && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 hover:bg-blue-500/10 hover:text-blue-500 transition-colors"
                          title="Preview Document"
                          onClick={() => setPreviewDoc(d)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      )}
                      {d.file_url && (
                        <a href={d.file_url} target="_blank" rel="noopener noreferrer">
                          <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-blue-500/10 hover:text-blue-500 transition-colors" title="Download Document">
                            <Download className="w-4 h-4" />
                          </Button>
                        </a>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => openEdit(d)} className="h-8 w-8 hover:bg-primary/10 hover:text-primary transition-colors">
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <DeleteConfirm onConfirm={() => deleteMutation.mutate(d.id)} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {paginatedItems.length > 0 && (
          <div className="border-t border-border p-4 bg-muted/10">
            <TablePagination currentPage={currentPage} totalPages={totalPages} totalItems={totalItems} startIndex={startIndex} pageSize={10} onPrev={prevPage} onNext={nextPage} onGoTo={goToPage} />
          </div>
        )}
      </div>
    </div>
  );
}
