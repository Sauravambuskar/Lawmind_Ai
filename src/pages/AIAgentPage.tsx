import { useState, useRef, useEffect, useCallback, type FormEvent } from "react";
import { useAIConfig } from "@/hooks/useAIConfig";
import { useRole } from "@/hooks/useRole";
import { useAuth } from "@/hooks/useAuth";
import { sendAIMessageWithFailover, PROVIDER_INFO, type AIMessage } from "@/lib/ai-providers";
import { buildDataContext, getSystemPrompt } from "@/lib/ai-data-context";
import { Link } from "react-router-dom";
import {
  Send, Loader2, User, Database,
  FileText, BarChart3, Search, Settings,
  Copy, Check, Trash2, Mic, MicOff, Share2, MessageCircle, Mail, Download
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { jsPDF } from "jspdf";
import { toast } from "sonner";
const aiBotGif = "https://static.naukimg.com/s/0/0/i/job-agent/pwa/v0/agent_icon.gif";

interface ChatMsg {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  model?: string;
  tokens?: number;
}

const SUGGESTIONS = [
  { icon: Search,   label: "Show all pending cases",        prompt: "Show me all pending cases with their details" },
  { icon: BarChart3,label: "Financial summary report",       prompt: "Generate a financial summary report including invoices and expenses" },
  { icon: FileText, label: "Upcoming hearings",              prompt: "List all upcoming hearings with dates, courts, and judges" },
  { icon: Database, label: "Client overview",                prompt: "Give me an overview of all clients in the system" },
];

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Afternoon";
  return "Good Evening";
}

/* ═══════════════════════════ Page ═══════════════════════════ */

