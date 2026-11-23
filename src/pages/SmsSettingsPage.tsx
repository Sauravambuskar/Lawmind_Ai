import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { restGet, restUpdate } from "@/lib/restClient";
import { useAuth } from "@/hooks/useAuth";
import type { SmsTemplate } from "@/lib/smsService";
import { toast } from "sonner";
import { MessageSquare, Save, Eye, EyeOff, CheckCircle2, XCircle, Zap } from "lucide-react";

interface SmsStatus {
  sms: boolean;
  smsEnabled: boolean;
  smsAutoSend: boolean;
  masked: { fast2smsApiKey: string | null; fast2smsSenderId: string | null };
}

export default function SmsSettingsPage({ embedded = false }: { embedded?: boolean }) {
  const { session } = useAuth();
  const token = session?.access_token || "";
  const queryClient = useQueryClient();

  const [apiKey, setApiKey] = useState("");
  const [senderId, setSenderId] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [autoSend, setAutoSend] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);

  const statusQuery = useQuery({
    queryKey: ["sms-integration-status"],
    queryFn: async () => {
      const response = await fetch("/api/integration-status", { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error("Could not read SMS status");
      return (await response.json()) as SmsStatus;
    },
    enabled: Boolean(token),
  });

  useEffect(() => {
    if (statusQuery.data) {
      setSenderId((prev) => prev || statusQuery.data!.masked.fast2smsSenderId || "");
      setEnabled(statusQuery.data.smsEnabled);
      setAutoSend(statusQuery.data.smsAutoSend);
    }
  }, [statusQuery.data]);

  const { data: templates = [] } = useQuery({
    queryKey: ["sms-templates-admin"],
    queryFn: async () => restGet<SmsTemplate>("sms_templates?select=*&order=sort_order.asc,name.asc"),
  });

  const saveCredentials = async () => {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { fast2sms_enabled: enabled, fast2sms_auto_send: autoSend };
      if (apiKey.trim()) payload.fast2sms_api_key = apiKey.trim();
      if (senderId.trim()) payload.fast2sms_sender_id = senderId.trim().toUpperCase();
      const response = await fetch("/api/integration-status", {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Could not save SMS settings");
      setApiKey("");
      toast.success("SMS settings saved");
      await statusQuery.refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save SMS settings");
    } finally {
      setSaving(false);
    }
  };

  const status = statusQuery.data;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {!embedded && <PageHeader title="SMS Settings" breadcrumbs={[{ label: "Dashboard", path: "/" }, { label: "Administration" }, { label: "SMS" }]} />}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2"><MessageSquare className="w-5 h-5 text-primary" />Fast2SMS (DLT)</CardTitle>
              <CardDescription>The API key is stored encrypted on the server and never sent to browsers.</CardDescription>
            </div>
            {status && (status.sms ? (
              <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400"><CheckCircle2 className="h-4 w-4" />Configured</span>
            ) : (
              <span className="flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400"><XCircle className="h-4 w-4" />Needs setup</span>
            ))}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-border bg-muted/20 p-4">
            <div>
              <p className="text-sm font-semibold text-foreground">Enable SMS sending</p>
              <p className="mt-0.5 text-xs text-muted-foreground">When off, both manual and automatic SMS are blocked for everyone.</p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} aria-label="Enable SMS sending" />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border bg-muted/20 p-4">
            <div>
              <p className="text-sm font-semibold text-foreground flex items-center gap-1.5"><Zap className="h-4 w-4 text-amber-500" />Automatic SMS</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Master switch for event-triggered SMS (new hearing, status change, advocate assigned, onboarding).
                <strong className="text-foreground"> On</strong> = autos can fire; <strong className="text-foreground">Off</strong> = only manual sends. Each template still needs its own Auto-send toggle below.
              </p>
            </div>
            <Switch checked={autoSend} onCheckedChange={setAutoSend} aria-label="Enable automatic SMS" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sms-key">Fast2SMS API key</Label>
              <div className="relative">
                <Input id="sms-key" type={showKey ? "text" : "password"} value={apiKey} onChange={(e) => setApiKey(e.target.value)}
                  placeholder={status?.masked.fast2smsApiKey || "Paste the Dev API key"} autoComplete="new-password" className="pr-10" />
                <button type="button" onClick={() => setShowKey((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label={showKey ? "Hide key" : "Show key"}>
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {status?.masked.fast2smsApiKey && <p className="text-[11px] text-muted-foreground">Saved: {status.masked.fast2smsApiKey}. Leave blank to keep it.</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="sms-sender">DLT Sender ID (header)</Label>
              <Input id="sms-sender" value={senderId} onChange={(e) => setSenderId(e.target.value.toUpperCase())} placeholder="CORADV" maxLength={6} />
              <p className="text-[11px] text-muted-foreground">3–6 letters/digits, your DLT-approved header.</p>
            </div>
          </div>

          <div className="flex justify-end border-t border-border pt-4">
            <Button onClick={saveCredentials} disabled={saving}><Save className="mr-2 h-4 w-4" />{saving ? "Saving..." : "Save SMS settings"}</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">DLT Templates ({templates.length})</CardTitle>
          <CardDescription>Approved templates. Turn on <strong>Auto-send</strong> only after testing — it fires real SMS on the matching app event.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {templates.map((t) => (
            <TemplateRow key={t.id} template={t} onSaved={() => queryClient.invalidateQueries({ queryKey: ["sms-templates-admin"] })} />
          ))}
          {templates.length === 0 && <p className="text-xs text-muted-foreground text-center py-6">No templates found. Run the SMS migration in Supabase.</p>}
        </CardContent>
      </Card>
    </div>
  );
}

function TemplateRow({ template, onSaved }: { template: SmsTemplate; onSaved: () => void }) {
  const [active, setActive] = useState(template.active);
  const [autoSend, setAutoSend] = useState(template.auto_send);
  const [messageId, setMessageId] = useState(template.message_id);
  const [senderId, setSenderId] = useState(template.sender_id || "");
  const [body, setBody] = useState(template.body);
  const [saving, setSaving] = useState(false);

  const dirty = active !== template.active || autoSend !== template.auto_send || messageId !== template.message_id || (template.sender_id || "") !== senderId || body !== template.body;

  const save = async () => {
    setSaving(true);
    try {
      await restUpdate("sms_templates", `id=eq.${template.id}`, {
        active, auto_send: autoSend, message_id: messageId.trim(), sender_id: senderId.trim().toUpperCase() || null, body, updated_at: new Date().toISOString(),
      });
      toast.success(`Saved "${template.name}"`);
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save template");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg border border-border p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{template.name}</p>
          <p className="text-[11px] text-muted-foreground">Key: {template.template_key} · Trigger: {template.trigger_event || "—"}</p>
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-xs"><span className="text-muted-foreground">Active</span><Switch checked={active} onCheckedChange={setActive} /></label>
          <label className="flex items-center gap-2 text-xs"><Zap className="h-3.5 w-3.5 text-amber-500" /><span className="text-muted-foreground">Auto-send</span><Switch checked={autoSend} onCheckedChange={setAutoSend} /></label>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div><Label className="text-xs">Message ID</Label><Input value={messageId} onChange={(e) => setMessageId(e.target.value)} placeholder="232319" /></div>
        <div><Label className="text-xs">Sender ID</Label><Input value={senderId} onChange={(e) => setSenderId(e.target.value.toUpperCase())} placeholder="CORADV" maxLength={6} /></div>
      </div>
      <div><Label className="text-xs">Template body (preview markers {"{1}"}, {"{2}"})</Label><Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={2} className="text-xs" /></div>
      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={save} disabled={!dirty || saving}><Save className="mr-2 h-3.5 w-3.5" />{saving ? "Saving..." : "Save"}</Button>
      </div>
    </div>
  );
}
