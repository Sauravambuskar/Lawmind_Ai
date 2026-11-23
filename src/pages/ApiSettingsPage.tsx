import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Bot,
  CheckCircle2,
  Cloud,
  Database,
  Eye,
  EyeOff,
  Globe2,
  Landmark,
  LockKeyhole,
  Mail,
  RefreshCw,
  Save,
  ServerCog,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import AISettingsPage from "@/pages/AISettingsPage";
import EmailSettingsPage from "@/pages/EmailSettingsPage";
import SmsSettingsPage from "@/pages/SmsSettingsPage";
import { MessageSquare } from "lucide-react";

type ControlSection = "ai" | "automation" | "email" | "sms" | "infrastructure";
type AIInitialTab = "providers" | "groups" | "modules";

interface IntegrationStatus {
  supabase: boolean;
  cloudflareR2: boolean;
  ecourts: boolean;
  scheduledSync: boolean;
  ecourtsBatchSize: number;
  masked: {
    r2AccountId: string | null;
    r2AccessKeyId: string | null;
    r2SecretAccessKey: string | null;
    r2BucketName: string | null;
    ecourtsApiKey: string | null;
    cronSecret: string | null;
  };
}

const sections = [
  { id: "ai" as const, label: "AI platform", detail: "Providers, keys, groups and modules", icon: Bot },
  { id: "automation" as const, label: "Web automation", detail: "TinyFish research agent access", icon: Globe2 },
  { id: "email" as const, label: "Email delivery", detail: "Provider, sender and delivery logs", icon: Mail },
  { id: "sms" as const, label: "SMS delivery", detail: "Fast2SMS key, sender and DLT templates", icon: MessageSquare },
  { id: "infrastructure" as const, label: "Server integrations", detail: "Database, storage and eCourts health", icon: ServerCog },
];

