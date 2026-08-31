import type { LeadTemperature } from "@/types/lead";

const TEMPERATURE_STYLES: Record<LeadTemperature, string> = {
  hot: "bg-red-50 text-red-700 ring-red-600/20",
  warm: "bg-amber-50 text-amber-700 ring-amber-600/20",
  cold: "bg-sky-50 text-sky-700 ring-sky-600/20",
};

export function TemperatureBadge({ temperature }: { temperature: LeadTemperature }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${TEMPERATURE_STYLES[temperature]}`}
    >
      {temperature.charAt(0).toUpperCase() + temperature.slice(1)}
    </span>
  );
}

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-slate-100 text-slate-700 ring-slate-500/20",
  searching: "bg-indigo-50 text-indigo-700 ring-indigo-600/20",
  scraping: "bg-indigo-50 text-indigo-700 ring-indigo-600/20",
  analyzing: "bg-indigo-50 text-indigo-700 ring-indigo-600/20",
  completed: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  failed: "bg-red-50 text-red-700 ring-red-600/20",
};

export function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.pending;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ring-1 ring-inset ${style}`}
    >
      {status}
    </span>
  );
}

export function ConnectionBadge({ ok }: { ok: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
        ok ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20" : "bg-red-50 text-red-700 ring-red-600/20"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${ok ? "bg-emerald-600" : "bg-red-600"}`} />
      {ok ? "Connected" : "Not connected"}
    </span>
  );
}
