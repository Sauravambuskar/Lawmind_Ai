import { useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { restGet } from "@/lib/restClient";
import { sendSms, type SmsTemplate, type SmsLog } from "@/lib/smsService";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MessageSquare, Send, CheckCircle, XCircle, Clock, Smartphone } from "lucide-react";

export default function SmsPage() {
  const queryClient = useQueryClient();
  const [templateKey, setTemplateKey] = useState<string>("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [numbers, setNumbers] = useState("");
  const [sending, setSending] = useState(false);

  const { data: templates = [] } = useQuery({
    queryKey: ["sms-templates-active"],
    queryFn: async () =>
      restGet<SmsTemplate>("sms_templates?select=*&active=eq.true&order=sort_order.asc,name.asc"),
  });

  const { data: logs = [] } = useQuery({
    queryKey: ["sms-logs"],
    queryFn: async () => restGet<SmsLog>("sms_logs?select=*&order=created_at.desc&limit=25"),
    refetchInterval: 20_000,
  });

  const template = useMemo(() => templates.find((t) => t.template_key === templateKey), [templates, templateKey]);

  const preview = useMemo(() => {
    if (!template) return "";
    const ordered = (template.variables || []).map((v) => values[v.key] || "");
    return template.body.replace(/\{(\d+)\}/g, (_, n) => ordered[Number(n) - 1] || `{${(template.variables?.[Number(n) - 1]?.label) || n}}`);
  }, [template, values]);

  const selectTemplate = (key: string) => {
    setTemplateKey(key);
    setValues({});
  };

  const handleSend = async () => {
    if (!template) { toast.error("Choose a template"); return; }
    const ordered = (template.variables || []).map((v) => (values[v.key] || "").trim());
    if (ordered.some((v) => !v)) { toast.error("Fill every variable"); return; }
    if (!numbers.trim()) { toast.error("Enter at least one mobile number"); return; }

    setSending(true);
    const result = await sendSms({ templateKey: template.template_key, numbers, variables: ordered, triggerSource: "manual" });
    setSending(false);

    if (result.success) {
      toast.success("SMS sent" + (result.skippedNumbers?.length ? ` (skipped invalid: ${result.skippedNumbers.join(", ")})` : ""));
      setNumbers("");
    } else if (result.skipped) {
      toast.warning("SMS not sent — this template or SMS sending is turned off");
    } else {
      toast.error(result.error || "SMS could not be sent");
    }
    queryClient.invalidateQueries({ queryKey: ["sms-logs"] });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader title="Send SMS" breadcrumbs={[{ label: "Dashboard", path: "/" }, { label: "Communications" }, { label: "Send SMS" }]} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><MessageSquare className="w-5 h-5 text-primary" />Custom SMS</CardTitle>
              <CardDescription>Send a DLT-approved template over Fast2SMS. Only approved templates can be used.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Template</Label>
                <Select value={templateKey} onValueChange={selectTemplate}>
                  <SelectTrigger><SelectValue placeholder="Select a template" /></SelectTrigger>
                  <SelectContent>
                    {templates.length === 0 && <div className="px-3 py-2 text-xs text-muted-foreground">No active templates</div>}
                    {templates.map((t) => (
                      <SelectItem key={t.template_key} value={t.template_key}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {template && (template.variables || []).length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {(template.variables || []).map((v) => (
                    <div key={v.key}>
                      <Label>{v.label}</Label>
                      <Input
                        value={values[v.key] || ""}
                        onChange={(e) => setValues((p) => ({ ...p, [v.key]: e.target.value }))}
                        placeholder={v.label}
                      />
                    </div>
                  ))}
                </div>
              )}

              <div>
                <Label>Mobile number(s)</Label>
                <Input value={numbers} onChange={(e) => setNumbers(e.target.value)} placeholder="9876543210, 9123456780" />
                <p className="text-[11px] text-muted-foreground mt-1">Indian 10-digit numbers. Separate multiple with commas. +91 is handled automatically.</p>
              </div>

              {template && (
                <div className="rounded-lg border border-border bg-muted/30 p-4">
                  <p className="text-[11px] font-medium text-muted-foreground mb-1 flex items-center gap-1.5"><Smartphone className="w-3.5 h-3.5" />Message preview · Sender {template.sender_id || "—"}</p>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{preview}</p>
                </div>
              )}

              <Button onClick={handleSend} disabled={sending || !template} className="w-full gap-2">
                <Send className="w-4 h-4" />{sending ? "Sending..." : "Send SMS"}
              </Button>
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2"><Clock className="w-4 h-4" />Recent SMS ({logs.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 max-h-[560px] overflow-y-auto custom-scrollbar">
              {logs.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">No SMS sent yet</p>
              ) : logs.map((log) => (
                <div key={log.id} className="p-2.5 rounded-lg border border-border hover:bg-muted/20 transition-colors">
                  <div className="flex items-center gap-2 mb-1">
                    {log.status === "sent" ? <CheckCircle className="w-3 h-3 text-emerald-500 shrink-0" /> : <XCircle className="w-3 h-3 text-red-500 shrink-0" />}
                    <span className="text-xs font-medium text-foreground truncate">{log.template_key || "—"}</span>
                    {log.trigger_source && log.trigger_source !== "manual" && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-600 dark:text-sky-400">auto</span>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground">To: {log.to_number}</p>
                  {log.rendered_message && <p className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5">{log.rendered_message}</p>}
                  <p className="text-[10px] text-muted-foreground mt-0.5">{new Date(log.created_at).toLocaleString()}</p>
                  {log.error_msg && <p className="text-[10px] text-red-500 mt-0.5">{log.error_msg}</p>}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
