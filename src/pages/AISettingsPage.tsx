import { useState } from "react";
import { useAIConfig } from "@/hooks/useAIConfig";
import { useAppSettings } from "@/hooks/useAppSettings";
import { useRole } from "@/hooks/useRole";
import {
  PROVIDER_INFO,
  getProviderModels,
  testConnection,
  type AIProvider,
} from "@/lib/ai-providers";
import { PageHeader } from "@/components/PageHeader";
import {
  Key, Eye, EyeOff, CheckCircle2, XCircle, Loader2,
  Zap, Brain, Sparkles, Cpu, ExternalLink, ShieldCheck, ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";

const ICONS: Record<AIProvider, typeof Zap> = {
  groq: Zap,
  openai: Brain,
  gemini: Sparkles,
  openrouter: ExternalLink,
  custom: Cpu,
};

export default function AISettingsPage() {
  const { config, loading, updateProvider, setActiveProvider } = useAIConfig();
  const { settings: appSettings, setAutofill, isSaving } = useAppSettings();
  const { isAdminOrAbove } = useRole();

  /* ── Non-admin users see a warning ── */
  if (!isAdminOrAbove) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="AI Configuration"
          breadcrumbs={[
            { label: "Setup", path: "/setup/matters" },
            { label: "AI Settings" },
          ]}
        />
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <ShieldAlert className="w-12 h-12 text-red-400/60 mb-4" />
          <h2 className="text-lg font-semibold text-slate-100 mb-2">Access Restricted</h2>
          <p className="text-sm text-slate-400 max-w-md">
            Only Super Admins and Admins can configure AI API keys.
            Contact your administrator to set up the AI Agent.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Configuration"
        breadcrumbs={[
          { label: "Setup", path: "/setup/matters" },
          { label: "AI Settings" },
        ]}
      />

      {/* info banner */}
      <div className="flex items-start gap-3 rounded-xl border border-amber-400/20 bg-amber-400/5 p-4">
        <ShieldCheck className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
        <div className="text-sm text-slate-300 leading-relaxed">
          API keys are stored securely in the database and shared across <strong>all users</strong> in your firm.
          Once you save and test a key, <strong>all users instantly get access</strong> to the AI Agent — no action needed on their side.
          Only Admins and Super Admins can view or modify these keys.
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {(Object.keys(PROVIDER_INFO) as AIProvider[]).map((provider) => (
          <ProviderCard
            key={provider}
            provider={provider}
            entry={config.providers[provider] || { apiKey: '', model: '', enabled: false }}
            isActive={config.activeProvider === provider}
            onUpdate={(u) => updateProvider(provider, u)}
            onSetActive={() => setActiveProvider(provider)}
            onTestAndActivate={() => setActiveProvider(provider)}
          />
        ))}
      </div>

      {/* ── AI Autofill Toggle ── */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5 text-violet-500" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">AI Autofill</h3>
              <p className="text-xs text-muted-foreground mt-0.5 max-w-md">
                When enabled, a smart suggestion card appears below description and notes fields across the app.
                The AI reads what you've typed and offers a professional continuation — click <strong>"Use suggestion"</strong> to apply it.
              </p>
              <div className="flex items-center gap-1.5 mt-2">
                <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                  appSettings.autofillEnabled
                    ? "bg-violet-500/10 border-violet-400/30 text-violet-600 dark:text-violet-400"
                    : "bg-muted border-border text-muted-foreground"
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${appSettings.autofillEnabled ? "bg-violet-500" : "bg-muted-foreground"}`} />
                  {appSettings.autofillEnabled ? "Active for all users" : "Disabled"}
                </span>
              </div>
            </div>
          </div>

          {/* Toggle switch */}
          <button
            type="button"
            disabled={isSaving}
            onClick={() => setAutofill(!appSettings.autofillEnabled)}
            className={`relative shrink-0 inline-flex h-6 w-11 items-center rounded-full border-2 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
              appSettings.autofillEnabled
                ? "bg-violet-600 border-violet-600"
                : "bg-muted border-border"
            }`}
          >
            {isSaving ? (
              <Loader2 className="w-3 h-3 text-white animate-spin absolute left-1/2 -translate-x-1/2" />
            ) : (
              <span className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                appSettings.autofillEnabled ? "translate-x-5" : "translate-x-0.5"
              }`} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────── Provider Card ────────────────────────── */

interface CardEntry { apiKey: string; model: string; baseUrl?: string; enabled: boolean }

interface ProviderCardProps {
  provider: AIProvider;
  entry: CardEntry;
  isActive: boolean;
  onUpdate: (u: Partial<CardEntry>) => void;
  onSetActive: () => void;
  onTestAndActivate: () => void;
}

function ProviderCard({ provider, entry, isActive, onUpdate, onSetActive, onTestAndActivate }: ProviderCardProps) {
  const info = PROVIDER_INFO[provider];
  const Icon = ICONS[provider];
  const models = getProviderModels(provider);

  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<boolean | null>(null);

  const handleTest = async () => {
    if (!entry.apiKey) {
      toast.error("Enter an API key first");
      return;
    }
    setTesting(true);
    setTestResult(null);
    const errMsg = await testConnection({
      provider,
      apiKey: entry.apiKey,
      model: entry.model || models[0]?.id || "",
      baseUrl: entry.baseUrl,
      name: provider,
    });
    const ok = errMsg === null;
    setTestResult(ok);
    setTesting(false);
    if (ok) {
      toast.success(`${info.label} connected! Now active for all users.`);
      onUpdate({ enabled: true });
      onTestAndActivate(); // auto-activate so all users immediately use this provider
    } else {
      toast.error(`${info.label} error: ${errMsg}`, { duration: 8000 });
    }
  };

  return (
    <div
      className={`relative rounded-2xl border p-5 transition-all duration-300 ${
        isActive
          ? "border-amber-400/40 bg-amber-400/[0.04] shadow-lg shadow-amber-400/5"
          : "border-slate-700/60 bg-slate-800/40 hover:border-slate-600"
      }`}
    >
      {isActive && (
        <span className="absolute -top-2.5 right-4 bg-amber-400 text-[10px] font-bold text-slate-900 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
          Active
        </span>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: `${info.color}20` }}
        >
          <Icon className="w-5 h-5" style={{ color: info.color }} />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-slate-100">{info.label}</h3>
          <p className="text-[11px] text-slate-400">{info.description}</p>
        </div>
        {provider === "groq" && (
          <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer"
            className="text-[11px] text-slate-400 hover:text-amber-400 flex items-center gap-1 transition-colors">
            Get Key <ExternalLink className="w-3 h-3" />
          </a>
        )}
        {provider === "openai" && (
          <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer"
            className="text-[11px] text-slate-400 hover:text-amber-400 flex items-center gap-1 transition-colors">
            Get Key <ExternalLink className="w-3 h-3" />
          </a>
        )}
        {provider === "gemini" && (
          <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer"
            className="text-[11px] text-slate-400 hover:text-amber-400 flex items-center gap-1 transition-colors">
            Get Key <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>

      {/* API Key */}
      <label className="block mb-3">
        <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
          <Key className="w-3 h-3" /> API Key
        </span>
        <div className="relative">
          <input
            type={showKey ? "text" : "password"}
            placeholder="Enter your API key…"
            value={entry.apiKey}
            onChange={(e) => {
              onUpdate({ apiKey: e.target.value });
              setTestResult(null);
            }}
            className="w-full rounded-lg border border-slate-600/60 bg-slate-900/60 px-3 py-2 pr-10 text-sm text-slate-200 placeholder:text-slate-500 focus:border-amber-400/50 focus:outline-none focus:ring-1 focus:ring-amber-400/30 transition-colors"
          />
          <button
            type="button"
            onClick={() => setShowKey((v) => !v)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
          >
            {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </label>

      {/* Custom base URL */}
      {provider === "custom" && (
        <label className="block mb-3">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-1.5 block">
            Base URL
          </span>
          <input
            type="text"
            placeholder="https://your-api.example.com/v1"
            value={entry.baseUrl || ""}
            onChange={(e) => onUpdate({ baseUrl: e.target.value })}
            className="w-full rounded-lg border border-slate-600/60 bg-slate-900/60 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-amber-400/50 focus:outline-none focus:ring-1 focus:ring-amber-400/30 transition-colors"
          />
        </label>
      )}

      {/* Model select */}
      <label className="block mb-4">
        <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-1.5 block">
          Model
        </span>
        {models.length > 0 ? (
          <select
            value={entry.model}
            onChange={(e) => onUpdate({ model: e.target.value })}
            className="w-full rounded-lg border border-slate-600/60 bg-slate-900/60 px-3 py-2 text-sm text-slate-200 focus:border-amber-400/50 focus:outline-none focus:ring-1 focus:ring-amber-400/30 transition-colors"
          >
            {models.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        ) : (
          <input
            type="text"
            placeholder="e.g. my-custom-model"
            value={entry.model}
            onChange={(e) => onUpdate({ model: e.target.value })}
            className="w-full rounded-lg border border-slate-600/60 bg-slate-900/60 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-amber-400/50 focus:outline-none focus:ring-1 focus:ring-amber-400/30 transition-colors"
          />
        )}
      </label>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleTest}
          disabled={testing || !entry.apiKey}
          className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-slate-600/50 bg-slate-700/40 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-700/70 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {testing ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : testResult === true ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          ) : testResult === false ? (
            <XCircle className="w-3.5 h-3.5 text-red-400" />
          ) : (
            <Zap className="w-3.5 h-3.5" />
          )}
          Test Connection
        </button>

        {!isActive && entry.apiKey && (
          <button
            onClick={onSetActive}
            className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-amber-400/90 px-3 py-2 text-xs font-bold text-slate-900 hover:bg-amber-400 transition-colors"
          >
            Set Active
          </button>
        )}
      </div>
    </div>
  );
}
