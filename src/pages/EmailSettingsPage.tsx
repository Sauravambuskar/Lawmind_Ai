import { useState, useEffect } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Mail, Save, Send, CheckCircle, XCircle, Clock } from "lucide-react";
import { sendEmail, getGeneralNotification } from "@/lib/emailService";
import { useAuth } from "@/hooks/useAuth";

export default function EmailSettingsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [form, setForm] = useState({
    provider: "emailjs",
    emailjs_service_id: "",
    emailjs_template_id: "",
    emailjs_public_key: "",
    smtp_host: "",
    smtp_port: "587",
    smtp_user: "",
    smtp_pass: "",
    from_email: "",
    from_name: "LawMind AI",
  });

  // Load existing settings
  const { data: settings } = useQuery({
    queryKey: ["email-settings"],
    queryFn: async () => {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
      const session = (await supabase.auth.getSession()).data.session;
      const authToken = session?.access_token || supabaseKey;
      const res = await fetch(`${supabaseUrl}/rest/v1/email_settings?limit=1`, {
        headers: { "apikey": supabaseKey, "Authorization": `Bearer ${authToken}` },
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data[0] || null;
    },
  });

  // Load email logs
  const { data: logs = [] } = useQuery({
    queryKey: ["email-logs"],
    queryFn: async () => {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
      const session = (await supabase.auth.getSession()).data.session;
      const authToken = session?.access_token || supabaseKey;
      const res = await fetch(`${supabaseUrl}/rest/v1/email_logs?select=*&order=created_at.desc&limit=20`, {
        headers: { "apikey": supabaseKey, "Authorization": `Bearer ${authToken}` },
      });
      if (!res.ok) return [];
      return await res.json();
    },
  });

  useEffect(() => {
    if (settings) {
      setForm({
        provider: settings.provider || "emailjs",
        emailjs_service_id: settings.emailjs_service_id || "",
        emailjs_template_id: settings.emailjs_template_id || "",
        emailjs_public_key: settings.emailjs_public_key || "",
        smtp_host: settings.smtp_host || "",
        smtp_port: String(settings.smtp_port || "587"),
        smtp_user: settings.smtp_user || "",
        smtp_pass: settings.smtp_pass || "",
        from_email: settings.from_email || "",
        from_name: settings.from_name || "LawMind AI",
      });
    }
  }, [settings]);

  const handleSave = async () => {
    setSaving(true);
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
    const session = (await supabase.auth.getSession()).data.session;
    const authToken = session?.access_token || supabaseKey;

    const payload = { ...form, smtp_port: Number(form.smtp_port), updated_at: new Date().toISOString() };

    // Delete existing and insert new (upsert)
    await fetch(`${supabaseUrl}/rest/v1/email_settings?id=not.is.null`, {
      method: "DELETE", headers: { "apikey": supabaseKey, "Authorization": `Bearer ${authToken}` },
    });
    const res = await fetch(`${supabaseUrl}/rest/v1/email_settings`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": supabaseKey, "Authorization": `Bearer ${authToken}`, "Prefer": "return=minimal" },
      body: JSON.stringify(payload),
    });

    setSaving(false);
    if (res.ok) {
      queryClient.invalidateQueries({ queryKey: ["email-settings"] });
      toast.success("Email settings saved");
    } else {
      toast.error("Failed to save settings");
    }
  };

  const handleTestEmail = async () => {
    if (!testEmail) { toast.error("Enter a test email address"); return; }
    setTesting(true);
    const template = getGeneralNotification("Test Email from LawMind AI", "This is a test email to verify your email configuration is working correctly.\n\n✅ If you received this, your email setup is complete!");
    template.to_email = testEmail;
    const result = await sendEmail(template);
    setTesting(false);
    if (result.success) toast.success("Test email sent successfully!");
    else toast.error(result.error || "Failed to send test email");
    queryClient.invalidateQueries({ queryKey: ["email-logs"] });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader title="Email Settings" breadcrumbs={[{ label: "Dashboard", path: "/" }, { label: "Setup" }, { label: "Email Settings" }]} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Settings Form */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Mail className="w-5 h-5 text-primary" />Email Provider Configuration</CardTitle>
              <CardDescription>Configure how LawMind sends emails (hearing reminders, invoices, notifications)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Provider</Label>
                <Select value={form.provider} onValueChange={v => setForm(p => ({ ...p, provider: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="emailjs">EmailJS (Recommended - Free 200/month)</SelectItem>
                    <SelectItem value="smtp">Custom SMTP (Server-side required)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {form.provider === "emailjs" && (
                <div className="space-y-3 p-4 bg-muted/30 border border-border rounded-lg">
                  <p className="text-xs text-muted-foreground">Setup: Go to <a href="https://emailjs.com" target="_blank" className="text-primary hover:underline">emailjs.com</a> → Create account → Add Service → Create Template → Copy IDs below</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div><Label>Service ID</Label><Input value={form.emailjs_service_id} onChange={e => setForm(p => ({ ...p, emailjs_service_id: e.target.value }))} placeholder="service_xxx" /></div>
                    <div><Label>Template ID</Label><Input value={form.emailjs_template_id} onChange={e => setForm(p => ({ ...p, emailjs_template_id: e.target.value }))} placeholder="template_xxx" /></div>
                    <div><Label>Public Key</Label><Input value={form.emailjs_public_key} onChange={e => setForm(p => ({ ...p, emailjs_public_key: e.target.value }))} placeholder="abc123..." /></div>
                  </div>
                </div>
              )}

              {form.provider === "smtp" && (
                <div className="space-y-3 p-4 bg-muted/30 border border-border rounded-lg">
                  <p className="text-xs text-amber-600 font-medium">⚠️ SMTP sending requires a server-side Edge Function. Settings saved here for future use.</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>SMTP Host</Label><Input value={form.smtp_host} onChange={e => setForm(p => ({ ...p, smtp_host: e.target.value }))} placeholder="smtp.gmail.com" /></div>
                    <div><Label>SMTP Port</Label><Input value={form.smtp_port} onChange={e => setForm(p => ({ ...p, smtp_port: e.target.value }))} placeholder="587" /></div>
                    <div><Label>Username</Label><Input value={form.smtp_user} onChange={e => setForm(p => ({ ...p, smtp_user: e.target.value }))} placeholder="your@email.com" /></div>
                    <div><Label>Password</Label><Input type="password" value={form.smtp_pass} onChange={e => setForm(p => ({ ...p, smtp_pass: e.target.value }))} placeholder="App password" /></div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div><Label>From Email</Label><Input value={form.from_email} onChange={e => setForm(p => ({ ...p, from_email: e.target.value }))} placeholder="noreply@lawmind.com" /></div>
                <div><Label>From Name</Label><Input value={form.from_name} onChange={e => setForm(p => ({ ...p, from_name: e.target.value }))} placeholder="LawMind AI" /></div>
              </div>

              <Button onClick={handleSave} disabled={saving} className="w-full gap-2">
                <Save className="w-4 h-4" />{saving ? "Saving..." : "Save Email Settings"}
              </Button>
            </CardContent>
          </Card>

          {/* Test Email */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Send Test Email</CardTitle>
            </CardHeader>
            <CardContent className="flex gap-3">
              <Input value={testEmail} onChange={e => setTestEmail(e.target.value)} placeholder="Enter email to send test..." className="flex-1" />
              <Button onClick={handleTestEmail} disabled={testing} variant="outline" className="gap-2">
                <Send className="w-4 h-4" />{testing ? "Sending..." : "Send Test"}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Email Logs */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2"><Clock className="w-4 h-4" />Recent Emails ({logs.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 max-h-[500px] overflow-y-auto custom-scrollbar">
              {logs.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">No emails sent yet</p>
              ) : logs.map((log: any) => (
                <div key={log.id} className="p-2.5 rounded-lg border border-border hover:bg-muted/20 transition-colors">
                  <div className="flex items-center gap-2 mb-1">
                    {log.status === "sent" ? <CheckCircle className="w-3 h-3 text-emerald-500" /> : <XCircle className="w-3 h-3 text-red-500" />}
                    <span className="text-xs font-medium text-foreground truncate">{log.subject}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">To: {log.to_email}</p>
                  <p className="text-[10px] text-muted-foreground">{new Date(log.created_at).toLocaleString()}</p>
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
