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
  User, Phone, Mail, Briefcase, Gavel, FileText,
  ArrowLeft, Calendar, Scale, Award
} from "lucide-react";
import { format } from "date-fns";

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

const statusColor: Record<string, string> = {
  open: "bg-blue-500/10 text-blue-600",
  "in-progress": "bg-yellow-500/10 text-yellow-600",
  closed: "bg-muted text-muted-foreground",
  won: "bg-green-500/10 text-green-600",
  lost: "bg-red-500/10 text-red-600",
  scheduled: "bg-blue-500/10 text-blue-600",
  adjourned: "bg-orange-500/10 text-orange-600",
  completed: "bg-green-500/10 text-green-600",
  pending: "bg-yellow-500/10 text-yellow-600",
};

export default function AdvocateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: advocate, isLoading } = useQuery({
    queryKey: ["advocate", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("advocates").select("*").eq("id", id!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: cases = [] } = useQuery({
    queryKey: ["advocate-cases", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("cases").select("*, clients(name)").eq("advocate_id", id!).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const caseIds = cases.map(c => c.id);

  const { data: hearings = [] } = useQuery({
    queryKey: ["advocate-hearings", caseIds],
    queryFn: async () => {
      if (caseIds.length === 0) return [];
      const { data, error } = await supabase.from("hearings").select("*, cases(title)").in("case_id", caseIds).order("hearing_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: caseIds.length > 0,
  });

  const { data: documents = [] } = useQuery({
    queryKey: ["advocate-documents", caseIds],
    queryFn: async () => {
      if (caseIds.length === 0) return [];
      const { data, error } = await supabase.from("documents").select("*, cases(title)").in("case_id", caseIds).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: caseIds.length > 0,
  });

  const { data: evidence = [] } = useQuery({
    queryKey: ["advocate-evidence", caseIds],
    queryFn: async () => {
      if (caseIds.length === 0) return [];
      const { data, error } = await supabase.from("evidence").select("*, cases(title)").in("case_id", caseIds).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: caseIds.length > 0,
  });

  const showLoader = useMinLoader(isLoading);
  if (showLoader) return <PageLoader />;
  if (!advocate) return <div className="p-8 text-center text-muted-foreground">Advocate not found</div>;

  const activeCases = cases.filter(c => c.status === "open" || c.status === "in-progress").length;
  const wonCases = cases.filter(c => c.status === "won").length;
  const upcomingHearings = hearings.filter(h => new Date(h.hearing_date) >= new Date()).length;

  return (
    <div>
      <PageHeader
        title={advocate.name}
        breadcrumbs={[{ label: "Home", path: "/" }, { label: "Advocates", path: "/advocates" }, { label: advocate.name }]}
      />

      {/* Advocate Header Card */}
      <div className="bg-card border border-border rounded-xl p-6 mb-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-2xl font-bold text-primary">
              {advocate.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold">{advocate.name}</h2>
                <Badge variant={advocate.status === "active" ? "default" : "secondary"}>{advocate.status}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">{advocate.specialization || "General Practice"}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {advocate.bar_number ? `Bar #${advocate.bar_number} · ` : ""}
                Since {format(new Date(advocate.created_at), "MMM dd, yyyy")}
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate("/advocates")}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Advocates
          </Button>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
          <div className="p-3 rounded-lg bg-muted/50 text-center">
            <p className="text-2xl font-bold text-primary">{cases.length}</p>
            <p className="text-xs text-muted-foreground">Total Cases</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50 text-center">
            <p className="text-2xl font-bold text-primary">{activeCases}</p>
            <p className="text-xs text-muted-foreground">Active Cases</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50 text-center">
            <p className="text-2xl font-bold text-green-600">{wonCases}</p>
            <p className="text-xs text-muted-foreground">Cases Won</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50 text-center">
            <p className="text-2xl font-bold text-primary">{upcomingHearings}</p>
            <p className="text-xs text-muted-foreground">Upcoming Hearings</p>
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
            <TabsTrigger value="evidence"><Scale className="w-3.5 h-3.5 mr-1.5" />Evidence ({evidence.length})</TabsTrigger>
            <TabsTrigger value="documents"><FileText className="w-3.5 h-3.5 mr-1.5" />Documents ({documents.length})</TabsTrigger>
          </TabsList>

          {/* Info Tab */}
          <TabsContent value="info">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <InfoCard icon={User} label="Full Name" value={advocate.name} />
              <InfoCard icon={Mail} label="Email" value={advocate.email} />
              <InfoCard icon={Phone} label="Phone" value={advocate.phone} />
              <InfoCard icon={Award} label="Specialization" value={advocate.specialization} />
              <InfoCard icon={Award} label="Bar Number" value={advocate.bar_number} />
              <InfoCard icon={Calendar} label="Created" value={format(new Date(advocate.created_at), "PPP")} />
              <InfoCard icon={Calendar} label="Last Updated" value={format(new Date(advocate.updated_at), "PPP")} />
            </div>
          </TabsContent>

          {/* Cases Tab */}
          <TabsContent value="cases">
            {cases.length === 0 ? <SectionEmpty message="No cases assigned to this advocate." /> : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Case #</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Title</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Client</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Type</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Court</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Status</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Filed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cases.map((c: any) => (
                      <tr key={c.id} className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors">
                        <td className="py-3 px-4 text-sm font-mono">{c.case_number}</td>
                        <td className="py-3 px-4 text-sm font-medium">{c.title}</td>
                        <td className="py-3 px-4 text-sm">{c.clients?.name || "—"}</td>
                        <td className="py-3 px-4 text-sm">{c.case_type || "—"}</td>
                        <td className="py-3 px-4 text-sm">{c.court_name || "—"}</td>
                        <td className="py-3 px-4">
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColor[c.status] || "bg-muted text-muted-foreground"}`}>{c.status}</span>
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
            {hearings.length === 0 ? <SectionEmpty message="No hearings found for this advocate's cases." /> : (
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
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColor[h.status] || "bg-muted text-muted-foreground"}`}>{h.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          {/* Evidence Tab */}
          <TabsContent value="evidence">
            {evidence.length === 0 ? <SectionEmpty message="No evidence linked to this advocate's cases." /> : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Title</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Type</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Case</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Submitted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {evidence.map((e: any) => (
                      <tr key={e.id} className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors">
                        <td className="py-3 px-4 text-sm font-medium">{e.title}</td>
                        <td className="py-3 px-4 text-sm">{e.evidence_type || "—"}</td>
                        <td className="py-3 px-4 text-sm">{e.cases?.title || "—"}</td>
                        <td className="py-3 px-4 text-sm">{e.submitted_date ? format(new Date(e.submitted_date), "MMM dd, yyyy") : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          {/* Documents Tab */}
          <TabsContent value="documents">
            {documents.length === 0 ? <SectionEmpty message="No documents linked to this advocate's cases." /> : (
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