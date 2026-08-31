"use client";

import { useEffect, useState } from "react";
import { ConnectionBadge } from "@/components/StatusBadge";

interface StatusResult {
  ok: boolean;
  message: string;
}

interface StatusResponse {
  firecrawl: StatusResult;
  groq: StatusResult;
  database: StatusResult;
}

export default function SettingsPage() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [testing, setTesting] = useState<"firecrawl" | "groq" | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/settings/status", { cache: "no-store" });
      const json = await res.json();
      if (!cancelled) setStatus(json);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function testConnection(kind: "firecrawl" | "groq") {
    setTesting(kind);
    try {
      const res = await fetch(`/api/${kind}/test`, { cache: "no-store" });
      const json = await res.json();
      setStatus((prev) => (prev ? { ...prev, [kind]: json } : prev));
    } finally {
      setTesting(null);
    }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Settings</h1>
        <p className="mt-1 text-sm text-slate-500">Connection status for the services this app depends on.</p>
      </div>

      <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 p-5">
          <div>
            <p className="text-sm font-semibold text-slate-900">Firecrawl (self-hosted)</p>
            <p className="mt-0.5 text-sm text-slate-500">{status?.firecrawl.message ?? "Checking..."}</p>
          </div>
          <div className="flex items-center gap-3">
            {status && <ConnectionBadge ok={status.firecrawl.ok} />}
            <button
              onClick={() => testConnection("firecrawl")}
              disabled={testing === "firecrawl"}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
            >
              {testing === "firecrawl" ? "Testing..." : "Test Firecrawl"}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 p-5">
          <div>
            <p className="text-sm font-semibold text-slate-900">Groq</p>
            <p className="mt-0.5 text-sm text-slate-500">{status?.groq.message ?? "Checking..."}</p>
          </div>
          <div className="flex items-center gap-3">
            {status && <ConnectionBadge ok={status.groq.ok} />}
            <button
              onClick={() => testConnection("groq")}
              disabled={testing === "groq"}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
            >
              {testing === "groq" ? "Testing..." : "Test Groq"}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 p-5">
          <div>
            <p className="text-sm font-semibold text-slate-900">Database</p>
            <p className="mt-0.5 text-sm text-slate-500">{status?.database.message ?? "Checking..."}</p>
          </div>
          {status && <ConnectionBadge ok={status.database.ok} />}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm">
        API keys and credentials are never exposed here or to the browser - only connection status is shown.
        Configure <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">FIRECRAWL_API_URL</code>,{" "}
        <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">GROQ_API_KEY</code>, and{" "}
        <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">DATABASE_URL</code> in your{" "}
        <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">.env.local</code> file, then restart the app.
      </div>
    </div>
  );
}