export default function ApiSettingsPage() {
  const { session } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedSection = searchParams.get("section") as ControlSection | null;
  const [section, setSection] = useState<ControlSection>(
    requestedSection && sections.some((item) => item.id === requestedSection) ? requestedSection : "ai",
  );

  useEffect(() => {
    if (requestedSection && sections.some((item) => item.id === requestedSection)) setSection(requestedSection);
  }, [requestedSection]);

  const initialAITab = useMemo<AIInitialTab>(() => {
    const tab = searchParams.get("tab");
    return tab === "groups" || tab === "modules" ? tab : "providers";
  }, [searchParams]);

  const selectSection = (next: ControlSection) => {
    setSection(next);
    const params: Record<string, string> = { section: next };
    if (next === "ai") params.tab = initialAITab;
    setSearchParams(params, { replace: true });
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <PageHeader
        title="API Control Center"
        breadcrumbs={[{ label: "Dashboard", path: "/" }, { label: "Administration" }, { label: "API Settings" }]}
      />

      <div className="relative overflow-hidden rounded-2xl border border-amber-400/20 bg-slate-950 px-5 py-4 text-slate-100 shadow-sm">
        <div className="absolute inset-y-0 right-0 w-48 bg-[radial-gradient(circle_at_center,rgba(251,191,36,0.15),transparent_68%)]" />
        <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-2.5">
              <LockKeyhole className="h-5 w-5 text-amber-300" />
            </div>
            <div>
              <h2 className="font-semibold text-white">Super Admin authority</h2>
              <p className="mt-0.5 max-w-2xl text-sm leading-relaxed text-slate-300">
                This is the only place where LawMind integrations can be configured. Changes apply to every user.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1.5 text-xs font-medium text-emerald-300 sm:self-auto">
            <ShieldCheck className="h-3.5 w-3.5" /> Restricted workspace
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[260px_minmax(0,1fr)]">
        <nav aria-label="API settings sections" className="h-fit rounded-xl border border-border bg-card p-2 shadow-sm xl:sticky xl:top-5">
          {sections.map((item) => {
            const Icon = item.icon;
            const active = item.id === section;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => selectSection(item.id)}
                className={`group flex w-full items-start gap-3 rounded-lg px-3 py-3 text-left transition-colors ${
                  active ? "bg-amber-400/10 text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                }`}
              >
                <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${active ? "text-amber-500" : "group-hover:text-foreground"}`} />
                <span>
                  <span className="block text-sm font-semibold">{item.label}</span>
                  <span className="mt-0.5 block text-xs leading-snug opacity-75">{item.detail}</span>
                </span>
              </button>
            );
          })}
        </nav>

        <main className="min-w-0">
          {section === "ai" && <AISettingsPage embedded initialTab={initialAITab} />}
          {section === "automation" && <TinyFishPanel />}
          {section === "email" && <EmailSettingsPage embedded />}
          {section === "sms" && <SmsSettingsPage embedded />}
          {section === "infrastructure" && (
            <EditableInfrastructurePanel token={session?.access_token || ""} />
          )}
        </main>
      </div>
    </div>
  );
}

function TinyFishPanel() {
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("https://agent.tinyfish.ai/v1");
  const [enabled, setEnabled] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);

  const configQuery = useQuery({
    queryKey: ["tinyfish-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_config")
        .select("api_key,base_url,is_active")
        .eq("provider", "tinyfish")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!configQuery.data) return;
    setApiKey(configQuery.data.api_key || "");
    setBaseUrl(configQuery.data.base_url || "https://agent.tinyfish.ai/v1");
    setEnabled(Boolean(configQuery.data.is_active));
  }, [configQuery.data]);

  const save = async () => {
    if (enabled && !apiKey.trim()) {
      toast.error("Add the TinyFish API key before enabling web automation");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("ai_config").upsert({
      provider: "tinyfish",
      api_key: apiKey.trim(),
      base_url: baseUrl.trim() || "https://agent.tinyfish.ai/v1",
      model: "agent",
      is_active: enabled,
    }, { onConflict: "provider" });
    setSaving(false);
    if (error) {
      toast.error(`Could not save TinyFish settings: ${error.message}`);
      return;
    }
    toast.success("TinyFish settings saved");
    configQuery.refetch();
  };

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <header className="border-b border-border px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-sky-500/10 p-2.5"><Globe2 className="h-5 w-5 text-sky-500" /></div>
          <div>
            <h2 className="font-semibold text-foreground">TinyFish web automation</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">Powers supervised legal research workflows and structured web tasks.</p>
          </div>
        </div>
      </header>

      <div className="space-y-5 p-5">
        <div className="flex items-center justify-between rounded-lg border border-border bg-muted/20 p-4">
          <div>
            <p className="text-sm font-semibold text-foreground">Enable web automation</p>
            <p className="mt-0.5 text-xs text-muted-foreground">When disabled, research actions stop for every user.</p>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} aria-label="Enable TinyFish web automation" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="tinyfish-key">API key</Label>
          <div className="relative">
            <Input
              id="tinyfish-key"
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder="tf_..."
              autoComplete="off"
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowKey((value) => !value)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={showKey ? "Hide API key" : "Show API key"}
            >
              {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="tinyfish-url">API base URL</Label>
          <Input id="tinyfish-url" value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} placeholder="https://agent.tinyfish.ai/v1" />
        </div>

        <div className="flex justify-end border-t border-border pt-4">
          <Button onClick={save} disabled={saving || configQuery.isLoading}>
            <Save className="mr-2 h-4 w-4" />{saving ? "Saving..." : "Save automation settings"}
          </Button>
        </div>
      </div>
    </section>
  );
}

function InfrastructurePanel({ token }: { token: string }) {
  const statusQuery = useQuery({
    queryKey: ["integration-status"],
    queryFn: async () => {
      const response = await fetch("/api/integration-status", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Could not read server integration status");
      return response.json() as Promise<IntegrationStatus>;
    },
    enabled: Boolean(token),
  });

  const status = statusQuery.data;
  const integrations = [
    { label: "Supabase", detail: "Authentication and practice database", icon: Database, ready: status?.supabase },
    { label: "Cloudflare R2", detail: "Private documents and evidence storage", icon: Cloud, ready: status?.cloudflareR2 },
    { label: "eCourts", detail: "Official case-status refresh service", icon: Landmark, ready: status?.ecourts },
    { label: "Scheduled sync", detail: `Daily protected refresh · batch ${status?.ecourtsBatchSize ?? 10}`, icon: RefreshCw, ready: status?.scheduledSync },
  ];

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <header className="flex flex-col gap-3 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-semibold text-foreground">Server integrations</h2>
          <p className="mt-1 text-sm text-muted-foreground">Live configuration health without exposing secret values.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => statusQuery.refetch()} disabled={statusQuery.isFetching}>
          <RefreshCw className={`mr-2 h-3.5 w-3.5 ${statusQuery.isFetching ? "animate-spin" : ""}`} />
          Refresh status
        </Button>
      </header>

      {statusQuery.isError ? (
        <div className="m-5 flex items-center gap-3 rounded-lg border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-600 dark:text-red-300">
          <XCircle className="h-5 w-5 shrink-0" /> Server status could not be loaded. Confirm the production environment variables.
        </div>
      ) : (
        <div className="divide-y divide-border">
          {integrations.map(({ label, detail, icon: Icon, ready }) => (
            <div key={label} className="flex items-center gap-4 px-5 py-4">
              <div className="rounded-lg bg-muted p-2.5"><Icon className="h-4 w-4 text-foreground" /></div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">{label}</p>
                <p className="text-xs text-muted-foreground">{detail}</p>
              </div>
              {statusQuery.isLoading ? (
                <span className="text-xs text-muted-foreground">Checking...</span>
              ) : ready ? (
                <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400"><CheckCircle2 className="h-4 w-4" /> Configured</span>
              ) : (
                <span className="flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400"><XCircle className="h-4 w-4" /> Needs setup</span>
              )}
            </div>
          ))}
        </div>
      )}

      <footer className="border-t border-border bg-muted/25 px-5 py-3 text-xs leading-relaxed text-muted-foreground">
        Secret values stay in the deployment environment. This page intentionally reports health only, so browser users can never read R2, eCourts or cron credentials.
      </footer>
    </section>
  );
}

function EditableInfrastructurePanel({ token }: { token: string }) {
  const [form, setForm] = useState({
    r2AccountId: "", r2AccessKeyId: "", r2SecretAccessKey: "", r2BucketName: "",
    ecourtsApiKey: "", ecourtsBatchSize: "10",
  });
  const [saving, setSaving] = useState(false);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const statusQuery = useQuery({
    queryKey: ["integration-status-editable"],
    queryFn: async () => {
      const response = await fetch("/api/integration-status", { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error("Could not read server integration status");
      return response.json() as Promise<IntegrationStatus>;
    },
    enabled: Boolean(token),
  });
  const status = statusQuery.data;

  useEffect(() => {
    if (!status) return;
    setForm((current) => ({ ...current, r2BucketName: status.masked.r2BucketName || "", ecourtsBatchSize: String(status.ecourtsBatchSize || 10) }));
  }, [status]);

  const save = async () => {
    setSaving(true);
    try {
      const response = await fetch("/api/integration-status", {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          r2_account_id: form.r2AccountId,
          r2_access_key_id: form.r2AccessKeyId,
          r2_secret_access_key: form.r2SecretAccessKey,
          r2_bucket_name: form.r2BucketName,
          ecourts_api_key: form.ecourtsApiKey,
          ecourts_batch_size: Number(form.ecourtsBatchSize),
        }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Could not save server settings");
      setForm((current) => ({ ...current, r2AccountId: "", r2AccessKeyId: "", r2SecretAccessKey: "", ecourtsApiKey: "" }));
      toast.success("Server integration settings saved");
      await statusQuery.refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save server settings");
    } finally {
      setSaving(false);
    }
  };

  const secretInput = (id: string, label: string, value: string, placeholder: string | null | undefined, update: (value: string) => void) => (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input id={id} type={showSecrets[id] ? "text" : "password"} value={value} onChange={(event) => update(event.target.value)} placeholder={placeholder || "Not configured"} autoComplete="new-password" className="pr-10" />
        <button type="button" onClick={() => setShowSecrets((current) => ({ ...current, [id]: !current[id] }))} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label={showSecrets[id] ? `Hide ${label}` : `Show ${label}`}>
          {showSecrets[id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {placeholder && <p className="text-[11px] text-muted-foreground">Saved value: {placeholder}. Leave blank to keep it.</p>}
    </div>
  );

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <header className="flex flex-col gap-3 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div><h2 className="font-semibold text-foreground">Server integrations</h2><p className="mt-1 text-sm text-muted-foreground">Configure storage, official case sync and scheduled refresh from one place.</p></div>
        <Button variant="outline" size="sm" onClick={() => statusQuery.refetch()} disabled={statusQuery.isFetching}><RefreshCw className={`mr-2 h-3.5 w-3.5 ${statusQuery.isFetching ? "animate-spin" : ""}`} /> Refresh status</Button>
      </header>

      {statusQuery.isError ? <div className="m-5 flex items-center gap-3 rounded-lg border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-600 dark:text-red-300"><XCircle className="h-5 w-5 shrink-0" /> Server status could not be loaded. Apply the integration settings migration first.</div>
      : <div className="divide-y divide-border">
        <div className="flex items-center gap-4 bg-muted/20 px-5 py-4">
          <div className="rounded-lg bg-background p-2.5"><Database className="h-4 w-4 text-foreground" /></div>
          <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-foreground">Supabase system foundation</p><p className="text-xs text-muted-foreground">Authentication and secure settings storage. Bootstrap credentials stay in Vercel.</p></div>
          <IntegrationStatusBadge ready={status?.supabase} loading={statusQuery.isLoading} />
        </div>

        <div className="space-y-5 px-5 py-5">
          <IntegrationHeading icon={Cloud} title="Cloudflare R2" detail="Private documents, evidence and receipt storage" ready={status?.cloudflareR2} />
          <div className="grid gap-4 md:grid-cols-2">
            {secretInput("r2-account", "Account ID", form.r2AccountId, status?.masked.r2AccountId, (value) => setForm((current) => ({ ...current, r2AccountId: value })))}
            <div className="space-y-2"><Label htmlFor="r2-bucket">Bucket name</Label><Input id="r2-bucket" value={form.r2BucketName} onChange={(event) => setForm((current) => ({ ...current, r2BucketName: event.target.value }))} placeholder="lawmind-documents" /></div>
            {secretInput("r2-access", "Access key ID", form.r2AccessKeyId, status?.masked.r2AccessKeyId, (value) => setForm((current) => ({ ...current, r2AccessKeyId: value })))}
            {secretInput("r2-secret", "Secret access key", form.r2SecretAccessKey, status?.masked.r2SecretAccessKey, (value) => setForm((current) => ({ ...current, r2SecretAccessKey: value })))}
          </div>
        </div>

        <div className="space-y-5 px-5 py-5">
          <IntegrationHeading icon={Landmark} title="eCourts partner API" detail="Official case details and refresh operations" ready={status?.ecourts} />
          {secretInput("ecourts-key", "eCourts API key", form.ecourtsApiKey, status?.masked.ecourtsApiKey, (value) => setForm((current) => ({ ...current, ecourtsApiKey: value })))}
        </div>

        <div className="space-y-5 px-5 py-5">
          <IntegrationHeading icon={RefreshCw} title="Scheduled case sync" detail="Daily protected refresh at the configured Vercel schedule" ready={status?.scheduledSync} />
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2"><Label>Cron authorization</Label><div className="flex h-10 items-center rounded-md border border-input bg-muted/30 px-3 text-sm text-muted-foreground">{status?.masked.cronSecret || "Not configured in Vercel"}</div><p className="text-[11px] text-muted-foreground">Deployment-managed so scheduled requests cannot be locked out.</p></div>
            <div className="space-y-2"><Label htmlFor="batch-size">Cases per run</Label><Input id="batch-size" type="number" min={1} max={20} value={form.ecourtsBatchSize} onChange={(event) => setForm((current) => ({ ...current, ecourtsBatchSize: event.target.value }))} /><p className="text-[11px] text-muted-foreground">Allowed range: 1–20 active cases.</p></div>
          </div>
        </div>

        <div className="flex flex-col gap-3 bg-muted/20 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-2xl text-xs leading-relaxed text-muted-foreground">Secrets are stored in a server-only table. Browsers receive only masked values and health status after saving.</p>
          <Button onClick={save} disabled={saving || statusQuery.isLoading} className="shrink-0"><Save className="mr-2 h-4 w-4" />{saving ? "Saving..." : "Save server settings"}</Button>
        </div>
      </div>}
    </section>
  );
}

function IntegrationStatusBadge({ ready, loading }: { ready?: boolean; loading?: boolean }) {
  if (loading) return <span className="text-xs text-muted-foreground">Checking...</span>;
  return ready ? <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400"><CheckCircle2 className="h-4 w-4" /> Configured</span>
    : <span className="flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400"><XCircle className="h-4 w-4" /> Needs setup</span>;
}

function IntegrationHeading({ icon: Icon, title, detail, ready }: { icon: typeof Cloud; title: string; detail: string; ready?: boolean }) {
  return <div className="flex items-center gap-3"><div className="rounded-lg bg-muted p-2.5"><Icon className="h-4 w-4 text-foreground" /></div><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-foreground">{title}</p><p className="text-xs text-muted-foreground">{detail}</p></div><IntegrationStatusBadge ready={ready} /></div>;
}
