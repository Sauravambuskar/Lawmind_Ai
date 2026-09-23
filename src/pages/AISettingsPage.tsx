import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useAIConfig } from "@/hooks/useAIConfig";
import { useAppSettings } from "@/hooks/useAppSettings";
import { useRole } from "@/hooks/useRole";
import {
  PROVIDER_INFO,
  getProviderModels,
  testConnection,
  type AIProvider,
} from "@/lib/ai-providers";
import {
  MAX_EXTRA_KEYS, MAX_KEYS_PER_PROVIDER, MAX_KEYS_PER_GROUP,
  MAX_GROUPS_PER_PROVIDER, MAX_MODULES,
  type ExtraKey, type ApiGroup, type AIModule,
} from "@/lib/multiKeyStore";
import {
  configId, getCooldowns, clearAllCooldowns, clearCooldown,
  formatRemaining, FAILURE_LABEL, type CooldownEntry,
} from "@/lib/aiFailover";
import { PageHeader } from "@/components/PageHeader";
import {
  Key, Eye, EyeOff, CheckCircle2, XCircle, Loader2,
  Zap, Brain, Sparkles, Cpu, ExternalLink, ShieldCheck, ShieldAlert,
  Plus, Trash2, Shield, ArrowDown, RotateCcw, Ban, Layers,
  FolderOpen, ChevronDown, ChevronRight, Edit2, Check, X, Globe,
  Package, Network, Settings2, Play,
} from "lucide-react";
import { toast } from "sonner";

// ── Provider icons ─────────────────────────────────────────────────────────
const ICONS: Record<AIProvider, typeof Zap> = {
  groq: Zap, openai: Brain, gemini: Sparkles, openrouter: ExternalLink, custom: Cpu,
};

// ── Tabs ───────────────────────────────────────────────────────────────────
type Tab = "providers" | "groups" | "modules";

