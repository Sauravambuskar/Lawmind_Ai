import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAIConfig } from "@/hooks/useAIConfig";
import { sendAIMessage, PROVIDER_INFO } from "@/lib/ai-providers";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  FileText, Download, Printer, Save, Sparkles, RefreshCw, Trash2, 
  Plus, Check, ChevronRight, FileSignature, ArrowLeftRight, UserCheck, Scale
} from "lucide-react";
import { toast } from "sonner";
import { jsPDF } from "jspdf";

interface NoticeDraft {
  id: string;
  name: string;
  refNo: string;
  date: string;
  deliveryMode: string;
  clientName: string;
  clientAddress: string;
  clientMobile: string;
  recipientName: string;
  recipientAddress: string;
  recipientMobile: string;
  subject: string;
  paragraphs: string[];
  interestRate: string;
  outstandingAmount: string;
  noticeCharges: string;
  noticePeriod: string;
  advocateName: string;
  advocateFirm: string;
  disclaimer: string;
  caseId?: string;
  lastUpdated: string;
}

const DEMO_NOTICE: Omit<NoticeDraft, "id" | "name" | "lastUpdated"> = {
  refNo: "FORTUNATE- 04/ 2025",
  date: "2025-10-07",
  deliveryMode: "NOTICE BY R .P .A .D.",
  clientName: "FORTUNATE AGRO SOLUTION PVT. LTD",
  clientAddress: "C/o, Suraj Warehouse Sr No.155-B, Behind Kad Hights, Main Road Phursungi, Taluka Haveli, Dist –Pune-412308",
  clientMobile: "9130074025, 9822333747",
  recipientName: "Ashirwad Agro Agency, Through its Prop.",
  recipientAddress: "Serve No.5, Plot No-1, Sharda Colony, At Post.- Maloni, Tal –Shahada, Dist.-Nandurbar - 425409",
  recipientMobile: "9763940520",
  subject: "LEGAL NOTICE FOR RECOVERY OF OUTSTANDING DUES OF RS. 90,201/- WITH INTEREST",
  paragraphs: [
    "My client is Registered Company under the companies act and having its corporate Office at above mention address. My client is engage in business of manufacturing and marketing Pesticides and Insecticides.",
    "That you requested to my client for appointment for dealer. As per your submission and request after completing all the formalities my client appointed you as a dealer of my client. Thereafter my client supplied you a goods i.e. agricultural products on credit basis. On that time you assured and promised that you will make all the payments within due period.",
    "My client maintains regular books of account. As per account of my client is found that an amount of Rs.90,201/- is due against you from so long time. My client employee repeatedly called you to make payment which is due against you, but you never paid any heed nor make any single pie to my client.",
    "Hence by this notice you are hereby called upon to make outstanding payment of Rs.90,201/- along with 24 % P.A which is due against you within 7 day after receipt of this notice. If you failed to do this my client take strict civil as well as criminal action against you which is your own risks and cost which is please note. Remit notice charges of Rs.5,000/- is also recover from you."
  ],
  interestRate: "24 % P.A",
  outstandingAmount: "90,201/-",
  noticeCharges: "5,000/-",
  noticePeriod: "7 days",
  advocateName: "MANMOHAN D. SARDA",
  advocateFirm: "Advocate & Associates",
  disclaimer: "This Notice is being addressed to you without prejudice to all or any other rights and contentions of our client. Please be further noted that a copy of this notice has been retained in our office for further necessary action.",
  caseId: "",
};

