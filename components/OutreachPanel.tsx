"use client";

import { useState } from "react";
import type { EmailDraft, WhatsAppDraft } from "@/types/lead";

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Clipboard API can be unavailable (e.g. insecure context) - fail silently, the
    // text is still selectable/visible for the user to copy manually.
  }
}

export function OutreachPanel({ leadId, leadEmail }: { leadId: string; leadEmail: string | null }) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <WhatsAppCard leadId={leadId} />
      <EmailCard leadId={leadId} leadEmail={leadEmail} />
    </div>
  );
}

function WhatsAppCard({ leadId }: { leadId: string }) {
  const [draft, setDraft] = useState<WhatsAppDraft | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/leads/${leadId}/whatsapp`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to draft WhatsApp message.");
      setDraft(json.draft);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">WhatsApp Message</h2>
        <button
          onClick={generate}
          disabled={loading}
          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Drafting..." : draft ? "Regenerate" : "Draft Message"}
        </button>
      </div>

      {error && (
        <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 ring-1 ring-inset ring-red-600/20">
          {error}
        </div>
      )}

      {draft && (
        <div className="mt-4 flex flex-col gap-3">
          {draft.whatsapp_number ? (
            <p className="text-xs text-slate-500">
              To: <span className="font-medium text-slate-700">{draft.whatsapp_number}</span>
            </p>
          ) : (
            <p className="text-xs text-amber-600">
              No WhatsApp number found for this lead - copy the message and send it manually via
              another channel.
            </p>
          )}
          <textarea
            readOnly
            value={draft.message}
            rows={4}
            className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
          />
          <div className="flex gap-2">
            <button
              onClick={() => {
                copyToClipboard(draft.message);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
            {draft.whatsapp_link && (
              <a
                href={draft.whatsapp_link}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700"
              >
                Open in WhatsApp
              </a>
            )}
          </div>
          <p className="text-[11px] text-slate-400">
            Draft only - review before sending. This app never sends messages automatically.
          </p>
        </div>
      )}
    </div>
  );
}

function EmailCard({ leadId, leadEmail }: { leadId: string; leadEmail: string | null }) {
  const [draft, setDraft] = useState<EmailDraft | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/leads/${leadId}/email`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to draft opportunity email.");
      setDraft(json.draft);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  const mailtoHref = draft
    ? `mailto:${leadEmail ?? ""}?subject=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(draft.body)}`
    : undefined;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">Opportunity Email</h2>
        <button
          onClick={generate}
          disabled={loading}
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Drafting..." : draft ? "Regenerate" : "Draft Email"}
        </button>
      </div>

      {error && (
        <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 ring-1 ring-inset ring-red-600/20">
          {error}
        </div>
      )}

      {draft && (
        <div className="mt-4 flex flex-col gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Subject</p>
            <p className="text-sm font-medium text-slate-800">{draft.subject}</p>
          </div>
          <textarea
            readOnly
            value={draft.body}
            rows={8}
            className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
          />
          <div className="flex gap-2">
            <button
              onClick={() => {
                copyToClipboard(`Subject: ${draft.subject}\n\n${draft.body}`);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
            {mailtoHref && (
              <a
                href={mailtoHref}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700"
              >
                Open in Email Client
              </a>
            )}
          </div>
          <p className="text-[11px] text-slate-400">
            Draft only - review before sending.{" "}
            {leadEmail
              ? `Recipient prefilled from the lead's public contact email (${leadEmail}).`
              : "No public email found for this lead - add a recipient in your email client."}
          </p>
        </div>
      )}
    </div>
  );
}