// ══════════════════════════════════════════════════════════════════════════════
export default function AISettingsPage() {
  const {
    config, loading, updateProvider, setActiveProvider, getAllConfigs,
    extraKeys, addKey, removeKey,
    groups, createGroup, updateGroup, deleteGroup, addGroupKey, removeGroupKey,
    modules, setActiveModule, createModule, updateModule, deleteModule,
  } = useAIConfig();
  const { settings: appSettings, setAutofill, isSaving } = useAppSettings();
  const { isAdminOrAbove } = useRole();
  const location = useLocation();
  const [tab, setTab] = useState<Tab>(() =>
    location.pathname === "/setup/ai-modules" ? "modules" : "providers"
  );

  // If navigated to /setup/ai-modules, switch to modules tab
  useEffect(() => {
    if (location.pathname === "/setup/ai-modules") setTab("modules");
  }, [location.pathname]);

  if (!isAdminOrAbove) {
    return (
      <div className="space-y-6">
        <PageHeader title="AI Configuration"
          breadcrumbs={[{ label: "Setup", path: "/setup/matters" }, { label: "AI Settings" }]} />
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <ShieldAlert className="w-12 h-12 text-red-400/60 mb-4" />
          <h2 className="text-lg font-semibold">Access Restricted</h2>
          <p className="text-sm text-muted-foreground max-w-md mt-1">
            Only Super Admins and Admins can configure AI settings.
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
    <div className="space-y-5">
      <PageHeader title="AI Configuration"
        breadcrumbs={[{ label: "Setup", path: "/setup/matters" }, { label: "AI Settings" }]} />

      {/* Info banner */}
      <div className="flex items-start gap-3 rounded-xl border border-amber-400/20 bg-amber-400/5 p-4">
        <ShieldCheck className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
        <p className="text-sm text-slate-300 leading-relaxed">
          API keys are stored securely in the database and shared across <strong>all users</strong>.
          Once saved, <strong>all users instantly get access</strong> — no action needed on their side.
          Only Admins and Super Admins can modify keys.
        </p>
      </div>

      {/* Active Module Banner */}
      {config.activeModuleId && (() => {
        const mod = modules.find(m => m.id === config.activeModuleId);
        return mod ? (
          <div className="flex items-center gap-3 rounded-xl border border-violet-400/30 bg-violet-500/10 px-4 py-2.5">
            <Package className="w-4 h-4 text-violet-400 shrink-0" />
            <span className="text-sm font-medium text-violet-300">
              Active Module: <strong>{mod.name}</strong>
            </span>
            <span className="text-xs text-violet-400/70 ml-1">
              {PROVIDER_INFO[mod.provider]?.label} · {mod.model}
            </span>
            <button
              onClick={() => setActiveModule(undefined)}
              className="ml-auto text-xs text-violet-400 hover:text-violet-200 transition-colors"
            >
              Clear module
            </button>
          </div>
        ) : null;
      })()}

      {/* Failover chain status */}
      <FailoverStatusPanel configs={getAllConfigs()} />

      {/* Tab bar */}
      <div className="flex gap-1 rounded-xl border border-border bg-muted/30 p-1">
        {([ 
          { key: "providers" as Tab, icon: Key,        label: "API Providers" },
          { key: "groups"    as Tab, icon: Network,    label: "API Groups" },
          { key: "modules"   as Tab, icon: Package,    label: "AI Modules" },
        ] as const).map(({ key, icon: Icon, label }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-all ${
              tab === key
                ? "bg-background text-foreground shadow-sm border border-border"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {/* ── Tab: Providers ── */}
      {tab === "providers" && (
        <div className="grid gap-5 md:grid-cols-2">
          {(Object.keys(PROVIDER_INFO) as AIProvider[]).map((provider) => (
            <ProviderCard
              key={provider}
              provider={provider}
              entry={config.providers[provider] || { apiKey: '', model: '', enabled: false }}
              isActive={config.activeProvider === provider}
              onUpdate={(u) => updateProvider(provider, u)}
              onSetActive={() => setActiveProvider(provider)}
              extraKeys={extraKeys[provider] || []}
              onAddKey={(key) => addKey(provider, key)}
              onRemoveKey={(id) => removeKey(provider, id)}
            />
          ))}
        </div>
      )}

      {/* ── Tab: API Groups ── */}
      {tab === "groups" && (
        <ApiGroupsTab
          groups={groups}
          onCreateGroup={createGroup}
          onUpdateGroup={updateGroup}
          onDeleteGroup={deleteGroup}
          onAddKey={addGroupKey}
          onRemoveKey={removeGroupKey}
        />
      )}

      {/* ── Tab: Modules ── */}
      {tab === "modules" && (
        <ModulesTab
          modules={modules}
          groups={groups}
          activeModuleId={config.activeModuleId}
          providerModels={Object.fromEntries(
            (Object.keys(PROVIDER_INFO) as AIProvider[]).map((p) => [p, getProviderModels(p)])
          )}
          primaryKeys={Object.fromEntries(
            (Object.keys(PROVIDER_INFO) as AIProvider[]).map((p) => [p, config.providers[p]?.apiKey || ''])
          )}
          onSetActive={setActiveModule}
          onCreate={createModule}
          onUpdate={updateModule}
          onDelete={deleteModule}
        />
      )}

      {/* ── AI Autofill ── */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5 text-violet-500" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">AI Autofill</h3>
              <p className="text-xs text-muted-foreground mt-0.5 max-w-md">
                Smart suggestion card below description and notes fields.
                The AI reads what you've typed and offers a professional continuation.
              </p>
              <span className={`mt-2 inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                appSettings.autofillEnabled
                  ? "bg-violet-500/10 border-violet-400/30 text-violet-400"
                  : "bg-muted border-border text-muted-foreground"
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${appSettings.autofillEnabled ? "bg-violet-500" : "bg-muted-foreground"}`} />
                {appSettings.autofillEnabled ? "Active for all users" : "Disabled"}
              </span>
            </div>
          </div>
          <button type="button" disabled={isSaving} onClick={() => setAutofill(!appSettings.autofillEnabled)}
            className={`relative shrink-0 inline-flex h-6 w-11 items-center rounded-full border-2 transition-colors duration-200 disabled:opacity-50 ${
              appSettings.autofillEnabled ? "bg-violet-600 border-violet-600" : "bg-muted border-border"
            }`}
          >
            {isSaving
              ? <Loader2 className="w-3 h-3 text-white animate-spin absolute left-1/2 -translate-x-1/2" />
              : <span className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${appSettings.autofillEnabled ? "translate-x-5" : "translate-x-0.5"}`} />
            }
          </button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Provider Card
// ══════════════════════════════════════════════════════════════════════════════
interface CardEntry { apiKey: string; model: string; baseUrl?: string; enabled: boolean }

function ProviderCard({
  provider, entry, isActive, onUpdate, onSetActive,
  extraKeys, onAddKey, onRemoveKey,
}: {
  provider: AIProvider; entry: CardEntry; isActive: boolean;
  onUpdate: (u: Partial<CardEntry>) => void; onSetActive: () => void;
  extraKeys: ExtraKey[];
  onAddKey: (key: string) => Promise<void>;
  onRemoveKey: (id: string) => Promise<void>;
}) {
  const info   = PROVIDER_INFO[provider];
  const Icon   = ICONS[provider];
  const models = getProviderModels(provider);

  const [showKey,    setShowKey]    = useState(false);
  const [testing,    setTesting]    = useState(false);
  const [testResult, setTestResult] = useState<boolean | null>(null);

  const handleTest = async () => {
    if (!entry.apiKey) { toast.error("Enter an API key first"); return; }
    setTesting(true); setTestResult(null);
    const errMsg = await testConnection({
      provider, apiKey: entry.apiKey,
      model: entry.model || models[0]?.id || "", baseUrl: entry.baseUrl, name: provider,
    });
    const ok = errMsg === null;
    setTestResult(ok); setTesting(false);
    if (ok) {
      toast.success(`${info.label} connected!`);
      onUpdate({ enabled: true });
      onSetActive();
    } else {
      toast.error(`${info.label}: ${errMsg}`, { duration: 8000 });
    }
  };

  return (
    <div className={`relative rounded-2xl border p-5 transition-all ${
      isActive ? "border-amber-400/40 bg-amber-400/[0.04] shadow-lg shadow-amber-400/5"
               : "border-slate-700/60 bg-slate-800/40 hover:border-slate-600"
    }`}>
      {isActive && (
        <span className="absolute -top-2.5 right-4 bg-amber-400 text-[10px] font-bold text-slate-900 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
          Active
        </span>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${info.color}20` }}>
          <Icon className="w-5 h-5" style={{ color: info.color }} />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-slate-100">{info.label}</h3>
          <p className="text-[11px] text-slate-400">{info.description}</p>
        </div>
        {provider === "groq" && (
          <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer" className="text-[11px] text-slate-400 hover:text-amber-400 flex items-center gap-1 transition-colors">
            Get Key <ExternalLink className="w-3 h-3" />
          </a>
        )}
        {provider === "openai" && (
          <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer" className="text-[11px] text-slate-400 hover:text-amber-400 flex items-center gap-1 transition-colors">
            Get Key <ExternalLink className="w-3 h-3" />
          </a>
        )}
        {provider === "gemini" && (
          <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="text-[11px] text-slate-400 hover:text-amber-400 flex items-center gap-1 transition-colors">
            Get Key <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>

      {/* Primary key */}
      <label className="block mb-3">
        <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
          <Key className="w-3 h-3" /> Primary API Key
        </span>
        <div className="relative">
          <input
            type={showKey ? "text" : "password"}
            placeholder="Enter your API key…"
            value={entry.apiKey}
            onChange={(e) => { onUpdate({ apiKey: e.target.value }); setTestResult(null); }}
            className="w-full rounded-lg border border-slate-600/60 bg-slate-900/60 px-3 py-2 pr-10 text-sm text-slate-200 placeholder:text-slate-500 focus:border-amber-400/50 focus:outline-none transition-colors"
          />
          <button type="button" onClick={() => setShowKey((v) => !v)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
            {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </label>

      <ExtraKeysSection
        provider={provider} primaryKey={entry.apiKey}
        extraKeys={extraKeys} onAdd={onAddKey} onRemove={onRemoveKey}
      />

      {provider === "custom" && (
        <label className="block mb-3">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-1.5 block">Base URL</span>
          <input type="text" placeholder="https://your-api.example.com/v1"
            value={entry.baseUrl || ""}
            onChange={(e) => onUpdate({ baseUrl: e.target.value })}
            className="w-full rounded-lg border border-slate-600/60 bg-slate-900/60 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-amber-400/50 focus:outline-none transition-colors"
          />
        </label>
      )}

      <label className="block mb-4">
        <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-1.5 block">Model</span>
        {models.length > 0 ? (
          <select value={entry.model} onChange={(e) => onUpdate({ model: e.target.value })}
            className="w-full rounded-lg border border-slate-600/60 bg-slate-900/60 px-3 py-2 text-sm text-slate-200 focus:border-amber-400/50 focus:outline-none transition-colors">
            {models.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        ) : (
          <input type="text" placeholder="e.g. my-custom-model" value={entry.model}
            onChange={(e) => onUpdate({ model: e.target.value })}
            className="w-full rounded-lg border border-slate-600/60 bg-slate-900/60 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-amber-400/50 focus:outline-none transition-colors"
          />
        )}
      </label>

      <div className="flex gap-2">
        <button onClick={handleTest} disabled={testing || !entry.apiKey}
          className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-slate-600/50 bg-slate-700/40 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-700/70 disabled:opacity-40 transition-colors">
          {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : testResult === true  ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            : testResult === false ? <XCircle className="w-3.5 h-3.5 text-red-400" />
            : <Zap className="w-3.5 h-3.5" />}
          Test Connection
        </button>
        {!isActive && entry.apiKey && (
          <button onClick={onSetActive}
            className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-amber-400/90 px-3 py-2 text-xs font-bold text-slate-900 hover:bg-amber-400 transition-colors">
            Set Active
          </button>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// API Groups Tab
// ══════════════════════════════════════════════════════════════════════════════
function ApiGroupsTab({
  groups, onCreateGroup, onUpdateGroup, onDeleteGroup, onAddKey, onRemoveKey,
}: {
  groups: ApiGroup[];
  onCreateGroup: (provider: AIProvider, name: string, notes?: string) => Promise<void>;
  onUpdateGroup: (id: string, patch: Partial<Pick<ApiGroup, 'name' | 'notes'>>) => Promise<void>;
  onDeleteGroup: (id: string) => Promise<void>;
  onAddKey: (groupId: string, key: string, label?: string) => Promise<void>;
  onRemoveKey: (groupId: string, keyId: string) => Promise<void>;
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [newGroupProvider, setNewGroupProvider] = useState<AIProvider>("groq");
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupNotes, setNewGroupNotes] = useState("");
  const [creating, setCreating] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (id: string) => setExpanded((s) => {
    const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n;
  });

  const handleCreate = async () => {
    if (!newGroupName.trim()) return;
    setCreating(true);
    try {
      await onCreateGroup(newGroupProvider, newGroupName.trim(), newGroupNotes.trim() || undefined);
      toast.success(`API Group "${newGroupName}" created`);
      setNewGroupName(""); setNewGroupNotes(""); setShowCreate(false);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setCreating(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">API Groups</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Organise multiple API keys into named groups. Assign a group to a Module for auto-failover within the group.
          </p>
        </div>
        <button onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-1.5 rounded-lg bg-amber-400/90 px-3 py-1.5 text-xs font-bold text-slate-900 hover:bg-amber-400 transition-colors">
          <Plus className="w-3.5 h-3.5" /> New Group
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <h4 className="text-sm font-semibold">New API Group</h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-muted-foreground uppercase tracking-wider block mb-1">Provider</label>
              <select value={newGroupProvider} onChange={(e) => setNewGroupProvider(e.target.value as AIProvider)}
                className="w-full rounded-lg border border-border bg-muted/50 px-3 py-1.5 text-sm focus:outline-none focus:border-amber-400/50">
                {(Object.keys(PROVIDER_INFO) as AIProvider[]).map((p) => (
                  <option key={p} value={p}>{PROVIDER_INFO[p].label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground uppercase tracking-wider block mb-1">Group Name *</label>
              <input type="text" placeholder="e.g. Production Keys"
                value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)}
                className="w-full rounded-lg border border-border bg-muted/50 px-3 py-1.5 text-sm focus:outline-none focus:border-amber-400/50"
              />
            </div>
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground uppercase tracking-wider block mb-1">Notes (optional)</label>
            <input type="text" placeholder="e.g. Paid plan, 40 RPM limit"
              value={newGroupNotes} onChange={(e) => setNewGroupNotes(e.target.value)}
              className="w-full rounded-lg border border-border bg-muted/50 px-3 py-1.5 text-sm focus:outline-none focus:border-amber-400/50"
            />
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowCreate(false)} className="flex-1 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
            <button onClick={handleCreate} disabled={!newGroupName.trim() || creating}
              className="flex-1 rounded-lg bg-amber-400/90 px-3 py-1.5 text-xs font-bold text-slate-900 hover:bg-amber-400 disabled:opacity-40 transition-colors">
              {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin mx-auto" /> : "Create Group"}
            </button>
          </div>
        </div>
      )}

      {groups.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center rounded-xl border border-dashed border-border">
          <Network className="w-8 h-8 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">No API groups yet</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Groups let you bundle multiple keys for one provider and auto-failover between them.</p>
        </div>
      )}

      {/* Group list */}
      {groups.map((group) => (
        <ApiGroupCard
          key={group.id}
          group={group}
          expanded={expanded.has(group.id)}
          onToggle={() => toggle(group.id)}
          onUpdate={onUpdateGroup}
          onDelete={onDeleteGroup}
          onAddKey={onAddKey}
          onRemoveKey={onRemoveKey}
        />
      ))}
    </div>
  );
}

function ApiGroupCard({
  group, expanded, onToggle, onUpdate, onDelete, onAddKey, onRemoveKey,
}: {
  group: ApiGroup; expanded: boolean;
  onToggle: () => void;
  onUpdate: (id: string, patch: Partial<Pick<ApiGroup, 'name' | 'notes'>>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onAddKey: (groupId: string, key: string, label?: string) => Promise<void>;
  onRemoveKey: (groupId: string, keyId: string) => Promise<void>;
}) {
  const info = PROVIDER_INFO[group.provider];
  const Icon = ICONS[group.provider];

  const [editing,  setEditing]  = useState(false);
  const [editName, setEditName] = useState(group.name);
  const [editNotes, setEditNotes] = useState(group.notes || "");
  const [newKey,   setNewKey]   = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [showAddKey, setShowAddKey] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showKeys, setShowKeys] = useState<Set<string>>(new Set());

  const handleSave = async () => {
    setBusy(true);
    try {
      await onUpdate(group.id, { name: editName.trim(), notes: editNotes.trim() || undefined });
      setEditing(false);
      toast.success("Group updated");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete group "${group.name}" and all its keys?`)) return;
    setBusy(true);
    try { await onDelete(group.id); toast.success("Group deleted"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  };

  const handleAddKey = async () => {
    if (!newKey.trim()) return;
    setBusy(true);
    try {
      await onAddKey(group.id, newKey.trim(), newLabel.trim() || undefined);
      setNewKey(""); setNewLabel(""); setShowAddKey(false);
      toast.success("Key added to group");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  };

  const handleRemoveKey = async (keyId: string) => {
    setBusy(true);
    try { await onRemoveKey(group.id, keyId); toast.success("Key removed"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  };

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 cursor-pointer select-none" onClick={onToggle}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${info.color}20` }}>
          <Icon className="w-4 h-4" style={{ color: info.color }} />
        </div>
        {editing ? (
          <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 rounded border border-border bg-muted/50 px-2 py-1 text-sm focus:outline-none"
          />
        ) : (
          <div className="flex-1 min-w-0">
            <span className="text-sm font-semibold">{group.name}</span>
            {group.notes && <span className="text-[11px] text-muted-foreground ml-2">{group.notes}</span>}
          </div>
        )}
        <span className="text-[11px] text-muted-foreground shrink-0">{info.label} · {group.keys.length}/{MAX_KEYS_PER_GROUP} keys</span>

        {editing ? (
          <div className="flex gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
            <input type="text" placeholder="Notes..." value={editNotes} onChange={(e) => setEditNotes(e.target.value)}
              className="rounded border border-border bg-muted/50 px-2 py-1 text-xs w-32 focus:outline-none" />
            <button onClick={handleSave} disabled={busy} className="p-1 rounded hover:bg-emerald-500/10 text-emerald-500 transition-colors">
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            </button>
            <button onClick={() => setEditing(false)} className="p-1 rounded hover:bg-muted text-muted-foreground transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setEditing(true)} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button onClick={handleDelete} disabled={busy} className="p-1 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
      </div>

      {/* Expanded body */}
      {expanded && (
        <div className="border-t border-border px-4 pb-4 pt-3 space-y-2">
          {/* Slot pips */}
          <div className="flex gap-1 mb-3">
            {Array.from({ length: MAX_KEYS_PER_GROUP }).map((_, i) => (
              <span key={i} className={`h-1 flex-1 rounded-full ${i < group.keys.length ? "bg-emerald-500/70" : "bg-muted/60"}`} />
            ))}
          </div>

          {group.keys.length === 0 && (
            <p className="text-xs text-muted-foreground italic text-center py-2">No keys yet — add one below.</p>
          )}

          {group.keys.map((gk, i) => {
            const shown = showKeys.has(gk.id);
            return (
              <div key={gk.id} className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
                <span className="text-[10px] font-mono text-muted-foreground w-4 shrink-0">{i + 1}</span>
                <Key className="w-3 h-3 text-muted-foreground/60 shrink-0" />
                <span className="text-xs font-mono flex-1 truncate text-foreground">
                  {shown ? gk.key : `${gk.key.slice(0, 8)}...${gk.key.slice(-4)}`}
                </span>
                <span className="text-[10px] text-muted-foreground shrink-0">{gk.label}</span>
                <button onClick={() => setShowKeys((s) => { const n = new Set(s); shown ? n.delete(gk.id) : n.add(gk.id); return n; })}
                  className="text-muted-foreground hover:text-foreground transition-colors">
                  {shown ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                </button>
                <button onClick={() => handleRemoveKey(gk.id)} disabled={busy}
                  className="text-muted-foreground hover:text-red-400 disabled:opacity-40 transition-colors">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            );
          })}

          {group.keys.length < MAX_KEYS_PER_GROUP && (
            <>
              {showAddKey ? (
                <div className="flex gap-2 pt-1">
                  <input type="text" placeholder={`Paste ${info.label} API key...`}
                    value={newKey} onChange={(e) => setNewKey(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddKey()}
                    className="flex-1 rounded-lg border border-border bg-muted/50 px-2.5 py-1.5 text-xs focus:outline-none focus:border-amber-400/50"
                  />
                  <input type="text" placeholder="Label (optional)"
                    value={newLabel} onChange={(e) => setNewLabel(e.target.value)}
                    className="w-28 rounded-lg border border-border bg-muted/50 px-2.5 py-1.5 text-xs focus:outline-none focus:border-amber-400/50"
                  />
                  <button onClick={handleAddKey} disabled={!newKey.trim() || busy}
                    className="px-3 py-1.5 rounded-lg bg-amber-400/90 text-xs font-bold text-slate-900 hover:bg-amber-400 disabled:opacity-40 transition-colors">
                    {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : "Add"}
                  </button>
                  <button onClick={() => setShowAddKey(false)} className="px-2 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground transition-colors">
                    Cancel
                  </button>
                </div>
              ) : (
                <button onClick={() => setShowAddKey(true)}
                  className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-1.5 text-xs text-muted-foreground hover:text-foreground hover:border-amber-400/40 transition-colors">
                  <Plus className="w-3.5 h-3.5" /> Add Key to Group
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// AI Modules Tab
// ══════════════════════════════════════════════════════════════════════════════
function ModulesTab({
  modules, groups, activeModuleId, providerModels, primaryKeys,
  onSetActive, onCreate, onUpdate, onDelete,
}: {
  modules: AIModule[];
  groups: ApiGroup[];
  activeModuleId?: string;
  providerModels: Record<string, { id: string; name: string }[]>;
  primaryKeys: Record<string, string>;
  onSetActive: (id: string | undefined) => void;
  onCreate: (name: string, provider: AIProvider, model: string, opts?: Parameters<typeof import("@/lib/multiKeyStore").createAIModule>[3]) => Promise<void>;
  onUpdate: (id: string, patch: Parameters<typeof import("@/lib/multiKeyStore").updateAIModule>[1]) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<{
    name: string; description: string; provider: AIProvider; model: string; groupId: string;
    fallbackProvider: AIProvider | ""; fallbackModel: string; fallbackGroupId: string;
  }>({ name: "", description: "", provider: "groq", model: "groq/compound", groupId: "", fallbackProvider: "", fallbackModel: "", fallbackGroupId: "" });
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    setCreating(true);
    try {
      await onCreate(form.name.trim(), form.provider, form.model, {
        description:       form.description.trim() || undefined,
        groupId:           form.groupId || undefined,
        fallbackProvider:  form.fallbackProvider as AIProvider || undefined,
        fallbackModel:     form.fallbackModel || undefined,
        fallbackGroupId:   form.fallbackGroupId || undefined,
      });
      toast.success(`Module "${form.name}" created`);
      setForm({ name: "", description: "", provider: "groq", model: "groq/compound", groupId: "", fallbackProvider: "", fallbackModel: "", fallbackGroupId: "" });
      setShowCreate(false);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setCreating(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">AI Modules</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Named AI profiles — each picks a provider, model, and optional API group. Switch modules to instantly change how the AI Agent behaves.
          </p>
        </div>
        <button onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-1.5 rounded-lg bg-amber-400/90 px-3 py-1.5 text-xs font-bold text-slate-900 hover:bg-amber-400 transition-colors">
          <Plus className="w-3.5 h-3.5" /> New Module
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <Package className="w-4 h-4 text-violet-400" /> New AI Module
          </h4>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-[11px] text-muted-foreground uppercase tracking-wider block mb-1">Module Name *</label>
              <input type="text" placeholder="e.g. Legal Drafting"
                value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full rounded-lg border border-border bg-muted/50 px-3 py-1.5 text-sm focus:outline-none focus:border-amber-400/50"
              />
            </div>
            <div className="col-span-2">
              <label className="text-[11px] text-muted-foreground uppercase tracking-wider block mb-1">Description (optional)</label>
              <input type="text" placeholder="e.g. Uses GPT-4o for precise legal language"
                value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                className="w-full rounded-lg border border-border bg-muted/50 px-3 py-1.5 text-sm focus:outline-none focus:border-amber-400/50"
              />
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground uppercase tracking-wider block mb-1">Primary Provider</label>
              <select value={form.provider} onChange={(e) => {
                  const p = e.target.value as AIProvider;
                  setForm(f => ({ ...f, provider: p, model: providerModels[p]?.[0]?.id || '', groupId: '' }));
                }}
                className="w-full rounded-lg border border-border bg-muted/50 px-3 py-1.5 text-sm focus:outline-none focus:border-amber-400/50">
                {(Object.keys(PROVIDER_INFO) as AIProvider[]).map((p) => (
                  <option key={p} value={p}>{PROVIDER_INFO[p].label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground uppercase tracking-wider block mb-1">Model</label>
              {(providerModels[form.provider] || []).length > 0 ? (
                <select value={form.model} onChange={(e) => setForm(f => ({ ...f, model: e.target.value }))}
                  className="w-full rounded-lg border border-border bg-muted/50 px-3 py-1.5 text-sm focus:outline-none focus:border-amber-400/50">
                  {(providerModels[form.provider] || []).map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              ) : (
                <input type="text" placeholder="Model ID" value={form.model}
                  onChange={(e) => setForm(f => ({ ...f, model: e.target.value }))}
                  className="w-full rounded-lg border border-border bg-muted/50 px-3 py-1.5 text-sm focus:outline-none" />
              )}
            </div>
            <div className="col-span-2">
              <label className="text-[11px] text-muted-foreground uppercase tracking-wider block mb-1">API Group (optional)</label>
              <select value={form.groupId} onChange={(e) => setForm(f => ({ ...f, groupId: e.target.value }))}
                className="w-full rounded-lg border border-border bg-muted/50 px-3 py-1.5 text-sm focus:outline-none focus:border-amber-400/50">
                <option value="">— Use primary key pool —</option>
                {groups.filter((g) => g.provider === form.provider).map((g) => (
                  <option key={g.id} value={g.id}>{g.name} ({g.keys.length} keys)</option>
                ))}
              </select>
            </div>
          </div>

          {/* Fallback section */}
          <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-3">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Fallback (if primary fails)</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-muted-foreground block mb-1">Fallback Provider</label>
                <select value={form.fallbackProvider}
                  onChange={(e) => {
                    const p = e.target.value as AIProvider | "";
                    setForm(f => ({ ...f, fallbackProvider: p, fallbackModel: p ? (providerModels[p]?.[0]?.id || '') : '', fallbackGroupId: '' }));
                  }}
                  className="w-full rounded-lg border border-border bg-muted/50 px-3 py-1.5 text-sm focus:outline-none focus:border-amber-400/50">
                  <option value="">— None —</option>
                  {(Object.keys(PROVIDER_INFO) as AIProvider[]).filter((p) => p !== form.provider).map((p) => (
                    <option key={p} value={p}>{PROVIDER_INFO[p].label}</option>
                  ))}
                </select>
              </div>
              {form.fallbackProvider && (
                <div>
                  <label className="text-[11px] text-muted-foreground block mb-1">Fallback Model</label>
                  {(providerModels[form.fallbackProvider] || []).length > 0 ? (
                    <select value={form.fallbackModel} onChange={(e) => setForm(f => ({ ...f, fallbackModel: e.target.value }))}
                      className="w-full rounded-lg border border-border bg-muted/50 px-3 py-1.5 text-sm focus:outline-none focus:border-amber-400/50">
                      {(providerModels[form.fallbackProvider] || []).map((m) => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                  ) : (
                    <input type="text" placeholder="Model ID" value={form.fallbackModel}
                      onChange={(e) => setForm(f => ({ ...f, fallbackModel: e.target.value }))}
                      className="w-full rounded-lg border border-border bg-muted/50 px-3 py-1.5 text-sm focus:outline-none" />
                  )}
                </div>
              )}
              {form.fallbackProvider && (
                <div className="col-span-2">
                  <label className="text-[11px] text-muted-foreground block mb-1">Fallback API Group</label>
                  <select value={form.fallbackGroupId} onChange={(e) => setForm(f => ({ ...f, fallbackGroupId: e.target.value }))}
                    className="w-full rounded-lg border border-border bg-muted/50 px-3 py-1.5 text-sm focus:outline-none focus:border-amber-400/50">
                    <option value="">— Use primary key pool —</option>
                    {groups.filter((g) => g.provider === form.fallbackProvider).map((g) => (
                      <option key={g.id} value={g.id}>{g.name} ({g.keys.length} keys)</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={() => setShowCreate(false)} className="flex-1 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
            <button onClick={handleCreate} disabled={!form.name.trim() || creating}
              className="flex-1 rounded-lg bg-amber-400/90 px-3 py-1.5 text-xs font-bold text-slate-900 hover:bg-amber-400 disabled:opacity-40 transition-colors">
              {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin mx-auto" /> : "Create Module"}
            </button>
          </div>
        </div>
      )}

      {modules.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center rounded-xl border border-dashed border-border">
          <Package className="w-8 h-8 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">No modules yet</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Create a module to quickly switch AI behaviour — e.g. one for drafting, one for research.</p>
        </div>
      )}

      {/* Module list */}
      <div className="grid gap-3 md:grid-cols-2">
        {modules.map((mod) => (
          <ModuleCard
            key={mod.id}
            mod={mod}
            isActive={activeModuleId === mod.id}
            groups={groups}
            providerModels={providerModels}
            onSetActive={() => onSetActive(activeModuleId === mod.id ? undefined : mod.id)}
            onUpdate={onUpdate}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  );
}

function ModuleCard({
  mod, isActive, groups, providerModels, onSetActive, onUpdate, onDelete,
}: {
  mod: AIModule; isActive: boolean; groups: ApiGroup[];
  providerModels: Record<string, { id: string; name: string }[]>;
  onSetActive: () => void;
  onUpdate: (id: string, patch: Parameters<typeof import("@/lib/multiKeyStore").updateAIModule>[1]) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(mod.name);
  const [editDesc, setEditDesc] = useState(mod.description || "");
  const [editProvider, setEditProvider] = useState<AIProvider>(mod.provider);
  const [editModel, setEditModel] = useState(mod.model);
  const [editGroupId, setEditGroupId] = useState(mod.groupId || "");
  const [editFbProvider, setEditFbProvider] = useState<AIProvider | "">(mod.fallbackProvider || "");
  const [editFbModel, setEditFbModel] = useState(mod.fallbackModel || "");
  const [editFbGroupId, setEditFbGroupId] = useState(mod.fallbackGroupId || "");
  const [busy, setBusy] = useState(false);

  const info = PROVIDER_INFO[mod.provider];
  const Icon = ICONS[mod.provider];
  const group = mod.groupId ? groups.find((g) => g.id === mod.groupId) : undefined;
  const fbInfo = mod.fallbackProvider ? PROVIDER_INFO[mod.fallbackProvider] : undefined;
  const fbGroup = mod.fallbackGroupId ? groups.find((g) => g.id === mod.fallbackGroupId) : undefined;

  const handleSave = async () => {
    setBusy(true);
    try {
      await onUpdate(mod.id, {
        name:             editName.trim(),
        description:      editDesc.trim() || undefined,
        provider:         editProvider,
        model:            editModel,
        groupId:          editGroupId || undefined,
        fallbackProvider: editFbProvider as AIProvider || undefined,
        fallbackModel:    editFbModel || undefined,
        fallbackGroupId:  editFbGroupId || undefined,
      });
      setEditing(false);
      toast.success("Module updated");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete module "${mod.name}"?`)) return;
    setBusy(true);
    try { await onDelete(mod.id); toast.success("Module deleted"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  };

  if (editing) {
    return (
      <div className="rounded-xl border border-violet-400/30 bg-card p-4 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="col-span-2">
            <label className="text-[11px] text-muted-foreground block mb-0.5">Name</label>
            <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)}
              className="w-full rounded-lg border border-border bg-muted/50 px-2.5 py-1.5 text-sm focus:outline-none" />
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground block mb-0.5">Provider</label>
            <select value={editProvider} onChange={(e) => {
                const p = e.target.value as AIProvider;
                setEditProvider(p); setEditModel(providerModels[p]?.[0]?.id || ''); setEditGroupId('');
              }}
              className="w-full rounded-lg border border-border bg-muted/50 px-2.5 py-1.5 text-sm focus:outline-none">
              {(Object.keys(PROVIDER_INFO) as AIProvider[]).map((p) => <option key={p} value={p}>{PROVIDER_INFO[p].label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground block mb-0.5">Model</label>
            {(providerModels[editProvider] || []).length > 0 ? (
              <select value={editModel} onChange={(e) => setEditModel(e.target.value)}
                className="w-full rounded-lg border border-border bg-muted/50 px-2.5 py-1.5 text-sm focus:outline-none">
                {(providerModels[editProvider] || []).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            ) : (
              <input type="text" value={editModel} onChange={(e) => setEditModel(e.target.value)}
                className="w-full rounded-lg border border-border bg-muted/50 px-2.5 py-1.5 text-sm focus:outline-none" />
            )}
          </div>
          <div className="col-span-2">
            <label className="text-[11px] text-muted-foreground block mb-0.5">API Group</label>
            <select value={editGroupId} onChange={(e) => setEditGroupId(e.target.value)}
              className="w-full rounded-lg border border-border bg-muted/50 px-2.5 py-1.5 text-sm focus:outline-none">
              <option value="">— Use primary key pool —</option>
              {groups.filter((g) => g.provider === editProvider).map((g) => (
                <option key={g.id} value={g.id}>{g.name} ({g.keys.length} keys)</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground block mb-0.5">Fallback Provider</label>
            <select value={editFbProvider}
              onChange={(e) => { const p = e.target.value as AIProvider | ""; setEditFbProvider(p); setEditFbModel(p ? (providerModels[p]?.[0]?.id || '') : ''); setEditFbGroupId(''); }}
              className="w-full rounded-lg border border-border bg-muted/50 px-2.5 py-1.5 text-sm focus:outline-none">
              <option value="">— None —</option>
              {(Object.keys(PROVIDER_INFO) as AIProvider[]).filter((p) => p !== editProvider).map((p) => <option key={p} value={p}>{PROVIDER_INFO[p].label}</option>)}
            </select>
          </div>
          {editFbProvider && (
            <div>
              <label className="text-[11px] text-muted-foreground block mb-0.5">Fallback Model</label>
              {(providerModels[editFbProvider] || []).length > 0 ? (
                <select value={editFbModel} onChange={(e) => setEditFbModel(e.target.value)}
                  className="w-full rounded-lg border border-border bg-muted/50 px-2.5 py-1.5 text-sm focus:outline-none">
                  {(providerModels[editFbProvider] || []).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              ) : (
                <input type="text" value={editFbModel} onChange={(e) => setEditFbModel(e.target.value)}
                  className="w-full rounded-lg border border-border bg-muted/50 px-2.5 py-1.5 text-sm focus:outline-none" />
              )}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={() => setEditing(false)} className="flex-1 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={busy || !editName.trim()}
            className="flex-1 rounded-lg bg-amber-400/90 px-3 py-1.5 text-xs font-bold text-slate-900 hover:bg-amber-400 disabled:opacity-40 transition-colors">
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin mx-auto" /> : "Save"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border p-4 transition-all ${
      isActive ? "border-violet-400/40 bg-violet-500/[0.06] shadow-sm" : "border-border bg-card hover:border-border/80"
    }`}>
      {isActive && (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-violet-300 bg-violet-500/20 border border-violet-400/30 px-2 py-0.5 rounded-full mb-2">
          <Play className="w-2.5 h-2.5" /> Active Module
        </span>
      )}

      <div className="flex items-start gap-2 mb-2">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ backgroundColor: `${info.color}20` }}>
          <Icon className="w-4 h-4" style={{ color: info.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold truncate">{mod.name}</h4>
          {mod.description && <p className="text-[11px] text-muted-foreground truncate">{mod.description}</p>}
        </div>
        <div className="flex gap-1 shrink-0">
          <button onClick={() => setEditing(true)} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={handleDelete} disabled={busy} className="p-1 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Primary config */}
      <div className="space-y-1 mb-3">
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-muted-foreground">Provider:</span>
          <span className="font-medium">{info.label}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-muted-foreground">Model:</span>
          <span className="font-mono text-[11px] truncate">{mod.model}</span>
        </div>
        {group && (
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-muted-foreground">Group:</span>
            <span className="font-medium text-emerald-600 dark:text-emerald-400">{group.name}</span>
            <span className="text-muted-foreground">({group.keys.length} keys)</span>
          </div>
        )}
      </div>

      {/* Fallback chain */}
      {fbInfo && (
        <div className="rounded-lg border border-border bg-muted/20 px-3 py-2 mb-3">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Fallback</p>
          <div className="flex items-center gap-1.5 text-xs">
            <ArrowDown className="w-3 h-3 text-muted-foreground/50" />
            <span className="font-medium">{fbInfo.label}</span>
            <span className="text-muted-foreground font-mono text-[11px] truncate">{mod.fallbackModel}</span>
            {fbGroup && <span className="text-emerald-600 dark:text-emerald-400">({fbGroup.name})</span>}
          </div>
        </div>
      )}

      <button onClick={onSetActive}
        className={`w-full rounded-lg py-1.5 text-xs font-bold transition-colors ${
          isActive
            ? "bg-violet-500/20 text-violet-300 hover:bg-violet-500/30 border border-violet-400/30"
            : "bg-amber-400/90 text-slate-900 hover:bg-amber-400"
        }`}>
        {isActive ? "Deactivate Module" : "Activate Module"}
      </button>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Failover Chain Status
// ══════════════════════════════════════════════════════════════════════════════
interface ChainConfig { provider: AIProvider; apiKey: string; model: string; name: string }

function FailoverStatusPanel({ configs }: { configs: ChainConfig[] }) {
  const [, setTick] = useState(0);
  const [cooldowns, setCooldowns] = useState<CooldownEntry[]>(getCooldowns);

  useEffect(() => {
    const t = setInterval(() => { setCooldowns(getCooldowns()); setTick((n) => n + 1); }, 1000);
    return () => clearInterval(t);
  }, []);

  const byId = new Map(cooldowns.map((c) => [c.id, c]));
  const rows = configs.map((c) => {
    const id = configId(c);
    const cd = byId.get(id);
    return { id, name: c.name, model: c.model, provider: c.provider, remaining: cd ? Math.max(0, cd.until - Date.now()) : 0, kind: cd?.kind, reason: cd?.reason };
  });

  const ready   = rows.filter((r) => r.remaining === 0);
  const resting = rows.filter((r) => r.remaining > 0);

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
            <Shield className="w-5 h-5 text-emerald-500" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">Failover Chain</h3>
            <p className="text-xs text-muted-foreground mt-0.5 max-w-lg">
              Every request walks this list top-to-bottom. Rate limited or failed keys are skipped automatically — users never see an error.
            </p>
          </div>
        </div>
        {resting.length > 0 && (
          <button onClick={() => { clearAllCooldowns(); setCooldowns([]); toast.success("All cooldowns cleared"); }}
            className="shrink-0 flex items-center gap-1.5 rounded-lg border border-border bg-muted/50 px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors">
            <RotateCcw className="w-3 h-3" /> Reset cooldowns
          </button>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="flex items-center gap-2 rounded-lg border border-dashed border-border px-3 py-4 text-xs text-muted-foreground">
          <Ban className="w-4 h-4 shrink-0" /> No API keys configured yet.
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 mb-3 text-[11px]">
            <span className="inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-400/30 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-3 h-3" /> {ready.length} ready
            </span>
            {resting.length > 0 && (
              <span className="inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-400/30 text-amber-600 dark:text-amber-400">
                <Loader2 className="w-3 h-3 animate-spin" /> {resting.length} resting
              </span>
            )}
          </div>
          <div className="space-y-1">
            {rows.map((r, i) => (
              <div key={r.id}>
                {i > 0 && <div className="flex justify-center py-0.5"><ArrowDown className="w-3 h-3 text-muted-foreground/40" /></div>}
                <div className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border ${r.remaining > 0 ? "border-amber-400/25 bg-amber-400/5" : "border-border bg-muted/30"}`}>
                  <span className="text-[10px] font-mono text-muted-foreground w-4 shrink-0">{i + 1}</span>
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${r.remaining > 0 ? "bg-amber-500" : "bg-emerald-500"}`} />
                  <span className="text-xs font-semibold shrink-0">{r.name}</span>
                  <span className="text-[11px] text-muted-foreground font-mono truncate flex-1">{r.model}</span>
                  {r.remaining > 0 ? (
                    <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 shrink-0" title={r.reason}>
                      {r.kind ? FAILURE_LABEL[r.kind] : "Resting"} · back in {formatRemaining(r.remaining)}
                    </span>
                  ) : (
                    <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 shrink-0">Ready</span>
                  )}
                  {r.remaining > 0 && (
                    <button onClick={() => { clearCooldown(r.id); setCooldowns(getCooldowns()); }}
                      className="text-muted-foreground hover:text-foreground transition-colors shrink-0">
                      <RotateCcw className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Extra Keys (per-provider pool)
// ══════════════════════════════════════════════════════════════════════════════
function ExtraKeysSection({ provider, primaryKey, extraKeys, onAdd, onRemove }: {
  provider: AIProvider; primaryKey: string; extraKeys: ExtraKey[];
  onAdd: (key: string) => Promise<void>; onRemove: (id: string) => Promise<void>;
}) {
  const [newKey, setNewKey] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [busy, setBusy] = useState(false);

  const used = (primaryKey ? 1 : 0) + extraKeys.length;
  const full = extraKeys.length >= MAX_EXTRA_KEYS;

  const handleAdd = async () => {
    const key = newKey.trim();
    if (!key || busy) return;
    setBusy(true);
    try {
      await onAdd(key);
      setNewKey(""); setShowAdd(false);
      toast.success(`Key added — ${PROVIDER_INFO[provider].label} now rotates ${used + 1} keys`);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not add key"); }
    finally { setBusy(false); }
  };

  const handleRemove = async (id: string) => {
    setBusy(true);
    try { await onRemove(id); toast.success("Key removed"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Could not remove key"); }
    finally { setBusy(false); }
  };

  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider flex items-center gap-1">
          <Shield className="w-3 h-3" /> Key Pool ({used}/{MAX_KEYS_PER_PROVIDER})
        </span>
        {!full && (
          <button onClick={() => setShowAdd(!showAdd)} className="text-[10px] text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-0.5">
            <Plus className="w-3 h-3" /> Add Key
          </button>
        )}
      </div>
      <div className="flex gap-1 mb-2">
        {Array.from({ length: MAX_KEYS_PER_PROVIDER }).map((_, i) => (
          <span key={i} className={`h-1 flex-1 rounded-full ${i < used ? "bg-emerald-500/70" : "bg-slate-700/60"}`} />
        ))}
      </div>
      {primaryKey && (
        <div className="flex items-center gap-2 px-2 py-1.5 mb-1 rounded-md bg-slate-800/40 border border-slate-700/30">
          <Key className="w-3 h-3 text-emerald-500/70 shrink-0" />
          <span className="text-[11px] text-slate-300 font-mono flex-1 truncate">{primaryKey.slice(0, 8)}...{primaryKey.slice(-4)}</span>
          <span className="text-[9px] text-slate-500">primary</span>
        </div>
      )}
      {extraKeys.length > 0 && (
        <div className="space-y-1 mb-2">
          {extraKeys.map((ek, i) => (
            <div key={ek.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-slate-800/60 border border-slate-700/40">
              <Key className="w-3 h-3 text-slate-500 shrink-0" />
              <span className="text-[11px] text-slate-300 font-mono flex-1 truncate">{ek.key.slice(0, 8)}...{ek.key.slice(-4)}</span>
              <span className="text-[9px] text-slate-500">#{i + 2}</span>
              <button onClick={() => handleRemove(ek.id)} disabled={busy} className="text-slate-500 hover:text-red-400 disabled:opacity-40 transition-colors">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      {showAdd && !full && (
        <div className="flex gap-2 mb-2">
          <input type="text" placeholder={`Paste another ${PROVIDER_INFO[provider].label} API key...`}
            value={newKey} onChange={(e) => setNewKey(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
            className="flex-1 rounded-md border border-slate-600/60 bg-slate-900/60 px-2.5 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:border-amber-400/50 focus:outline-none"
          />
          <button onClick={handleAdd} disabled={!newKey.trim() || busy}
            className="px-3 py-1.5 rounded-md bg-amber-400/90 text-[11px] font-bold text-slate-900 hover:bg-amber-400 disabled:opacity-40 transition-colors">
            {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : "Add"}
          </button>
        </div>
      )}
      {full && <p className="text-[10px] text-slate-500 italic">Pool is full ({MAX_KEYS_PER_PROVIDER} keys). Remove one to add another.</p>}
      {used <= 1 && !showAdd && (
        <p className="text-[10px] text-slate-600 italic">Add more keys — requests rotate across all keys, sharing the rate-limit load.</p>
      )}
    </div>
  );
}
