import { useState } from "react";
import { useMinLoader } from "@/hooks/useMinLoader";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Pencil, Lock, Download, Eye, Fingerprint, ShieldAlert } from "lucide-react";
import { format } from "date-fns";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AITextarea } from "@/components/AITextarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { usePagination } from "@/hooks/usePagination";
import { TablePagination } from "@/components/TablePagination";
import { DeleteConfirm } from "@/components/DeleteConfirm";
import { FileUpload } from "@/components/FileUpload";
import { PageLoader } from "@/components/PageLoader";
import { exportToCSV } from "@/lib/export";
import { getSignedFileUrl } from "@/lib/storage";

const emptyForm = { case_id: "", title: "", description: "", evidence_type: "", file_url: "" };
const EVIDENCE_PASSWORD = "evidence@123";

function getFileType(url: string): "image" | "pdf" | "other" {
  const lower = url.toLowerCase();
  if (/\.(jpg|jpeg|png|gif|webp|svg|bmp)(\?|$)/.test(lower)) return "image";
  if (/\.pdf(\?|$)/.test(lower)) return "pdf";
  return "other";
}

export default function EvidencePage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [unlocked, setUnlocked] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState("");

  const { data: evidence = [], isLoading } = useQuery({
    queryKey: ["evidence"],
    queryFn: async () => {
      const { data, error } = await supabase.from("evidence").select("*, cases(title, case_number)").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
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
      if (editId) {
        const { error } = await supabase.from("evidence").update(form).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("evidence").insert({ ...form, created_by: user!.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["evidence"] });
      closeDialog();
      toast.success(editId ? "Evidence updated successfully" : "Evidence securely added");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("evidence").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["evidence"] });
      toast.success("Evidence deleted");
    },
  });

  const closeDialog = () => { setOpen(false); setEditId(null); setForm(emptyForm); };
  const openEdit = (e: any) => {
    setEditId(e.id);
    setForm({ case_id: e.case_id, title: e.title, description: e.description || "", evidence_type: e.evidence_type || "", file_url: e.file_url || "" });
    setOpen(true);
  };

  const filtered = evidence.filter(e =>
    (e.title || "").toLowerCase().includes(search.toLowerCase()) ||
    ((e as any).cases?.case_number || "").toLowerCase().includes(search.toLowerCase()) ||
    (e.evidence_type || "").toLowerCase().includes(search.toLowerCase())
  );

  const { paginatedItems, currentPage, totalPages, totalItems, startIndex, nextPage, prevPage, goToPage } = usePagination(filtered);

  const showLoader = useMinLoader(isLoading);
  if (showLoader) return <PageLoader />;

  const handleUnlock = () => {
    if (password === EVIDENCE_PASSWORD) {
      setUnlocked(true);
      setPasswordError("");
      toast.success("Evidence Vault Unlocked");
    } else {
      setPasswordError("Incorrect password. Access denied.");
    }
  };

  if (!unlocked) {
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <PageHeader title="Evidence Vault" breadcrumbs={[{ label: "Dashboard", path: "/" }, { label: "Evidence" }]} />
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="bg-card border border-border shadow-lg rounded-2xl p-8 max-w-md w-full relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 via-rose-500 to-red-500" />
            <div className="flex flex-col items-center gap-5 text-center">
              <div className="w-20 h-20 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shadow-inner">
                <Lock className="w-10 h-10 text-rose-500" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-foreground tracking-tight">Restricted Access</h2>
                <p className="text-sm text-muted-foreground mt-2 max-w-[260px] mx-auto">
                  The Evidence Vault contains sensitive case materials. Please verify your clearance to proceed.
                </p>
              </div>
              <div className="w-full grid gap-4 mt-4">
                <div className="space-y-2">
                  <Input
                    type="password"
                    placeholder="Enter vault password"
                    value={password}
                    className={`h-12 text-center text-lg tracking-widest bg-muted/50 transition-colors ${passwordError ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                    onChange={e => { setPassword(e.target.value); setPasswordError(""); }}
                    onKeyDown={e => e.key === "Enter" && handleUnlock()}
                  />
                  {passwordError && <p className="text-xs font-medium text-destructive animate-in slide-in-from-top-1">{passwordError}</p>}
                </div>
                <Button onClick={handleUnlock} className="w-full h-12 text-base font-semibold bg-rose-600 hover:bg-rose-700 text-white shadow-md hover:shadow-lg transition-all">
                  Unlock Vault
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <PageHeader title="Evidence Vault" breadcrumbs={[{ label: "Dashboard", path: "/" }, { label: "Evidence" }]} />
        <div className="flex gap-2 w-full sm:w-auto">
          <Button variant="outline" onClick={() => exportToCSV(filtered.map(e => ({ title: e.title, case: (e as any).cases?.case_number || "", type: e.evidence_type || "", date: e.submitted_date || "" })), "evidence")} className="bg-background">
            <Download className="w-4 h-4 mr-2" /> Export Log
          </Button>
          
          <Dialog open={open} onOpenChange={v => { if (!v) closeDialog(); else setOpen(true); }}>
            <DialogTrigger asChild>
              <Button onClick={() => { setEditId(null); setForm(emptyForm); }} className="bg-rose-600 hover:bg-rose-700 text-white shadow-sm hover:shadow-md transition-all">
                <Plus className="w-4 h-4 mr-2" /> Log Evidence
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle className="text-xl font-bold">{editId ? "Update Evidence Record" : "Log New Evidence"}</DialogTitle></DialogHeader>
              <div className="grid gap-4 py-4 px-1 custom-scrollbar">
                <div className="grid gap-2">
                  <Label className="font-semibold text-muted-foreground">Case Reference *</Label>
                  <Select value={form.case_id} onValueChange={v => setForm(p => ({ ...p, case_id: v }))}>
                    <SelectTrigger className="bg-muted/50"><SelectValue placeholder="Select case" /></SelectTrigger>
                    <SelectContent>{cases.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.case_number} — {c.title}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2"><Label className="font-semibold text-muted-foreground">Evidence Title *</Label><Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} className="bg-muted/50" /></div>
                  <div className="grid gap-2"><Label className="font-semibold text-muted-foreground">Type Classification</Label><Input value={form.evidence_type} onChange={e => setForm(p => ({ ...p, evidence_type: e.target.value }))} placeholder="e.g. Photo, Digital" className="bg-muted/50" /></div>
                </div>
                <div className="grid gap-2"><Label className="font-semibold text-muted-foreground">Detailed Description</Label><AITextarea rows={3} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} className="bg-muted/50" context="Legal evidence description" /></div>
                <div className="grid gap-2"><Label className="font-semibold text-muted-foreground">Secure File Upload</Label><FileUpload value={form.file_url} onChange={url => setForm(p => ({ ...p, file_url: url }))} folder="evidence" /></div>
              </div>
              <Button onClick={() => saveMutation.mutate()} disabled={!form.case_id || !form.title || saveMutation.isPending} className="w-full bg-rose-600 hover:bg-rose-700 text-white">
                {saveMutation.isPending ? "Encrypting & Saving..." : editId ? "Update Record" : "Log to Vault"}
              </Button>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="bg-card border border-border shadow-sm rounded-xl overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-rose-500/20" />
        
        {/* Toolbar */}
        <div className="p-4 border-b border-border bg-muted/10 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search evidence titles or case IDs..." className="pl-9 bg-background" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium px-2">
            <ShieldAlert className="w-4 h-4 text-rose-500" />
            Showing <span className="text-foreground">{paginatedItems.length}</span> of <span className="text-foreground">{totalItems}</span> secure records
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b border-border text-muted-foreground">
              <tr>
                <th className="text-left py-3.5 px-5 font-semibold text-[11px] uppercase tracking-widest w-12">#</th>
                <th className="text-left py-3.5 px-5 font-semibold text-[11px] uppercase tracking-widest">Evidence Item</th>
                <th className="text-left py-3.5 px-5 font-semibold text-[11px] uppercase tracking-widest">Case Link</th>
                <th className="text-left py-3.5 px-5 font-semibold text-[11px] uppercase tracking-widest">Type</th>
                <th className="text-left py-3.5 px-5 font-semibold text-[11px] uppercase tracking-widest">Date Logged</th>
                <th className="text-right py-3.5 px-5 font-semibold text-[11px] uppercase tracking-widest">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                        <Fingerprint className="w-8 h-8 text-muted-foreground opacity-50" />
                      </div>
                      <p className="text-base font-semibold text-foreground">Vault is empty</p>
                      <p className="text-sm text-muted-foreground mt-1 max-w-sm">No evidence records found matching your search. Ensure you have the correct spelling or log new evidence.</p>
                    </div>
                  </td>
                </tr>
              ) : paginatedItems.map((e, i) => (
                <tr key={e.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors group">
                  <td className="py-4 px-5 text-muted-foreground font-mono">{startIndex + i + 1}</td>
                  <td className="py-4 px-5">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 w-8 h-8 rounded-md bg-rose-500/10 flex items-center justify-center shrink-0 border border-rose-500/20">
                        <Fingerprint className="w-4 h-4 text-rose-600" />
                      </div>
                      <div>
                        <div className="font-semibold text-foreground">{e.title}</div>
                        {e.description && <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{e.description}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-5">
                    {e.case_id ? (
                      <span className="font-mono font-medium text-foreground bg-muted/50 px-2 py-0.5 rounded text-xs border border-border/50">
                        {(e as any).cases?.case_number || "Unknown Case"}
                      </span>
                    ) : (
                      <span className="text-muted-foreground italic text-xs">Unlinked</span>
                    )}
                  </td>
                  <td className="py-4 px-5">
                    <span className="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border bg-muted text-muted-foreground border-border/50">
                      {e.evidence_type || "General"}
                    </span>
                  </td>
                  <td className="py-4 px-5 text-muted-foreground font-medium">
                    {e.submitted_date ? format(new Date(e.submitted_date), "MMM d, yyyy") : "—"}
                  </td>
                  <td className="py-4 px-5 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                      {e.file_url && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-rose-500/10 hover:text-rose-600 transition-colors" title="View Secure File" onClick={async () => {
                          const url = await getSignedFileUrl(e.file_url);
                          if (url) { setPreviewUrl(url); setPreviewTitle(e.title); }
                          else toast.error("Could not unlock file preview");
                        }}>
                          <Eye className="w-4 h-4" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => openEdit(e)} className="h-8 w-8 hover:bg-primary/10 hover:text-primary transition-colors">
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <DeleteConfirm onConfirm={() => deleteMutation.mutate(e.id)} />
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

      {/* In-app file preview dialog */}
      <Dialog open={!!previewUrl} onOpenChange={v => { if (!v) { setPreviewUrl(null); setPreviewTitle(""); } }}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-4 border-b border-border bg-muted/20">
            <DialogTitle className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-rose-500" />
              {previewTitle || "Secure Evidence Preview"}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-[40vh] overflow-auto p-4 bg-muted/5 flex items-center justify-center">
            {previewUrl && getFileType(previewUrl) === "image" && (
              <img src={previewUrl} alt={previewTitle} className="max-w-full max-h-[70vh] rounded-lg shadow-md border border-border" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; setPreviewUrl(previewUrl + "#fallback"); }} />
            )}
            {previewUrl && getFileType(previewUrl) === "pdf" && (
              <iframe src={previewUrl} className="w-full h-[70vh] rounded-lg border border-border shadow-md bg-white" title={previewTitle} />
            )}
            {previewUrl && getFileType(previewUrl) === "other" && (
              <div className="flex flex-col items-center justify-center py-12 gap-6 text-center max-w-sm">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                  <ShieldAlert className="w-8 h-8 text-muted-foreground opacity-50" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg text-foreground">Preview Unavailable</h3>
                  <p className="text-sm text-muted-foreground mt-1">This file type cannot be previewed securely in the browser. Please download it to view.</p>
                </div>
                <a href={previewUrl} target="_blank" rel="noreferrer" className="w-full">
                  <Button className="w-full bg-rose-600 hover:bg-rose-700 text-white"><Download className="w-4 h-4 mr-2" /> Download Secure File</Button>
                </a>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}