export default function AIAgentPage() {
  const { config, loading: configLoading, getActiveConfig, getAllConfigs, hasActiveKey } = useAIConfig();
  const { isAdminOrAbove } = useRole();
  const { profile } = useAuth();

  const [messages, setMessages]     = useState<ChatMsg[]>([]);
  const [input, setInput]           = useState("");
  const [loading, setLoading]       = useState(false);
  const [includeData, setIncludeData] = useState(true);
  const [copiedId, setCopiedId]     = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSend = useCallback(async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;
    if (!hasActiveKey) { toast.error("Configure an API key in AI Settings first"); return; }

    setMessages((p) => [...p, { id: crypto.randomUUID(), role: "user", content: msg, timestamp: new Date() }]);
    setInput("");
    setLoading(true);

    try {
      let systemContent = "You are LawMind AI, a helpful legal practice management assistant. Answer clearly using Markdown formatting.";
      if (includeData) {
        const ctx = await buildDataContext(msg);
        systemContent = getSystemPrompt(ctx);
      }

      const history: AIMessage[] = [
        { role: "system", content: systemContent },
        ...messages.slice(-10).map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
        { role: "user" as const, content: msg },
      ];

      const result = await sendAIMessageWithFailover(getAllConfigs(), history);
      setMessages((p) => [...p, {
        id: crypto.randomUUID(), role: "assistant", content: result.content,
        timestamp: new Date(), model: result.model, tokens: result.tokensUsed,
      }]);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      toast.error(`AI Error: ${errorMsg}`);
      setMessages((p) => [...p, {
        id: crypto.randomUUID(), role: "assistant",
        content: `⚠️ **Error:** ${errorMsg}\n\nPlease check your API key in AI Settings.`,
        timestamp: new Date(),
      }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [input, loading, hasActiveKey, includeData, messages, getAllConfigs]);

  const handleSubmit  = (e: FormEvent) => { e.preventDefault(); handleSend(); };
  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } };
  const handleCopy    = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleShareWhatsApp = (content: string) => {
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(content)}`;
    window.open(url, "_blank");
  };

  const handleShareEmail = (content: string) => {
    const url = `mailto:?subject=LawMind AI Agent Chat&body=${encodeURIComponent(content)}`;
    window.open(url, "_self");
  };

  const handleSharePDF = (content: string) => {
    try {
      const doc = new jsPDF();
      const lines = doc.splitTextToSize(content, 180);
      let y = 10;
      lines.forEach((line: string) => {
        if (y > 280) {
          doc.addPage();
          y = 10;
        }
        doc.text(line, 10, y);
        y += 7;
      });
      doc.save(`ai-chat-${new Date().getTime()}.pdf`);
      toast.success("PDF generated successfully");
    } catch (error) {
      toast.error("Failed to generate PDF");
    }
  };

  /* ── Config loading ── */
  if (configLoading) return (
    <div className="flex flex-col items-center justify-center h-[70vh] gap-4">
      <OrbGif pulse />
      <span className="text-sm text-muted-foreground">Loading AI…</span>
    </div>
  );

  /* ── No API key ── */
  if (!hasActiveKey) return (
    <div className="flex flex-col items-center justify-center h-[70vh] text-center px-4 gap-5">
      <OrbGif dimmed />
      {isAdminOrAbove ? (
        <>
          <h2 className="text-xl font-semibold text-foreground">Configure Your AI Agent</h2>
          <p className="text-sm text-muted-foreground max-w-sm">
            Add an API key from Groq, OpenAI, or Gemini to activate the AI Agent for all users.
          </p>
          <Link to="/setup/ai-settings"
            className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-violet-500 transition-colors shadow-lg shadow-violet-500/20">
            <Settings className="w-4 h-4" /> Open AI Settings
          </Link>
        </>
      ) : (
        <>
          <h2 className="text-xl font-semibold text-foreground">AI Agent Not Yet Active</h2>
          <p className="text-sm text-muted-foreground max-w-sm">
            Your administrator needs to configure an AI API key. Once set up, the assistant will be available here automatically.
          </p>
        </>
      )}
    </div>
  );

  const activeInfo  = PROVIDER_INFO[config.activeProvider];
  const firstName   = profile?.full_name?.split(" ")[0] || "there";
  const hasMessages = messages.length > 0 || loading;

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">

      {/* ── Status bar ── */}
      <div className="flex items-center justify-between px-4 md:px-6 py-2 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: activeInfo.color }} />
          <span className="text-[11px] text-muted-foreground">
            {activeInfo.label} · {config.providers[config.activeProvider].model}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setIncludeData((v) => !v)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all ${
              includeData
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "border-border bg-muted text-muted-foreground"
            }`}
          >
            <Database className="w-3 h-3" />
            <span className="hidden sm:inline">{includeData ? "Data ON" : "Data OFF"}</span>
          </button>
          {hasMessages && (
            <button
              onClick={() => setMessages([])}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium border border-border bg-muted text-muted-foreground hover:text-destructive hover:border-destructive/30 transition-all"
            >
              <Trash2 className="w-3 h-3" />
              <span className="hidden sm:inline">Clear</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">

        {!hasMessages ? (
          /* ─── Welcome screen ─── */
          <div className="flex flex-col items-center justify-center min-h-full px-4 py-10">

            {/* GIF Orb */}
            <div className="mb-7">
              <OrbGif pulse />
            </div>

            <h1 className="text-3xl font-semibold text-foreground mb-2 text-center">
              {getGreeting()}, {firstName}
            </h1>
            <p className="text-base text-muted-foreground mb-10 text-center">
              What's on your mind?
            </p>

            {/* Centered input */}
            <div className="w-full max-w-2xl mb-10">
              <form onSubmit={handleSubmit}>
                <ChatInput inputRef={inputRef} input={input} setInput={setInput} loading={loading} onKeyDown={handleKeyDown} />
              </form>
            </div>

            {/* Suggestion cards */}
            <div className="w-full max-w-2xl">
              <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest mb-3 text-center">
                Get started with an example below
              </p>
              <div className="grid grid-cols-2 gap-3">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s.label}
                    onClick={() => handleSend(s.prompt)}
                    className="group flex flex-col justify-between rounded-xl border border-border bg-card p-4 text-left
                      hover:border-violet-400/50 hover:shadow-md hover:shadow-violet-500/5
                      transition-all duration-200 active:scale-[0.98] min-h-[80px]"
                  >
                    <span className="text-xs text-foreground/80 group-hover:text-foreground leading-snug">
                      {s.label}
                    </span>
                    <s.icon className="w-4 h-4 text-muted-foreground/40 group-hover:text-violet-500 mt-3 self-end transition-colors" />
                  </button>
                ))}
              </div>
            </div>
          </div>

        ) : (
          /* ─── Chat messages ─── */
          <div className="px-4 md:px-6 py-6 space-y-5 max-w-3xl mx-auto w-full">

            {messages.map((msg) => (
              <div key={msg.id}
                className={`flex gap-3 animate-in fade-in-0 slide-in-from-bottom-2 duration-300 ${
                  msg.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                {msg.role === "assistant" && (
                  <div className="shrink-0 mt-1">
                    <OrbGif size="sm" />
                  </div>
                )}

                <div className={`relative max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed border ${
                  msg.role === "user"
                    ? "bg-muted text-foreground rounded-tr-sm border-border"
                    : "bg-card text-foreground rounded-tl-sm border-border shadow-sm"
                }`}>
                  <MarkdownContent content={msg.content} />
                  <div className="flex items-center gap-2 mt-2 pt-1.5 border-t border-border/50">
                    <span className="text-[10px] text-muted-foreground">
                      {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    {msg.model  && <span className="text-[10px] text-muted-foreground">· {msg.model}</span>}
                    {msg.tokens && <span className="text-[10px] text-muted-foreground">· {msg.tokens} tokens</span>}
                    <div className="ml-auto flex items-center gap-1">
                      <button onClick={() => handleCopy(msg.id, msg.content)}
                        className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        title="Copy text">
                        {copiedId === msg.id
                          ? <Check className="w-3 h-3 text-emerald-500" />
                          : <Copy className="w-3 h-3" />}
                      </button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                            title="Share">
                            <Share2 className="w-3 h-3" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuItem onClick={() => handleShareWhatsApp(msg.content)} className="gap-2 cursor-pointer text-xs">
                            <MessageCircle className="w-3.5 h-3.5" />
                            Share on WhatsApp
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleShareEmail(msg.content)} className="gap-2 cursor-pointer text-xs">
                            <Mail className="w-3.5 h-3.5" />
                            Share via Email
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleSharePDF(msg.content)} className="gap-2 cursor-pointer text-xs">
                            <Download className="w-3.5 h-3.5" />
                            Download as PDF
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>

                {msg.role === "user" && (
                  <div className="w-9 h-9 rounded-full bg-muted border border-border flex items-center justify-center shrink-0 mt-1">
                    <User className="w-4 h-4 text-muted-foreground" />
                  </div>
                )}
              </div>
            ))}

            {/* Typing indicator */}
            {loading && (
              <div className="flex gap-3 justify-start animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
                <div className="shrink-0"><OrbGif size="sm" pulse /></div>
                <div className="rounded-2xl rounded-tl-sm bg-card border border-border px-5 py-4 shadow-sm">
                  <div className="flex gap-1.5 items-center">
                    {[0, 150, 300].map((delay) => (
                      <span key={delay} className="w-2 h-2 rounded-full bg-violet-500/60 animate-bounce"
                        style={{ animationDelay: `${delay}ms` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* ── Bottom input (only when chatting) ── */}
      {hasMessages && (
        <div className="shrink-0 border-t border-border bg-background/80 backdrop-blur-sm px-4 md:px-6 py-4">
          <div className="max-w-3xl mx-auto">
            <form onSubmit={handleSubmit}>
              <ChatInput inputRef={inputRef} input={input} setInput={setInput} loading={loading} onKeyDown={handleKeyDown} />
            </form>
          </div>
          <p className="text-center text-[10px] text-muted-foreground/40 mt-2">
            LawMind AI can make mistakes. Always verify important legal information.
          </p>
        </div>
      )}
    </div>
  );
}

/* ═══════════════ Voice Input Hook ═══════════════ */

type VoiceHookOptions = { onTranscript: (text: string) => void };

function useVoiceInput({ onTranscript }: VoiceHookOptions) {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<unknown>(null);

  const isSupported =
    typeof window !== "undefined" &&
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in (window as any));

  const startListening = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;

    const recognition = new SR();
    recognition.continuous      = false;
    recognition.interimResults  = true;
    recognition.lang            = "en-IN";

    recognition.onstart = () => setIsListening(true);
    recognition.onend   = () => setIsListening(false);
    recognition.onerror = (e: unknown) => {
      setIsListening(false);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const msg = (e as any)?.error;
      if (msg && msg !== "no-speech") toast.error(`Voice error: ${msg}`);
    };
    recognition.onresult = (event: unknown) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ev = event as any;
      const results: SpeechRecognitionResultList = ev.results;
      const last = results[results.length - 1];
      if (last.isFinal) {
        onTranscript(last[0].transcript.trim());
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [onTranscript]);

  const stopListening = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (recognitionRef.current as any)?.stop();
    setIsListening(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return () => { (recognitionRef.current as any)?.abort(); };
  }, []);

  return { isListening, isSupported, startListening, stopListening };
}

/* ═══════════════ Animated GIF Orb ═══════════════ */

function OrbGif({
  size  = "lg",
  pulse = false,
  dimmed = false,
}: {
  size?:   "sm" | "md" | "lg" | "xl";
  pulse?:  boolean;
  dimmed?: boolean;
}) {
  const dim = {
    sm: { wrap: "w-11 h-11",   img: "w-9 h-9",   glow: "blur-md",  ring: "shadow-violet-400/20" },
    md: { wrap: "w-16 h-16", img: "w-14 h-14",  glow: "blur-xl",  ring: "shadow-violet-400/20" },
    lg: { wrap: "w-32 h-32", img: "w-28 h-28",  glow: "blur-2xl", ring: "shadow-violet-500/30" },
    xl: { wrap: "w-44 h-44", img: "w-38 h-38",  glow: "blur-3xl", ring: "shadow-violet-500/30" },
  }[size];

  return (
    <div className="relative flex items-center justify-center">
      {/* Glow */}
      <div className={`absolute inset-0 rounded-full bg-gradient-to-br from-violet-400/40 to-purple-600/30 scale-110 ${dim.glow} ${pulse ? "animate-pulse" : ""} ${dimmed ? "opacity-20" : "opacity-70"}`} />
      {/* Shell */}
      <div className={`relative ${dim.wrap} rounded-full flex items-center justify-center overflow-hidden bg-gradient-to-br from-violet-100/80 to-purple-100/60 dark:from-violet-900/30 dark:to-purple-900/20 border border-violet-300/40 dark:border-violet-500/20 shadow-xl ${dim.ring}`}>
        <img
          src={aiBotGif}
          alt="LawMind AI"
          className={`${dim.img} object-contain rounded-full ${dimmed ? "opacity-40" : ""}`}
        />
      </div>
    </div>
  );
}

/* ═══════════════ Chat Input ═══════════════ */

function ChatInput({
  inputRef, input, setInput, loading, onKeyDown,
}: {
  inputRef: React.RefObject<HTMLTextAreaElement>;
  input: string;
  setInput: (v: string) => void;
  loading: boolean;
  onKeyDown: (e: React.KeyboardEvent) => void;
}) {
  const { isListening, isSupported, startListening, stopListening } = useVoiceInput({
    onTranscript: (text) => setInput((prev) => prev ? `${prev} ${text}` : text),
  });

  return (
    <div className="relative">
      {/* ── Listening overlay banner ── */}
      {isListening && (
        <div className="absolute -top-12 left-0 right-0 flex items-center justify-center animate-in fade-in-0 slide-in-from-bottom-2 duration-200">
          <div className="flex items-center gap-2.5 bg-red-500 text-white text-xs font-semibold px-4 py-1.5 rounded-full shadow-lg shadow-red-500/30">
            {/* Sound wave bars */}
            <div className="flex items-center gap-0.5 h-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="voice-bar w-0.5 rounded-full bg-white"
                  style={{ height: "100%" }}
                />
              ))}
            </div>
            <span>Listening…</span>
            <button
              type="button"
              onClick={stopListening}
              className="ml-1 hover:opacity-70 transition-opacity"
            >
              <MicOff className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* ── Input row ── */}
      <div className={`flex items-end gap-2 rounded-2xl border bg-card px-4 py-3 transition-all duration-200 ${
        isListening
          ? "border-red-400/60 shadow-lg shadow-red-400/10"
          : "border-border focus-within:border-violet-400/60 focus-within:shadow-lg focus-within:shadow-violet-400/10"
      }`}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={isListening ? "Listening to your voice…" : "Ask AI a question or make a request…"}
          rows={1}
          className="flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none max-h-32"
          style={{ minHeight: 36 }}
          onInput={(e) => {
            const t = e.currentTarget;
            t.style.height = "auto";
            t.style.height = Math.min(t.scrollHeight, 128) + "px";
          }}
        />

        {/* ── Mic button ── */}
        {isSupported && (
          <button
            type="button"
            onClick={isListening ? stopListening : startListening}
            title={isListening ? "Stop listening" : "Voice input"}
            className={`relative w-9 h-9 flex items-center justify-center rounded-full shrink-0 transition-all duration-200 ${
              isListening
                ? "bg-red-500 text-white shadow-lg shadow-red-500/40 scale-110"
                : "text-muted-foreground hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-500/10"
            }`}
          >
            {/* Ripple rings when listening */}
            {isListening && (
              <>
                <span className="voice-ripple-1 absolute inset-0 rounded-full border-2 border-red-400" />
                <span className="voice-ripple-2 absolute inset-0 rounded-full border-2 border-red-400" />
              </>
            )}

            {isListening ? (
              /* Animated bars while recording */
              <div className="flex items-center gap-px h-4 z-10">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="voice-bar w-0.5 rounded-full bg-white"
                    style={{ height: "100%" }}
                  />
                ))}
              </div>
            ) : (
              <Mic className="w-4 h-4" />
            )}
          </button>
        )}

        {/* ── Send button ── */}
        <button
          type="submit"
          disabled={!input.trim() || loading}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-violet-600 text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-violet-500 active:scale-95 transition-all shrink-0 shadow-md shadow-violet-500/30"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

/* ═══════════════ Markdown ═══════════════ */

function MarkdownContent({ content }: { content: string }) {
  return (
    <div className="prose prose-sm max-w-none">
      <style dangerouslySetInnerHTML={{ __html: `
        .prose-chat-override,
        .prose-chat-override p, 
        .prose-chat-override li, 
        .prose-chat-override strong, 
        .prose-chat-override span,
        .prose-chat-override h1,
        .prose-chat-override h2,
        .prose-chat-override h3,
        .prose-chat-override table,
        .prose-chat-override td,
        .prose-chat-override th {
          color: #000000 !important;
          font-weight: 700 !important;
        }
        
        .prose-chat-override ul {
          list-style-type: disc !important;
          padding-left: 1.5rem !important;
          margin-top: 0.5rem !important;
          margin-bottom: 0.5rem !important;
        }
        
        .prose-chat-override ol {
          list-style-type: decimal !important;
          padding-left: 1.5rem !important;
          margin-top: 0.5rem !important;
          margin-bottom: 0.5rem !important;
        }

        .prose-chat-override li {
          margin-top: 0.25rem !important;
          margin-bottom: 0.25rem !important;
          display: list-item !important;
        }

        .prose-chat-override-table-wrapper {
          width: 100% !important;
          overflow-x: auto !important;
          margin-top: 0.75rem !important;
          margin-bottom: 0.75rem !important;
          border: 1px solid #cbd5e1 !important;
          border-radius: 0.375rem !important;
          background-color: #ffffff !important;
        }

        .prose-chat-override table {
          width: 100% !important;
          border-collapse: collapse !important;
          font-size: 0.85rem !important;
        }

        .prose-chat-override th {
          background-color: #f8fafc !important;
          border-bottom: 2px solid #94a3b8 !important;
          padding: 0.625rem 0.75rem !important;
          text-align: left !important;
        }

        .prose-chat-override td {
          border-bottom: 1px solid #e2e8f0 !important;
          padding: 0.625rem 0.75rem !important;
          white-space: nowrap !important;
        }

        .prose-chat-override tr:last-child td {
          border-bottom: none !important;
        }
      `}} />
      <div 
        className="prose-chat-override"
        dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
      />
    </div>
  );
}

function renderMarkdown(text: string): string {
  let html = escapeHtml(text);
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_m, _lang, code) => `<pre><code>${code.trim()}</code></pre>`);
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, "<em>$1</em>");
  html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");
  html = html.replace(/(?:^\|.+\|$\n?)+/gm, (block) => {
    const rows = block.trim().split("\n").filter((r) => !/^\|\s*[-:]+/.test(r));
    if (!rows.length) return block;
    const hdr = rows[0].split("|").filter(Boolean).map((c) => `<th>${c.trim()}</th>`).join("");
    const body = rows.slice(1).map((r) => `<tr>${r.split("|").filter(Boolean).map((c) => `<td>${c.trim()}</td>`).join("")}</tr>`).join("");
    return `<div class="prose-chat-override-table-wrapper"><table><thead><tr>${hdr}</tr></thead><tbody>${body}</tbody></table></div>`;
  });
  html = html.replace(/^[-*] (.+)$/gm, "<li>$1</li>");
  html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, "<ul>$1</ul>");
  html = html.replace(/^\d+\. (.+)$/gm, "<li>$1</li>");
  html = html.replace(/\n/g, "<br/>");
  html = html.replace(/<br\/>(<\/?(?:h[1-3]|pre|ul|ol|table|thead|tbody|tr))/g, "$1");
  html = html.replace(/(<\/(?:h[1-3]|pre|ul|ol|table|thead|tbody|tr)>)<br\/>/g, "$1");
  return html;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