export default function NoticeMakerPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { config, hasActiveKey, getActiveConfig } = useAIConfig();

  // Draft details state
  const [formData, setFormData] = useState<NoticeDraft>({
    id: "temp-draft",
    name: "New Notice Draft",
    ...DEMO_NOTICE,
    lastUpdated: new Date().toISOString()
  });

  // Local drafts list
  const [draftsList, setDraftsList] = useState<NoticeDraft[]>([]);
  const [activeTab, setActiveTab] = useState<string>("editor");
  const [caseLink, setCaseLink] = useState<string>("");

  // AI assistant state
  const [aiPrompt, setAiPrompt] = useState<string>("");
  const [aiResponseText, setAiResponseText] = useState<string>("");
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [aiInstructionType, setAiInstructionType] = useState<string>("draft");

  // Fetch cases to link notices
  const { data: cases = [] } = useQuery({
    queryKey: ["cases"],
    queryFn: async () => {
      const { data, error } = await supabase.from("cases").select("id, title, case_number");
      if (error) throw error;
      return data || [];
    },
  });

  // Load drafts from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("lawmind-notice-drafts");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setDraftsList(parsed);
      } catch (e) {
        console.error("Failed to parse drafts", e);
      }
    }
  }, []);

  // Save drafts to localStorage helper
  const saveDraftsList = (list: NoticeDraft[]) => {
    localStorage.setItem("lawmind-notice-drafts", JSON.stringify(list));
    setDraftsList(list);
  };

  // Add new blank notice
  const handleCreateNew = () => {
    const newNotice: NoticeDraft = {
      id: crypto.randomUUID(),
      name: `Notice Draft - ${new Date().toLocaleDateString()}`,
      refNo: `Ref.No.LM-${Math.floor(100 + Math.random() * 900)}/${new Date().getFullYear()}`,
      date: new Date().toISOString().split("T")[0],
      deliveryMode: "NOTICE BY SPEED POST / R.P.A.D.",
      clientName: "",
      clientAddress: "",
      clientMobile: "",
      recipientName: "",
      recipientAddress: "",
      recipientMobile: "",
      subject: "LEGAL NOTICE",
      paragraphs: ["", "", ""],
      interestRate: "18% P.A.",
      outstandingAmount: "0.00",
      noticeCharges: "5,000/-",
      noticePeriod: "15 days",
      advocateName: "MANMOHAN D. SARDA",
      advocateFirm: "Advocate & Associates",
      disclaimer: "This Notice is being addressed to you without prejudice to all or any other rights and contentions of our client. Please be further noted that a copy of this notice has been retained in our office for further necessary action.",
      caseId: "",
      lastUpdated: new Date().toISOString()
    };
    const newList = [newNotice, ...draftsList];
    saveDraftsList(newList);
    setFormData(newNotice);
    toast.success("Created new draft");
  };

  // Load the Demo notice provided by the user
  const handleLoadDemo = () => {
    const demo: NoticeDraft = {
      id: crypto.randomUUID(),
      name: "Fortunate Agro Solution Notice (Demo)",
      ...DEMO_NOTICE,
      lastUpdated: new Date().toISOString()
    };
    const newList = [demo, ...draftsList];
    saveDraftsList(newList);
    setFormData(demo);
    toast.success("Loaded Demo notice data");
  };

  // Update field handler
  const handleFieldChange = (field: keyof NoticeDraft, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
      lastUpdated: new Date().toISOString()
    }));
  };

  // Update paragraph handler
  const handleParagraphChange = (index: number, val: string) => {
    const updated = [...formData.paragraphs];
    updated[index] = val;
    handleFieldChange("paragraphs", updated);
  };

  // Add paragraph row
  const addParagraph = () => {
    handleFieldChange("paragraphs", [...formData.paragraphs, ""]);
  };

  // Delete paragraph row
  const removeParagraph = (index: number) => {
    if (formData.paragraphs.length <= 1) {
      toast.error("At least one paragraph is required");
      return;
    }
    const updated = formData.paragraphs.filter((_, i) => i !== index);
    handleFieldChange("paragraphs", updated);
  };

  // Save current form data as a draft
  const handleSaveDraft = () => {
    if (formData.id === "temp-draft") {
      const newId = crypto.randomUUID();
      const newDraft = { ...formData, id: newId, lastUpdated: new Date().toISOString() };
      const newList = [newDraft, ...draftsList];
      saveDraftsList(newList);
      setFormData(newDraft);
      toast.success("Saved draft successfully");
    } else {
      const newList = draftsList.map(d => d.id === formData.id ? { ...formData, lastUpdated: new Date().toISOString() } : d);
      saveDraftsList(newList);
      toast.success("Draft updated successfully");
    }
  };

  // Delete draft
  const handleDeleteDraft = (id: string) => {
    const newList = draftsList.filter(d => d.id !== id);
    saveDraftsList(newList);
    if (formData.id === id) {
      setFormData({
        id: "temp-draft",
        name: "New Notice Draft",
        ...DEMO_NOTICE,
        lastUpdated: new Date().toISOString()
      });
    }
    toast.success("Draft deleted");
  };

  // Select a draft to edit
  const handleSelectDraft = (draft: NoticeDraft) => {
    setFormData(draft);
    if (draft.caseId) {
      setCaseLink(draft.caseId);
    } else {
      setCaseLink("");
    }
    toast.info(`Loaded draft: ${draft.name}`);
  };

  // Call AI to draft or polish notice
  const handleAICall = async () => {
    if (!aiPrompt.trim()) {
      toast.error("Please enter facts or a prompt for the AI");
      return;
    }
    if (!hasActiveKey) {
      toast.error("AI is not configured. Please add an API key in AI Settings first.");
      return;
    }

    setAiLoading(true);
    try {
      const activeProvider = config.activeProvider;
      const model = config.providers[activeProvider].model;

      let promptText = "";
      if (aiInstructionType === "draft") {
        promptText = `You are a professional legal draft generator assistant. Based on these facts, write a structured JSON for a formal legal notice.
Facts: ${aiPrompt}

Return ONLY a valid JSON object matching the schema below. Do not include any explanation, conversational text, markdown wrapping blocks (like \`\`\`json), or trailing text outside the JSON.

JSON Schema:
{
  "refNo": "Draft reference number",
  "date": "YYYY-MM-DD",
  "deliveryMode": "e.g., NOTICE BY R.P.A.D. or BY SPEED POST",
  "clientName": "Full client legal name",
  "clientAddress": "Complete client address",
  "clientMobile": "Client mobile / contact details",
  "recipientName": "Full recipient name / proprietor details",
  "recipientAddress": "Complete recipient address",
  "recipientMobile": "Recipient mobile number",
  "subject": "Clear legal subject line in all caps",
  "paragraphs": [
    "Paragraph 1 introducing the client and their business / relation",
    "Paragraph 2 explaining the request, deal, contract, or supplied items",
    "Paragraph 3 outlining the default, accounting, books, and outstanding balance",
    "Paragraph 4 demanding payment with the timeline and warning of legal actions"
  ],
  "interestRate": "Interest rate, e.g., 24% P.A.",
  "outstandingAmount": "Dues amount in numbers, e.g., 90,201/-",
  "noticeCharges": "Notice drafting charges, e.g., 5,000/-",
  "noticePeriod": "Timeline in days, e.g., 7 days or 15 days",
  "advocateName": "MANMOHAN D. SARDA",
  "advocateFirm": "Advocate & Associates"
}`;
      } else {
        // Polish current notice
        promptText = `You are an expert lawyer. Review and polish this legal notice. Make it sound highly formal, authoritative, and legally warning.
Current Notice Data:
Ref No: ${formData.refNo}
Subject: ${formData.subject}
Client: ${formData.clientName} (${formData.clientAddress})
Recipient: ${formData.recipientName} (${formData.recipientAddress})
Current Paragraphs:
${formData.paragraphs.map((p, i) => `Paragraph ${i + 1}: ${p}`).join("\n")}

Respond ONLY with a valid JSON containing updated "subject" and "paragraphs" array. Do not include comments, explanations, or markdown code block markers.

Response Format:
{
  "subject": "Polished legal subject line in all caps",
  "paragraphs": [
    "Polished paragraph 1",
    "Polished paragraph 2",
    "Polished paragraph 3",
    "Polished paragraph 4"
  ]
}`;
      }

      const messages = [
        { role: "system" as const, content: "You are a professional legal draft designer who outputs strictly valid JSON documents according to requested schemas." },
        { role: "user" as const, content: promptText }
      ];

      const response = await sendAIMessage(getActiveConfig(), messages);
      let content = response.content.trim();
      
      // Attempt to clean JSON formatting from markdown code block markers if returned
      if (content.startsWith("```")) {
        content = content.replace(/^```(json)?/, "").replace(/```$/, "").trim();
      }

      try {
        const parsed = JSON.parse(content);
        if (aiInstructionType === "draft") {
          const loadedDraft: NoticeDraft = {
            id: formData.id,
            name: formData.name,
            refNo: parsed.refNo || formData.refNo,
            date: parsed.date || formData.date,
            deliveryMode: parsed.deliveryMode || formData.deliveryMode,
            clientName: parsed.clientName || formData.clientName,
            clientAddress: parsed.clientAddress || formData.clientAddress,
            clientMobile: parsed.clientMobile || formData.clientMobile,
            recipientName: parsed.recipientName || formData.recipientName,
            recipientAddress: parsed.recipientAddress || formData.recipientAddress,
            recipientMobile: parsed.recipientMobile || formData.recipientMobile,
            subject: parsed.subject || formData.subject,
            paragraphs: parsed.paragraphs && parsed.paragraphs.length > 0 ? parsed.paragraphs : formData.paragraphs,
            interestRate: parsed.interestRate || formData.interestRate,
            outstandingAmount: parsed.outstandingAmount || formData.outstandingAmount,
            noticeCharges: parsed.noticeCharges || formData.noticeCharges,
            noticePeriod: parsed.noticePeriod || formData.noticePeriod,
            advocateName: parsed.advocateName || formData.advocateName,
            advocateFirm: parsed.advocateFirm || formData.advocateFirm,
            disclaimer: formData.disclaimer,
            caseId: formData.caseId,
            lastUpdated: new Date().toISOString()
          };
          setFormData(loadedDraft);
          toast.success("AI Notice generated and loaded into form fields!");
        } else {
          setFormData(prev => ({
            ...prev,
            subject: parsed.subject || prev.subject,
            paragraphs: parsed.paragraphs || prev.paragraphs,
            lastUpdated: new Date().toISOString()
          }));
          toast.success("Notice polished by AI successfully!");
        }
        setAiPrompt("");
      } catch (err) {
        console.error("AI JSON parse error. Raw content:", content);
        setAiResponseText(response.content);
        toast.warning("AI response wasn't in perfect JSON format. Showing raw text in output.");
      }
    } catch (e: any) {
      toast.error(`AI Generation Failed: ${e.message}`);
    } finally {
      setAiLoading(false);
    }
  };

  // Inject raw AI response if it wasn't parsed
  const handleApplyRawAI = () => {
    if (!aiResponseText) return;
    // Set first paragraph to raw text as fallback
    const updated = [aiResponseText];
    setFormData(prev => ({
      ...prev,
      paragraphs: updated
    }));
    toast.success("Applied AI output to notice body");
    setAiResponseText("");
  };

  // Save to supabase document center
  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        title: `Notice: ${formData.clientName} vs ${formData.recipientName.split(",")[0]}`,
        description: `Ref: ${formData.refNo}. Outstanding: Rs. ${formData.outstandingAmount} @ ${formData.interestRate}. Notice Fee: Rs. ${formData.noticeCharges}. Period: ${formData.noticePeriod}. Info: ${formData.subject.slice(0, 100)}...`,
        document_type: "Notice",
        case_id: caseLink || null,
        file_url: null
      };

      const { error } = await supabase.from("documents").insert({
        ...payload,
        user_id: user!.id
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      toast.success("Legal Notice successfully logged to Document Center!");
    },
    onError: (e: Error) => toast.error(`Database Error: ${e.message}`)
  });

  // Browser Print handler
  const handlePrint = () => {
    window.print();
  };

  // PDF Export handler
  const handleExportPDF = () => {
    try {
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      // Styling parameters
      doc.setFont("Times", "normal");
      
      let y = 20;
      const margin = 20;
      const width = 210 - (margin * 2);

      // Letterhead/Header Adv details
      doc.setFontSize(16);
      doc.setFont("Times", "bold");
      doc.text(formData.advocateName.toUpperCase(), 105, y, { align: "center" });
      y += 6;
      doc.setFontSize(11);
      doc.setFont("Times", "italic");
      doc.text(formData.advocateFirm, 105, y, { align: "center" });
      
      y += 4;
      doc.setDrawColor(180, 180, 180);
      doc.setLineWidth(0.5);
      doc.line(margin, y, 210 - margin, y);
      y += 10;

      // Ref and Date Row
      doc.setFontSize(10);
      doc.setFont("Times", "bold");
      doc.text(`Ref.No.${formData.refNo}`, margin, y);
      
      const formattedDate = new Date(formData.date).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
      });
      doc.text(`Date: ${formattedDate}`, 210 - margin, y, { align: "right" });
      y += 8;

      // Delivery Method
      doc.setFontSize(11);
      doc.text(formData.deliveryMode.toUpperCase(), 105, y, { align: "center" });
      y += 8;

      // Client info
      doc.setFont("Times", "bold");
      doc.text("FOR AND ON BEHALF OF MY CLIENT:", margin, y);
      y += 5;
      doc.setFont("Times", "normal");
      doc.setFontSize(10.5);
      
      const clientDetails = `${formData.clientName}\nAddress: ${formData.clientAddress}\nMob: ${formData.clientMobile}`;
      const clientLines = doc.splitTextToSize(clientDetails, width);
      doc.text(clientLines, margin, y);
      y += (clientLines.length * 5) + 5;

      // Recipient info
      doc.setFont("Times", "bold");
      doc.text("To,", margin, y);
      y += 5;
      doc.setFont("Times", "normal");
      
      const recipientDetails = `${formData.recipientName}\nAddress: ${formData.recipientAddress}\nMob: ${formData.recipientMobile}`;
      const recLines = doc.splitTextToSize(recipientDetails, width);
      doc.text(recLines, margin, y);
      y += (recLines.length * 5) + 6;

      // Salutation
      doc.setFont("Times", "bold");
      doc.text("Dear Sir,", margin, y);
      y += 6;
      doc.setFont("Times", "normal");
      
      const introText = "As per instruction and authority given by my above named client, I serve you following notice as under:";
      doc.text(introText, margin, y);
      y += 8;

      // Subject
      doc.setFont("Times", "bold");
      const subjLines = doc.splitTextToSize(`Subject: ${formData.subject}`, width);
      doc.text(subjLines, margin, y);
      y += (subjLines.length * 5) + 6;

      // Paragraphs
      doc.setFont("Times", "normal");
      formData.paragraphs.forEach((p, idx) => {
        const fullPara = `${idx + 1}]  ${p}`;
        const paraLines = doc.splitTextToSize(fullPara, width);

        // Check page overflow
        if (y + (paraLines.length * 5) > 275) {
          doc.addPage();
          y = 25;
        }

        doc.text(paraLines, margin, y);
        y += (paraLines.length * 5) + 6;
      });

      // Thanking and regards
      if (y > 250) {
        doc.addPage();
        y = 25;
      }
      y += 4;
      doc.text("Thanking you,", margin, y);
      y += 10;
      doc.text("Regards,", 210 - margin - 50, y);
      y += 12;
      doc.setFont("Times", "bold");
      doc.text(formData.advocateName, 210 - margin - 50, y);
      doc.setFont("Times", "italic");
      doc.setFontSize(9.5);
      doc.text(`(${formData.advocateFirm})`, 210 - margin - 50, y + 4.5);

      // Disclaimer Note at bottom
      y += 20;
      if (y > 265) {
        doc.addPage();
        y = 25;
      }
      doc.setFont("Times", "bold");
      doc.setFontSize(9);
      doc.text("Note:-", margin, y);
      doc.setFont("Times", "normal");
      const noteLines = doc.splitTextToSize(formData.disclaimer, width - 10);
      doc.text(noteLines, margin + 10, y);

      doc.save(`legal_notice_${formData.clientName.replace(/\s+/g, "_").slice(0, 15)}.pdf`);
      toast.success("PDF notice downloaded successfully");
    } catch (error) {
      console.error(error);
      toast.error("Failed to generate PDF download");
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10 print:p-0 print:space-y-0">
      
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:hidden">
        <PageHeader 
          title="Legal Notice Maker" 
          breadcrumbs={[{ label: "Dashboard", path: "/" }, { label: "Notice Maker" }]} 
        />
        
        {/* Quick Toolbar */}
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <Button variant="outline" onClick={handleLoadDemo} className="bg-background text-xs font-semibold">
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Load Demo
          </Button>
          <Button variant="outline" onClick={handleCreateNew} className="bg-background text-xs font-semibold">
            <Plus className="w-3.5 h-3.5 mr-1.5" /> New Draft
          </Button>
          <Button onClick={handleSaveDraft} variant="outline" className="bg-background text-xs font-semibold text-primary">
            <Save className="w-3.5 h-3.5 mr-1.5" /> Save Draft
          </Button>
          <Button onClick={handleExportPDF} className="bg-primary text-primary-foreground text-xs font-semibold shadow-sm hover:shadow-md transition-all">
            <Download className="w-3.5 h-3.5 mr-1.5" /> PDF
          </Button>
          <Button onClick={handlePrint} className="bg-[#1a233a] hover:bg-[#1a233a]/90 text-white text-xs font-semibold shadow-sm">
            <Printer className="w-3.5 h-3.5 mr-1.5" /> Print Notice
          </Button>
        </div>
      </div>

      {/* ── Main Layout ── */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start print:block print:w-full">
        
        {/* LEFT COLUMN: Drafts list & Editor Form */}
        <div className="xl:col-span-7 space-y-6 print:hidden">
          
          {/* Drafts Manager Card */}
          {draftsList.length > 0 && (
            <Card className="border border-border/80 shadow-sm bg-card/60 backdrop-blur-sm">
              <CardHeader className="py-3 px-4 flex flex-row items-center justify-between border-b border-border/50">
                <div>
                  <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Notice Drafts</CardTitle>
                </div>
                <span className="text-[10px] bg-primary/10 text-primary font-bold px-2 py-0.5 rounded">
                  {draftsList.length} Saved DDLs
                </span>
              </CardHeader>
              <CardContent className="p-2 max-h-40 overflow-y-auto custom-scrollbar flex flex-row flex-wrap gap-2">
                {draftsList.map(draft => (
                  <div 
                    key={draft.id} 
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer transition-all duration-150 ${
                      formData.id === draft.id 
                        ? "bg-primary/10 border-primary text-primary font-semibold shadow-sm" 
                        : "bg-muted/30 border-border hover:bg-muted/70 text-foreground"
                    }`}
                    onClick={() => handleSelectDraft(draft)}
                  >
                    <FileSignature className="w-3.5 h-3.5 opacity-70" />
                    <span className="max-w-[150px] truncate">{draft.name}</span>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteDraft(draft.id);
                      }}
                      className="ml-1 p-0.5 hover:text-rose-500 rounded transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Form Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            
            <div className="flex items-center justify-between mb-3 bg-muted/30 p-1 rounded-xl border border-border/60">
              <TabsList className="bg-transparent border-0 gap-1">
                <TabsTrigger value="editor" className="data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg text-xs font-bold py-1.5">
                  Form Fields
                </TabsTrigger>
                <TabsTrigger value="ai" className="data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg text-xs font-bold py-1.5 text-violet-600 dark:text-violet-400">
                  <Sparkles className="w-3.5 h-3.5 mr-1" /> AI Assistant
                </TabsTrigger>
              </TabsList>
              
              <div className="text-[11px] text-muted-foreground pr-2 hidden sm:block">
                Last auto-saved draft: <span className="font-semibold">{new Date(formData.lastUpdated).toLocaleTimeString()}</span>
              </div>
            </div>

            {/* TAB: Form Editor */}
            <TabsContent value="editor" className="space-y-6 mt-0">
              
              {/* Card 1: Reference, Dates, and Linkages */}
              <Card className="border border-border/80 shadow-sm">
                <CardHeader className="py-4 border-b border-border/50 bg-muted/5">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Scale className="w-4 h-4 text-primary" />
                    1. Basic Notice Settings
                  </CardTitle>
                  <CardDescription className="text-xs">Setup case linkages, dates, and mailing methods.</CardDescription>
                </CardHeader>
                <CardContent className="p-5 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="draftName" className="text-xs font-semibold text-muted-foreground">Draft File Label</Label>
                      <Input 
                        id="draftName" 
                        value={formData.name} 
                        onChange={(e) => handleFieldChange("name", e.target.value)} 
                        placeholder="e.g. Fortunate Agro Dues Notice"
                        className="bg-muted/30"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="caseId" className="text-xs font-semibold text-muted-foreground">Link to Existing Case</Label>
                      <Select value={caseLink} onValueChange={(val) => { setCaseLink(val); handleFieldChange("caseId", val); }}>
                        <SelectTrigger className="bg-muted/30 text-xs">
                          <SelectValue placeholder="Select case files..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">-- Unlinked Notice --</SelectItem>
                          {cases.map(c => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.case_number} - {c.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="refNo" className="text-xs font-semibold text-muted-foreground">Ref No.</Label>
                      <Input 
                        id="refNo" 
                        value={formData.refNo} 
                        onChange={(e) => handleFieldChange("refNo", e.target.value)} 
                        placeholder="e.g. FORTUNATE- 04/ 2025"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="date" className="text-xs font-semibold text-muted-foreground">Notice Date</Label>
                      <Input 
                        id="date" 
                        type="date"
                        value={formData.date} 
                        onChange={(e) => handleFieldChange("date", e.target.value)} 
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="deliveryMode" className="text-xs font-semibold text-muted-foreground">Delivery Method</Label>
                      <Input 
                        id="deliveryMode" 
                        value={formData.deliveryMode} 
                        onChange={(e) => handleFieldChange("deliveryMode", e.target.value)} 
                        placeholder="e.g. NOTICE BY R.P.A.D. / SPEED POST"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Card 2: Clients and Recipients */}
              <Card className="border border-border/80 shadow-sm">
                <CardHeader className="py-4 border-b border-border/50 bg-muted/5">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-primary" />
                    2. Client & Recipient Info
                  </CardTitle>
                  <CardDescription className="text-xs">Identify the sender (your client) and recipient (the opponent).</CardDescription>
                </CardHeader>
                <CardContent className="p-5 space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Client side */}
                    <div className="space-y-3.5 border-r border-border/30 pr-0 md:pr-4">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-primary">Your Client (Sender)</h4>
                      <div className="space-y-1.5">
                        <Label htmlFor="clientName" className="text-xs font-semibold text-muted-foreground">Client Name</Label>
                        <Input 
                          id="clientName" 
                          value={formData.clientName} 
                          onChange={(e) => handleFieldChange("clientName", e.target.value)} 
                          placeholder="e.g. FORTUNATE AGRO SOLUTION PVT. LTD"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="clientAddress" className="text-xs font-semibold text-muted-foreground">Client Address</Label>
                        <Textarea 
                          id="clientAddress" 
                          value={formData.clientAddress} 
                          onChange={(e) => handleFieldChange("clientAddress", e.target.value)} 
                          placeholder="Complete official address of client"
                          rows={2}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="clientMobile" className="text-xs font-semibold text-muted-foreground">Client Contact Info</Label>
                        <Input 
                          id="clientMobile" 
                          value={formData.clientMobile} 
                          onChange={(e) => handleFieldChange("clientMobile", e.target.value)} 
                          placeholder="e.g. Mob- 9130074025, 9822333747"
                        />
                      </div>
                    </div>

                    {/* Recipient side */}
                    <div className="space-y-3.5">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-rose-500">Recipient (To)</h4>
                      <div className="space-y-1.5">
                        <Label htmlFor="recipientName" className="text-xs font-semibold text-muted-foreground">Opposite Party Name</Label>
                        <Input 
                          id="recipientName" 
                          value={formData.recipientName} 
                          onChange={(e) => handleFieldChange("recipientName", e.target.value)} 
                          placeholder="e.g. Ashirwad Agro Agency, Prop."
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="recipientAddress" className="text-xs font-semibold text-muted-foreground">Opposite Party Address</Label>
                        <Textarea 
                          id="recipientAddress" 
                          value={formData.recipientAddress} 
                          onChange={(e) => handleFieldChange("recipientAddress", e.target.value)} 
                          placeholder="Complete address of opponent"
                          rows={2}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="recipientMobile" className="text-xs font-semibold text-muted-foreground">Opposite Party Contact Info</Label>
                        <Input 
                          id="recipientMobile" 
                          value={formData.recipientMobile} 
                          onChange={(e) => handleFieldChange("recipientMobile", e.target.value)} 
                          placeholder="e.g. Mob:- 9763940520"
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Card 3: Financial Details & Subject */}
              <Card className="border border-border/80 shadow-sm">
                <CardHeader className="py-4 border-b border-border/50 bg-muted/5">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <ArrowLeftRight className="w-4 h-4 text-primary" />
                    3. Claim Details & Subject Line
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-5 space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="subject" className="text-xs font-semibold text-muted-foreground">Legal Subject Line (ALL CAPS)</Label>
                    <Input 
                      id="subject" 
                      value={formData.subject} 
                      onChange={(e) => handleFieldChange("subject", e.target.value)} 
                      placeholder="e.g. LEGAL NOTICE FOR RECOVERY OF OUTSTANDING DUES OF RS. 90,201/-"
                    />
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="outstandingAmount" className="text-xs font-semibold text-muted-foreground">Dues Amount</Label>
                      <Input 
                        id="outstandingAmount" 
                        value={formData.outstandingAmount} 
                        onChange={(e) => handleFieldChange("outstandingAmount", e.target.value)} 
                        placeholder="e.g. 90,201/-"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="interestRate" className="text-xs font-semibold text-muted-foreground">Interest Rate</Label>
                      <Input 
                        id="interestRate" 
                        value={formData.interestRate} 
                        onChange={(e) => handleFieldChange("interestRate", e.target.value)} 
                        placeholder="e.g. 24 % P.A."
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="noticeCharges" className="text-xs font-semibold text-muted-foreground">Notice Charges</Label>
                      <Input 
                        id="noticeCharges" 
                        value={formData.noticeCharges} 
                        onChange={(e) => handleFieldChange("noticeCharges", e.target.value)} 
                        placeholder="e.g. 5,000/-"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="noticePeriod" className="text-xs font-semibold text-muted-foreground">Notice Period</Label>
                      <Input 
                        id="noticePeriod" 
                        value={formData.noticePeriod} 
                        onChange={(e) => handleFieldChange("noticePeriod", e.target.value)} 
                        placeholder="e.g. 7 days"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Card 4: Notice Body Paragraphs */}
              <Card className="border border-border/80 shadow-sm">
                <CardHeader className="py-4 border-b border-border/50 bg-muted/5 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <FileText className="w-4 h-4 text-primary" />
                      4. Notice Statement Paragraphs
                    </CardTitle>
                    <CardDescription className="text-xs">Edit the factual allegations of the dispute.</CardDescription>
                  </div>
                  <Button size="sm" variant="outline" onClick={addParagraph} className="h-8">
                    <Plus className="w-3.5 h-3.5 mr-1" /> Add Point
                  </Button>
                </CardHeader>
                <CardContent className="p-5 space-y-4">
                  {formData.paragraphs.map((p, idx) => (
                    <div key={idx} className="space-y-1.5 p-3 rounded-lg border border-border/60 bg-muted/10">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-primary">Point #{idx + 1}</span>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => removeParagraph(idx)} 
                          className="h-6 w-6 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                      <Textarea 
                        value={p} 
                        onChange={(e) => handleParagraphChange(idx, e.target.value)}
                        placeholder={`Factual details for point ${idx + 1}`}
                        rows={3}
                        className="bg-background text-xs leading-relaxed"
                      />
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Card 5: Signature & Signoff */}
              <Card className="border border-border/80 shadow-sm">
                <CardHeader className="py-4 border-b border-border/50 bg-muted/5">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <FileSignature className="w-4 h-4 text-primary" />
                    5. Signature & Signoff
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-5 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="advocateName" className="text-xs font-semibold text-muted-foreground">Signatory Advocate Name</Label>
                      <Input 
                        id="advocateName" 
                        value={formData.advocateName} 
                        onChange={(e) => handleFieldChange("advocateName", e.target.value)} 
                        placeholder="e.g. MANMOHAN D. SARDA"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="advocateFirm" className="text-xs font-semibold text-muted-foreground">Advocate Designation / Firm</Label>
                      <Input 
                        id="advocateFirm" 
                        value={formData.advocateFirm} 
                        onChange={(e) => handleFieldChange("advocateFirm", e.target.value)} 
                        placeholder="e.g. (Advocate & Associates)"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="disclaimer" className="text-xs font-semibold text-muted-foreground">Without Prejudice Legal Footnote Note</Label>
                    <Textarea 
                      id="disclaimer" 
                      value={formData.disclaimer} 
                      onChange={(e) => handleFieldChange("disclaimer", e.target.value)} 
                      placeholder="Add standard disclaimer footer..."
                      rows={2.5}
                      className="text-xs"
                    />
                  </div>

                  <div className="pt-2 flex justify-between items-center border-t border-border/40">
                    <Button 
                      variant="outline"
                      onClick={() => saveMutation.mutate()} 
                      disabled={saveMutation.isPending}
                      className="text-xs font-bold text-[#1a233a]"
                    >
                      <Save className="w-3.5 h-3.5 mr-1.5" /> Save to System Documents
                    </Button>
                    
                    <span className="text-[10px] text-muted-foreground">
                      Linked to: {formData.caseId ? "Case File" : "No Case linked"}
                    </span>
                  </div>
                </CardContent>
              </Card>

            </TabsContent>

            {/* TAB: AI Assistant */}
            <TabsContent value="ai" className="space-y-6 mt-0">
              <Card className="border-2 border-violet-500/20 shadow-lg">
                <CardHeader className="py-4 border-b border-border/50 bg-violet-500/5">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-bold flex items-center gap-2 text-violet-700 dark:text-violet-400">
                      <Sparkles className="w-4 h-4" /> AI Drafting Notice Assistant
                    </CardTitle>
                    <span className="text-[10px] bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-400 font-bold px-2 py-0.5 rounded border border-violet-500/20">
                      Smart generator
                    </span>
                  </div>
                  <CardDescription className="text-xs">Create legal drafts or polish terms using the system's configured AI.</CardDescription>
                </CardHeader>
                <CardContent className="p-5 space-y-4">
                  
                  {/* Select task type */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground">Select AI Operation</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setAiInstructionType("draft")}
                        className={`py-2 rounded-lg text-xs font-bold border transition-all ${
                          aiInstructionType === "draft"
                            ? "bg-violet-600 text-white border-violet-600 shadow-sm"
                            : "bg-muted/40 text-muted-foreground border-border hover:bg-muted/80"
                        }`}
                      >
                        Draft Notice From Facts
                      </button>
                      <button
                        type="button"
                        onClick={() => setAiInstructionType("polish")}
                        className={`py-2 rounded-lg text-xs font-bold border transition-all ${
                          aiInstructionType === "polish"
                            ? "bg-violet-600 text-white border-violet-600 shadow-sm"
                            : "bg-muted/40 text-muted-foreground border-border hover:bg-muted/80"
                        }`}
                      >
                        Polish Current Notice DDL
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="aiPrompt" className="text-xs font-semibold text-muted-foreground">
                      {aiInstructionType === "draft" 
                        ? "Notice Facts & Situation Details" 
                        : "Focus or Adjustments requested"}
                    </Label>
                    <Textarea
                      id="aiPrompt"
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      placeholder={
                        aiInstructionType === "draft" 
                          ? "Explain the dispute. E.g., 'Landlord seeking eviction and Rs. 40,000 back rent from commercial shop tenant. Dues unpaid for 3 months. Give 15 days notice. Advocate Sarda representing client. 18% interest rate.'" 
                          : "E.g., 'Make paragraph 3 sound more threatening with criminal actions under IPC' or 'Make it formal.'"
                      }
                      rows={5}
                      className="text-xs bg-muted/10 border-violet-200/50 dark:border-violet-500/20"
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button 
                      onClick={handleAICall} 
                      disabled={aiLoading} 
                      className="flex-1 bg-violet-600 hover:bg-violet-700 text-white font-semibold text-xs shadow-md shadow-violet-500/10"
                    >
                      {aiLoading ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 mr-2 animate-spin" /> Drafting notice, please wait…
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5 mr-2" /> Generate Notice Draft
                        </>
                      )}
                    </Button>
                  </div>

                  {aiResponseText && (
                    <div className="mt-4 p-3 rounded-lg border border-yellow-500/30 bg-yellow-500/5 space-y-2.5 animate-in fade-in duration-200">
                      <div className="flex justify-between items-center">
                        <span className="text-[11px] font-bold text-yellow-600">AI Response Output (Fallback)</span>
                        <Button size="sm" variant="outline" onClick={handleApplyRawAI} className="h-7 text-xs">
                          <Check className="w-3.5 h-3.5 mr-1" /> Use AI Output
                        </Button>
                      </div>
                      <pre className="text-[10px] max-h-40 overflow-y-auto whitespace-pre-wrap leading-relaxed font-mono text-foreground/80">
                        {aiResponseText}
                      </pre>
                    </div>
                  )}

                  {/* Provider Info Banner */}
                  {config && (
                    <div className="pt-3 border-t border-border/40 flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>Active AI Model:</span>
                      <span className="font-semibold text-violet-600 dark:text-violet-400 uppercase">
                        {PROVIDER_INFO[config.activeProvider]?.label || "System"} ({config.providers[config.activeProvider]?.model || "default"})
                      </span>
                    </div>
                  )}

                </CardContent>
              </Card>
            </TabsContent>

          </Tabs>

        </div>

        {/* RIGHT COLUMN: LIVE FORM PREVIEW (PAPER LETTERHEAD VIEW) */}
        <div className="xl:col-span-5 print:p-0 print:m-0 print:border-none print:shadow-none print:col-span-12">
          
          <Card className="border border-border/90 shadow-lg relative bg-white dark:bg-slate-900 overflow-hidden select-text print:shadow-none print:border-none print:rounded-none">
            
            {/* Live Preview Header Indicator */}
            <div className="py-2.5 px-4 bg-[#1a233a]/5 dark:bg-white/5 border-b border-border/50 flex items-center justify-between text-xs font-semibold print:hidden text-muted-foreground select-none">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Legal Paper Live Preview
              </span>
              <span>2.54cm Margins</span>
            </div>

            {/* Letterhead Sheet Area */}
            <div className="p-8 md:p-12 text-slate-800 dark:text-slate-100 font-serif leading-relaxed text-sm bg-[#fafafa] dark:bg-slate-950 min-h-[842px] relative flex flex-col justify-between border-t-4 border-amber-500 print:bg-white print:border-0 print:p-0 print:text-black">
              
              {/* Draft Sheet Contents */}
              <div>
                
                {/* 1. Advocate Header (Designation) */}
                <div className="text-center pb-6 border-b border-slate-300/80">
                  <h1 className="text-xl font-extrabold tracking-wide uppercase text-slate-900 dark:text-white print:text-black leading-none mb-2">
                    {formData.advocateName || "MANMOHAN D. SARDA"}
                  </h1>
                  <p className="text-[12px] uppercase font-bold tracking-widest text-amber-600 dark:text-amber-400 print:text-gray-700 leading-none">
                    {formData.advocateFirm || "Advocate & Associates"}
                  </p>
                </div>

                {/* 2. Ref details and Date row */}
                <div className="flex justify-between items-start text-[11px] font-bold mt-5 font-mono text-slate-600 dark:text-slate-300 print:text-black">
                  <div>
                    Ref.No. {formData.refNo || "[Reference Number]"}
                  </div>
                  <div>
                    Date: {formData.date ? new Date(formData.date).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric"
                    }) : "[Notice Date]"}
                  </div>
                </div>

                {/* 3. Delivery Method */}
                <div className="text-center font-bold text-[12px] uppercase tracking-wider underline my-4 text-slate-900 dark:text-white print:text-black">
                  {formData.deliveryMode || "NOTICE BY R .P .A .D."}
                </div>

                {/* 4. Client Sender Details */}
                <div className="my-4">
                  <span className="font-bold text-[12px] uppercase block mb-1 text-slate-900 dark:text-white print:text-black">
                    FOR AND ON BEHALF OF MY CLIENT:
                  </span>
                  <div className="pl-4 border-l-2 border-slate-300/40 text-[12px] space-y-0.5">
                    <p className="font-bold text-slate-900 dark:text-white print:text-black">{formData.clientName || "[Client Company/Sender Name]"}</p>
                    <p className="text-slate-600 dark:text-slate-300 print:text-black whitespace-pre-line leading-snug">{formData.clientAddress || "[Client Address]"}</p>
                    <p className="font-semibold text-slate-700 dark:text-slate-300 print:text-black">Mob- {formData.clientMobile || "[Client Phone]"}</p>
                  </div>
                </div>

                {/* 5. Recipient Dues Details */}
                <div className="my-4">
                  <span className="font-bold text-[12px] uppercase block mb-1 text-slate-900 dark:text-white print:text-black">
                    To,
                  </span>
                  <div className="pl-4 border-l-2 border-slate-300/40 text-[12px] space-y-0.5">
                    <p className="font-bold text-slate-900 dark:text-white print:text-black">{formData.recipientName || "[Recipient Name / Proprietor]"}</p>
                    <p className="text-slate-600 dark:text-slate-300 print:text-black whitespace-pre-line leading-snug">{formData.recipientAddress || "[Recipient Address]"}</p>
                    <p className="font-semibold text-slate-700 dark:text-slate-300 print:text-black">Mob:- {formData.recipientMobile || "[Recipient Phone]"}</p>
                  </div>
                </div>

                {/* 6. Subject Line */}
                <div className="my-5 leading-normal">
                  <p className="font-bold text-slate-950 dark:text-white print:text-black text-[12px] leading-snug">
                    Subject: <span className="underline uppercase">{formData.subject || "[LEGAL NOTICE SUBJECT TITLE]"}</span>
                  </p>
                </div>

                {/* 7. Salutation & Opening statement */}
                <div className="my-3">
                  <p className="font-bold text-slate-900 dark:text-white print:text-black mb-2">Dear Sir,</p>
                  <p className="text-[12.5px] leading-relaxed text-justify text-slate-700 dark:text-slate-200 print:text-black">
                    As per instruction and authority given by my above named client, I serve you following notice as under:
                  </p>
                </div>

                {/* 8. Factual allegations paragraphs */}
                <div className="space-y-4 my-4">
                  {formData.paragraphs.map((para, idx) => (
                    <div key={idx} className="flex gap-2 text-[12.5px] leading-relaxed text-justify text-slate-700 dark:text-slate-200 print:text-black">
                      <span className="font-bold shrink-0 font-mono">{idx + 1}]</span>
                      <p className="flex-1 whitespace-pre-line">{para || `[Factual details and claims for point ${idx + 1}]`}</p>
                    </div>
                  ))}
                </div>

                {/* 9. Closing Signoff */}
                <div className="mt-8 flex justify-between items-end print:mt-12 text-[12.5px]">
                  <div>
                    <p className="text-slate-700 dark:text-slate-300 print:text-black">Thanking you,</p>
                  </div>
                  <div className="text-right pr-4">
                    <p className="text-slate-700 dark:text-slate-300 print:text-black">Regards,</p>
                    <div className="h-10 print:h-12" />
                    <p className="font-bold text-slate-900 dark:text-white print:text-black tracking-wide">
                      {formData.advocateName || "MANMOHAN D. SARDA"}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 print:text-black font-semibold leading-none mt-0.5">
                      ({formData.advocateFirm || "Advocate & Associates"})
                    </p>
                  </div>
                </div>

              </div>

              {/* 10. Disclaimer footer (aligned to bottom of page) */}
              <div className="pt-6 mt-10 border-t border-slate-300/40 text-[10px] text-slate-500 dark:text-slate-400 print:text-black text-justify leading-relaxed">
                <span className="font-bold text-slate-700 dark:text-slate-300 print:text-black mr-1">Note:-</span>
                {formData.disclaimer || "[Notice Disclaimer]"}
              </div>

            </div>

          </Card>
        </div>

      </div>

    </div>
  );
}
