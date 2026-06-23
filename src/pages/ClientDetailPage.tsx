import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { PageLoader } from "@/components/PageLoader";
import { useMinLoader } from "@/hooks/useMinLoader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  User, Phone, Mail, MapPin, Briefcase, Gavel, FileText, Receipt,
  StickyNote, Scale, Calendar, ArrowLeft, IndianRupee, MessageSquare
} from "lucide-react";
import { format } from "date-fns";
import { CommunicationLogList } from "@/components/communications/CommunicationLogList";

function InfoCard({ icon: Icon, label, value }: { icon: any; label: string; value?: string | null }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
      <Icon className="w-4 h-4 mt-0.5 text-primary shrink-0" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium">{value || "—"}</p>
      </div>
    </div>
  );
}

function SectionEmpty({ message }: { message: string }) {
  return <p className="text-sm text-muted-foreground py-8 text-center">{message}</p>;
}

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: client, isLoading: clientLoading } = useQuery({
    queryKey: ["client", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("*").eq("id", id!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: cases = [] } = useQuery({
    queryKey: ["client-cases", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("cases").select("*").eq("client_id", id!).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ["client-invoices", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("invoices").select("*").eq("client_id", id!).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: notes = [] } = useQuery({
    queryKey: ["client-notes", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("notes").select("*").eq("client_id", id!).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: advice = [] } = useQuery({
    queryKey: ["client-advice", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("advice").select("*").eq("client_id", id!).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Hearings linked through client's cases
  const caseIds = cases.map(c => c.id);
  const { data: hearings = [] } = useQuery({
    queryKey: ["client-hearings", caseIds],
    queryFn: async () => {
      if (caseIds.length === 0) return [];
      const { data, error } = await supabase.from("hearings").select("*, cases(title)").in("case_id", caseIds).order("hearing_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: caseIds.length > 0,
  });

  const { data: documents = [] } = useQuery({
    queryKey: ["client-documents", caseIds],
    queryFn: async () => {
      if (caseIds.length === 0) return [];
      const { data, error } = await supabase.from("documents").select("*, cases(title)").in("case_id", caseIds).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: caseIds.length > 0,
  });

  const showLoader = useMinLoader(clientLoading);
  if (showLoader) return <PageLoader />;
  if (!client) return <div className="p-8 text-center text-muted-foreground">Client not found</div>;

  const statusColor: Record<string, string> = {
    open: "bg-blue-500/10 text-blue-600",
    "in-progress": "bg-yellow-500/10 text-yellow-600",
    closed: "bg-muted text-muted-foreground",
    won: "bg-green-500/10 text-green-600",
    lost: "bg-red-500/10 text-red-600",
    draft: "bg-muted text-muted-foreground",
    sent: "bg-blue-500/10 text-blue-600",
    paid: "bg-green-500/10 text-green-600",
    overdue: "bg-red-500/10 text-red-600",
    cancelled: "bg-muted text-muted-foreground",
    pending: "bg-yellow-500/10 text-yellow-600",
    completed: "bg-green-500/10 text-green-600",
    scheduled: "bg-blue-500/10 text-blue-600",
    adjourned: "bg-orange-500/10 text-orange-600",
  };

  const totalInvoiced = invoices.reduce((s, inv) => s + Number(inv.total || 0), 0);
  const totalPaid = invoices.filter(i => i.status === "paid").reduce((s, inv) => s + Number(inv.total || 0), 0);
  const totalOutstanding = totalInvoiced - totalPaid;

  return (
    <div>
      <PageHeader
        title={client.name}
        breadcrumbs={[{ label: "Home", path: "/" }, { label: "Clients", path: "/clients" }, { label: client.name }]}
      />

      {/* Client Header Card */}
      <div className="bg-card border border-border rounded-xl p-6 mb-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-2xl font-bold text-primary">
              {client.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="text-xl font-semibold">{client.name}</h2>
              <p className="text-sm text-muted-foreground">{client.email || "No email"}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Client since {format(new Date(client.created_at), "MMM dd, yyyy")}
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate("/clients")}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Clients
          </Button>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
          <div className="p-3 rounded-lg bg-muted/50 text-center">
            <p className="text-2xl font-bold text-primary">{cases.length}</p>
            <p className="text-xs text-muted-foreground">Cases</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50 text-center">
            <p className="text-2xl font-bold text-primary">{hearings.length}</p>
            <p className="text-xs text-muted-foreground">Hearings</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50 text-center">
            <p className="text-2xl font-bold text-green-600">₹{totalPaid.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Paid</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50 text-center">
            <p className="text-2xl font-bold text-red-600">₹{totalOutstanding.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Outstanding</p>
          </div>
        </div>
      </div>

      {/* Tabbed Content */}
      <div className="bg-card border border-border rounded-xl p-6">
        <Tabs defaultValue="info" className="w-full">
          <TabsList className="mb-6 flex-wrap h-auto gap-1">
            <TabsTrigger value="info"><User className="w-3.5 h-3.5 mr-1.5" />Info</TabsTrigger>
            <TabsTrigger value="cases"><Briefcase className="w-3.5 h-3.5 mr-1.5" />Cases ({cases.length})</TabsTrigger>
            <TabsTrigger value="hearings"><Gavel className="w-3.5 h-3.5 mr-1.5" />Hearings ({hearings.length})</TabsTrigger>
            <TabsTrigger value="invoices"><Receipt className="w-3.5 h-3.5 mr-1.5" />Invoices ({invoices.length})</TabsTrigger>
            <TabsTrigger value="advice"><Scale className="w-3.5 h-3.5 mr-1.5" />Advice ({advice.length})</TabsTrigger>
            <TabsTrigger value="comms"><MessageSquare className="w-3.5 h-3.5 mr-1.5" />Comms</TabsTrigger>
            <TabsTrigger value="notes"><StickyNote className="w-3.5 h-3.5 mr-1.5" />Notes ({notes.length})</TabsTrigger>
            <TabsTrigger value="documents"><FileText className="w-3.5 h-3.5 mr-1.5" />Documents ({documents.length})</TabsTrigger>
          </TabsList>

          {/* Info Tab */}
          <TabsContent value="info">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <InfoCard icon={User} label="Full Name" value={client.name} />
              <InfoCard icon={Mail} label="Email" value={client.email} />
              <InfoCard icon={Phone} label="Phone" value={client.phone} />
              <InfoCard icon={MapPin} label="City" value={client.city} />
              <InfoCard icon={MapPin} label="State" value={client.state} />
              <InfoCard icon={MapPin} label="Country" value={client.country} />
              <InfoCard icon={Calendar} label="Created" value={format(new Date(client.created_at), "PPP")} />
              <InfoCard icon={Calendar} label="Last Updated" value={format(new Date(client.updated_at), "PPP")} />
            </div>
          </TabsContent>

          {/* Cases Tab */}
          <TabsContent value="cases">
            {cases.length === 0 ? <SectionEmpty message="No cases linked to this client." /> : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Case #</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Title</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Type</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Court</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Status</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Filed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cases.map(c => (
                      <tr key={c.id} className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors">
                        <td className="py-3 px-4 text-sm font-mono">{c.case_number}</td>
                        <td className="py-3 px-4 text-sm font-medium">{c.title}</td>
                        <td className="py-3 px-4 text-sm">{c.case_type || "—"}</td>
                        <td className="py-3 px-4 text-sm">{c.court_name || "—"}</td>
                        <td className="py-3 px-4">
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColor[c.status] || "bg-muted text-muted-foreground"}`}>
                            {c.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm">{c.filing_date ? format(new Date(c.filing_date), "MMM dd, yyyy") : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          {/* Hearings Tab */}
          <TabsContent value="hearings">
            {hearings.length === 0 ? <SectionEmpty message="No hearings found for this client's cases." /> : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Date</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Case</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Court</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Judge</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Purpose</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hearings.map((h: any) => (
                      <tr key={h.id} className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors">
                        <td className="py-3 px-4 text-sm">{format(new Date(h.hearing_date), "MMM dd, yyyy")}</td>
                        <td className="py-3 px-4 text-sm font-medium">{h.cases?.title || "—"}</td>
                        <td className="py-3 px-4 text-sm">{h.court_name || "—"}</td>
                        <td className="py-3 px-4 text-sm">{h.judge_name || "—"}</td>
                        <td className="py-3 px-4 text-sm">{h.purpose || "—"}</td>
                        <td className="py-3 px-4">
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColor[h.status] || "bg-muted text-muted-foreground"}`}>
                            {h.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          {/* Invoices Tab */}
          <TabsContent value="invoices">
            {/* Invoice summary bar */}
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground">Total Invoiced</p>
                <p className="text-lg font-bold">₹{totalInvoiced.toLocaleString()}</p>
              </div>
              <div className="p-3 rounded-lg bg-green-500/10">
                <p className="text-xs text-muted-foreground">Total Paid</p>
                <p className="text-lg font-bold text-green-600">₹{totalPaid.toLocaleString()}</p>
              </div>
              <div className="p-3 rounded-lg bg-red-500/10">
                <p className="text-xs text-muted-foreground">Outstanding</p>
                <p className="text-lg font-bold text-red-600">₹{totalOutstanding.toLocaleString()}</p>
              </div>
            </div>
            {invoices.length === 0 ? <SectionEmpty message="No invoices for this client." /> : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Invoice #</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Amount</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Tax</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Total</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Due Date</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map(inv => (
                      <tr key={inv.id} className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors">
                        <td className="py-3 px-4 text-sm font-mono">{inv.invoice_number}</td>
                        <td className="py-3 px-4 text-sm">₹{Number(inv.amount).toLocaleString()}</td>
                        <td className="py-3 px-4 text-sm">₹{Number(inv.tax).toLocaleString()}</td>
                        <td className="py-3 px-4 text-sm font-medium">₹{Number(inv.total).toLocaleString()}</td>
                        <td className="py-3 px-4 text-sm">{inv.due_date ? format(new Date(inv.due_date), "MMM dd, yyyy") : "—"}</td>
                        <td className="py-3 px-4">
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColor[inv.status] || "bg-muted text-muted-foreground"}`}>
                            {inv.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          {/* Advice Tab */}
          <TabsContent value="advice">
            {advice.length === 0 ? <SectionEmpty message="No advice records for this client." /> : (
              <div className="space-y-3">
                {advice.map(a => (
                  <div key={a.id} className="p-4 rounded-lg border border-border bg-muted/30">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-sm">{a.subject}</h4>
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColor[a.status] || "bg-muted text-muted-foreground"}`}>
                        {a.status}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">{a.description || "No description"}</p>
                    <p className="text-xs text-muted-foreground mt-2">{format(new Date(a.advice_date), "MMM dd, yyyy")}</p>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Comms Tab */}
          <TabsContent value="comms">
            <CommunicationLogList clientId={id} />
          </TabsContent>

          {/* Notes Tab */}
          <TabsContent value="notes">
            {notes.length === 0 ? <SectionEmpty message="No notes for this client." /> : (
              <div className="space-y-3">
                {notes.map(n => (
                  <div key={n.id} className="p-4 rounded-lg border border-border bg-muted/30">
                    <h4 className="font-medium text-sm mb-1">{n.title}</h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{n.content || "No content"}</p>
                    <p className="text-xs text-muted-foreground mt-2">{format(new Date(n.created_at), "MMM dd, yyyy")}</p>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Documents Tab */}
          <TabsContent value="documents">
            {documents.length === 0 ? <SectionEmpty message="No documents linked to this client's cases." /> : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Title</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Type</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Case</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {documents.map((d: any) => (
                      <tr key={d.id} className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors">
                        <td className="py-3 px-4 text-sm font-medium">{d.title}</td>
                        <td className="py-3 px-4 text-sm">{d.document_type || "—"}</td>
                        <td className="py-3 px-4 text-sm">{d.cases?.title || "—"}</td>
                        <td className="py-3 px-4 text-sm">{format(new Date(d.created_at), "MMM dd, yyyy")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}