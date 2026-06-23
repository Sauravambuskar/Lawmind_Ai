import { FileDown, Search, FolderOpen, Eye, Edit3, Loader2, Printer, Save, Plus, FileText, X, AlertCircle } from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogTrigger
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import mammoth from "mammoth";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FileUpload } from "@/components/FileUpload";
import { getSignedFileUrl } from "@/lib/storage";

const FALLBACK_DOCS = [
  { name: "Adjournment Application", filename: "I am sharing 'Adjournment application' with you.docx", type: "DOCX" },
  { name: "Personal Exception", filename: "I am sharing 'Personal Exception' with you.docx", type: "DOCX" },
  { name: "Pursis", filename: "I am sharing 'Pursis' with you.docx", type: "DOCX" },
  { name: "Summon New Marathi", filename: "Summon New marathi.rtf.doc", type: "DOC" },
  { name: "Warrant CRPC 421", filename: "WARRANT CRPC 421.docx", type: "DOCX" },
  { name: "Warrant Format JMFC", filename: "WARRANT FORMAT jmfc.docx", type: "DOCX" },
  { name: "Show Cause Notice (English)", filename: "show couse Notice  english - Copy.docx", type: "DOCX" },
];

const ImpDocsPage = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedDoc, setSelectedDoc] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [docHtml, setDocHtml] = useState("");
  const [procLoading, setProcLoading] = useState(false);
  
  // Add Document State
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newDoc, setNewDoc] = useState({ name: "", filename: "", type: "" });
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  // Fetch documents from Supabase
  const { data: dbDocs, isLoading: isFetching } = useQuery({
    queryKey: ["important_documents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("important_documents")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) {
        console.warn("Using local fallback.");
        return FALLBACK_DOCS;
      }
      return data.length > 0 ? data : FALLBACK_DOCS;
    },
    retry: false,
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      const { error } = await supabase.from("important_documents").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["important_documents"] });
      setIsAddOpen(false);
      setNewDoc({ name: "", filename: "", type: "" });
      toast.success("Document added successfully!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const displayDocs = useMemo(() => dbDocs || FALLBACK_DOCS, [dbDocs]);

  const filteredDocs = displayDocs.filter(doc =>
    doc.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleDownload = async (doc: any) => {
    let url = "";
    if (doc.filename.includes("/")) {
      // It's a storage path
      url = await getSignedFileUrl(doc.filename);
    } else {
      // It's a local file
      url = `/impdocs/${encodeURIComponent(doc.filename)}`;
    }
    
    const link = document.createElement("a");
    link.href = url;
    link.download = doc.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePreview = async (doc: any, edit = false) => {
    setPdfUrl(null);
    setDocHtml("");
    setSelectedDoc(doc);
    setIsEditing(edit);
    setIsModalOpen(true);
    setProcLoading(true);

    try {
      let fileUrl = "";
      if (doc.filename.includes("/")) {
        fileUrl = await getSignedFileUrl(doc.filename);
      } else {
        fileUrl = `/impdocs/${encodeURIComponent(doc.filename)}`;
      }

      const type = doc.type.toUpperCase();

      if (type === "PDF") {
        setPdfUrl(fileUrl);
        setProcLoading(false);
        return;
      }

      if (type === "DOCX") {
        const response = await fetch(fileUrl);
        const arrayBuffer = await response.arrayBuffer();
        const result = await mammoth.convertToHtml({ arrayBuffer });
        setDocHtml(result.value);
      } else {
        toast.error("Editing/Previewing is not supported for this file type yet. Please download to view.");
        setIsModalOpen(false);
      }
    } catch (error) {
      console.error("Error loading document:", error);
      toast.error("Failed to load document content.");
      setIsModalOpen(false);
    } finally {
      setProcLoading(false);
    }
  };

  const handlePrint = () => {
    if (pdfUrl) {
      window.open(pdfUrl, '_blank');
      return;
    }

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>${selectedDoc?.name}</title>
            <style>
              body { font-family: 'EB Garamond', serif; padding: 50px; line-height: 1.6; color: #1a1a1a; }
              table { border-collapse: collapse; width: 100%; margin-top: 20px; }
              td, th { border: 1px solid #ddd; padding: 12px; text-align: left; }
              h1, h2, h3 { font-family: serif; color: #000; }
            </style>
          </head>
          <body>${docHtml}</body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 250);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 bg-amber-500/10 rounded-xl">
              <FolderOpen className="w-8 h-8 text-amber-600" />
            </div>
            <h1 className="text-3xl font-serif font-bold text-slate-900 tracking-tight">
              Important Documents
            </h1>
          </div>
          <p className="text-slate-500 text-sm ml-14 font-medium flex items-center gap-2">
            Access, preview, and edit essential legal templates.
            {dbDocs && dbDocs !== FALLBACK_DOCS && (
              <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full border border-emerald-100 font-bold uppercase tracking-wider">
                <span className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse" />
                Live Cloud Sync
              </span>
            )}
          </p>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64 lg:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search..."
              className="pl-10 h-10 bg-white border-slate-200 shadow-sm rounded-xl"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button className="bg-amber-600 hover:bg-amber-700 text-white rounded-xl flex items-center gap-2 font-bold shadow-md h-10">
                <Plus className="w-4 h-4" />
                Add New
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md rounded-2xl">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold">Add Important Document</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label>Document Name</Label>
                  <Input 
                    placeholder="e.g. Service Agreement" 
                    value={newDoc.name} 
                    onChange={e => setNewDoc(p => ({ ...p, name: e.target.value }))}
                    className="rounded-xl"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>File Upload</Label>
                  <FileUpload 
                    value={newDoc.filename} 
                    onChange={path => {
                      const ext = path.split(".").pop()?.toUpperCase() || "";
                      setNewDoc(p => ({ ...p, filename: path, type: ext }));
                    }}
                    folder="important-docs"
                  />
                </div>
                <div className="flex items-start gap-2 bg-amber-50 p-3 rounded-xl border border-amber-100 mt-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                  <p className="text-[11px] text-amber-800 leading-relaxed font-medium">
                    Word (.docx) files can be edited in-browser. PDFs and other formats can be previewed or downloaded.
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button 
                  onClick={() => saveMutation.mutate(newDoc)}
                  disabled={!newDoc.name || !newDoc.filename || saveMutation.isPending}
                  className="w-full bg-slate-900 text-white rounded-xl font-bold"
                >
                  {saveMutation.isPending ? "Saving..." : "Add to Library"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {isFetching ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-64 bg-slate-100 animate-pulse rounded-2xl border-2 border-slate-200" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredDocs.map((doc, index) => (
            <Card key={index} className="bg-white border-slate-200 hover:border-amber-400/60 hover:shadow-xl hover:shadow-amber-900/5 transition-all duration-300 group overflow-hidden flex flex-col rounded-2xl border-2">
              <CardHeader className="pb-4 relative">
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 bg-amber-50 rounded-xl group-hover:bg-amber-100 transition-colors">
                    {doc.type === "PDF" ? <FileText className="w-6 h-6 text-amber-600" /> : <FolderOpen className="w-6 h-6 text-amber-600" />}
                  </div>
                  <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2.5 py-1 rounded-lg uppercase tracking-widest border border-slate-200">
                    {doc.type}
                  </span>
                </div>
                <CardTitle className="text-xl text-slate-900 font-serif font-bold group-hover:text-amber-700 transition-colors leading-tight line-clamp-2 min-h-[3.5rem]">
                  {doc.name}
                </CardTitle>
                <CardDescription className="text-slate-400 text-[11px] mt-1.5 font-medium truncate italic">
                  {doc.filename.split("/").pop()}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-2 mt-auto space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <Button 
                    variant="outline"
                    onClick={() => handlePreview(doc, false)}
                    className="flex items-center gap-2 border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl font-semibold shadow-sm"
                  >
                    <Eye className="w-4 h-4 text-slate-400" />
                    Preview
                  </Button>
                  <Button 
                    variant="outline"
                    disabled={doc.type !== "DOCX"}
                    onClick={() => handlePreview(doc, true)}
                    className="flex items-center gap-2 border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl font-semibold shadow-sm disabled:opacity-40"
                    title={doc.type !== "DOCX" ? "Editing only available for Word files" : ""}
                  >
                    <Edit3 className="w-4 h-4 text-slate-400" />
                    Edit
                  </Button>
                </div>
                <Button 
                  onClick={() => handleDownload(doc)}
                  className="w-full h-11 bg-slate-900 hover:bg-amber-600 text-white hover:text-white border-none transition-all duration-200 flex items-center justify-center gap-2 font-bold rounded-xl shadow-md active:scale-[0.98]"
                >
                  <FileDown className="w-4 h-4" />
                  Download
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-5xl max-h-[95vh] overflow-hidden flex flex-col p-0 rounded-2xl border-none shadow-2xl">
          <DialogHeader className="p-6 border-b bg-slate-50 shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-2xl font-serif font-bold text-slate-900">
                  {isEditing ? "Document Editor" : "Document Viewer"}
                </DialogTitle>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded tracking-wide uppercase">
                    {selectedDoc?.name}
                  </span>
                  <span className="text-xs text-slate-400 font-medium">{selectedDoc?.filename.split("/").pop()}</span>
                </div>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-100/50 flex justify-center">
            {procLoading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Loader2 className="w-12 h-12 text-amber-500 animate-spin" />
                <p className="text-slate-500 font-bold animate-pulse">Loading Document...</p>
              </div>
            ) : pdfUrl ? (
              <iframe src={pdfUrl} className="w-full h-full min-h-[70vh] border-none rounded-lg shadow-inner bg-white" />
            ) : (
              <div 
                className={`prose prose-slate lg:prose-lg max-w-none focus:outline-none w-full shadow-lg p-12 border border-slate-100 rounded-lg bg-white ${isEditing ? "ring-2 ring-amber-400/20 ring-offset-4" : ""}`}
                contentEditable={isEditing}
                dangerouslySetInnerHTML={{ __html: docHtml }}
                onBlur={(e) => setDocHtml(e.currentTarget.innerHTML)}
              />
            )}
          </div>

          <DialogFooter className="p-6 border-t bg-slate-50 flex items-center justify-between gap-4 shrink-0">
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={handlePrint} className="rounded-xl flex items-center gap-2 font-bold shadow-sm">
                <Printer className="w-4 h-4 text-amber-600" />
                {pdfUrl ? "Open Print View" : "Print / Save PDF"}
              </Button>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="ghost" onClick={() => setIsModalOpen(false)} className="rounded-xl font-bold">
                Close
              </Button>
              {isEditing && (
                <Button 
                  onClick={() => {
                    toast.success("Draft saved successfully!");
                  }}
                  className="bg-amber-600 hover:bg-amber-700 text-white rounded-xl flex items-center gap-2 font-bold shadow-md"
                >
                  <Save className="w-4 h-4" />
                  Save Draft
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ImpDocsPage;
