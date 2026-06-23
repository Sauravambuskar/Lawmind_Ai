import {
  useState, useRef, useCallback, useEffect,
  type TextareaHTMLAttributes,
} from "react";
import { Sparkles, X, Check, Loader2 } from "lucide-react";
import { useAIConfig } from "@/hooks/useAIConfig";
import { useAppSettings } from "@/hooks/useAppSettings";
import { sendAIMessage } from "@/lib/ai-providers";
import { cn } from "@/lib/utils";

/* ─── Props ─── */
export interface AITextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** A short description of what this field is for, used as context for the AI. */
  context?: string;
  className?: string;
}

/* ─── Main Component ─── */
export function AITextarea({ context = "text field", className, value, onChange, ...rest }: AITextareaProps) {
  const { settings } = useAppSettings();
  const { hasActiveKey, getActiveConfig } = useAIConfig();

  const [suggestion, setSuggestion]     = useState("");
  const [isFetching, setIsFetching]     = useState(false);
  const [showCard, setShowCard]         = useState(false);

  const timerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef  = useRef<AbortController | null>(null);
  const textValue = typeof value === "string" ? value : "";

  const isFeatureOn = settings.autofillEnabled && hasActiveKey;

  /* Clear pending timers on unmount */
  useEffect(() => {
    return () => {
      if (timerRef.current)  clearTimeout(timerRef.current);
      abortRef.current?.abort();
    };
  }, []);

  /* Fetch suggestion after user pauses typing */
  const scheduleFetch = useCallback(
    (text: string) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      abortRef.current?.abort();

      if (!isFeatureOn || text.trim().length < 15) {
        setSuggestion("");
        setShowCard(false);
        return;
      }

      timerRef.current = setTimeout(async () => {
        setIsFetching(true);
        setShowCard(true);
        setSuggestion("");

        const ctrl = new AbortController();
        abortRef.current = ctrl;

        try {
          const result = await sendAIMessage(getActiveConfig(), [
            {
              role: "system",
              content:
                "You are a professional legal writing assistant. Complete the given text naturally and concisely. Return ONLY the continuation — never repeat the existing text. Max 2 sentences.",
            },
            {
              role: "user",
              content: `Field: ${context}\n\nExisting text: "${text}"\n\nContinue writing from where the text ends:`,
            },
          ]);

          if (!ctrl.signal.aborted) {
            const clean = result.content.trim().replace(/^["']|["']$/g, "");
            setSuggestion(clean);
          }
        } catch {
          if (!ctrl.signal.aborted) {
            setShowCard(false);
          }
        } finally {
          if (!ctrl.signal.aborted) setIsFetching(false);
        }
      }, 900);
    },
    [isFeatureOn, getActiveConfig, context],
  );

  /* Handle textarea change */
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange?.(e);
    scheduleFetch(e.target.value);
  };

  /* Apply suggestion */
  const applySuggestion = () => {
    if (!suggestion || !onChange) return;
    const sep = textValue.endsWith(" ") || textValue.endsWith("\n") ? "" : " ";
    const syntheticEvent = {
      target: { value: textValue + sep + suggestion },
    } as React.ChangeEvent<HTMLTextAreaElement>;
    onChange(syntheticEvent);
    setSuggestion("");
    setShowCard(false);
  };

  /* Dismiss */
  const dismiss = () => {
    abortRef.current?.abort();
    setSuggestion("");
    setShowCard(false);
    setIsFetching(false);
  };

  return (
    <div className="relative w-full">
      {/* The actual textarea */}
      <textarea
        value={value}
        onChange={handleChange}
        className={cn(
          "flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-y",
          isFeatureOn && "focus-visible:ring-violet-400/50",
          className,
        )}
        {...rest}
      />

      {/* AI badge — subtle indicator that autofill is active */}
      {isFeatureOn && (
        <div className="absolute top-2 right-2 pointer-events-none">
          <span className="flex items-center gap-1 text-[9px] font-semibold text-violet-400/60 dark:text-violet-400/50 select-none">
            <Sparkles className="w-2.5 h-2.5" />
            AI
          </span>
        </div>
      )}

      {/* Suggestion card */}
      {isFeatureOn && showCard && (
        <div className="mt-1.5 rounded-xl border border-violet-300/40 dark:border-violet-500/20 bg-white dark:bg-card shadow-lg shadow-violet-500/10 overflow-hidden animate-in fade-in-0 slide-in-from-top-1 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-violet-200/50 dark:border-violet-500/10 bg-violet-50/80 dark:bg-violet-500/5">
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded-full bg-violet-100 dark:bg-violet-500/20 flex items-center justify-center">
                <Sparkles className="w-3 h-3 text-violet-600 dark:text-violet-400" />
              </div>
              <span className="text-[11px] font-semibold text-violet-700 dark:text-violet-300">
                AI Suggestion
              </span>
              {isFetching && (
                <Loader2 className="w-3 h-3 text-violet-500 animate-spin ml-1" />
              )}
            </div>
            <button
              type="button"
              onClick={dismiss}
              className="w-5 h-5 flex items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </div>

          {/* Suggestion body */}
          <div className="px-3 py-2.5">
            {isFetching && !suggestion ? (
              /* Skeleton loader */
              <div className="space-y-1.5">
                <div className="h-3 bg-muted rounded animate-pulse w-full" />
                <div className="h-3 bg-muted rounded animate-pulse w-4/5" />
                <div className="h-3 bg-muted rounded animate-pulse w-3/5" />
              </div>
            ) : suggestion ? (
              <p className="text-sm text-foreground/80 leading-relaxed">{suggestion}</p>
            ) : null}
          </div>

          {/* Actions */}
          {suggestion && (
            <div className="flex items-center justify-end gap-2 px-3 py-2 border-t border-border/50 bg-muted/30">
              <button
                type="button"
                onClick={dismiss}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Dismiss
              </button>
              <button
                type="button"
                onClick={applySuggestion}
                className="flex items-center gap-1.5 text-xs font-semibold bg-violet-600 hover:bg-violet-500 text-white px-3 py-1 rounded-lg transition-colors shadow-sm shadow-violet-500/20"
              >
                <Check className="w-3 h-3" />
                Use suggestion
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
