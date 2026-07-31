import { useState } from "react";
import { Bell, CalendarClock, AlertTriangle, CheckCircle, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { restGet } from "@/lib/restClient";
import { addDays, format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { CURRENCY, LOCALE } from "@/lib/constants";

type Notification =
  | { kind: "hearing"; id: string; label: string; sub: string; date: string }
  | { kind: "invoice"; id: string; label: string; sub: string; amount: number; dueDate: string };

interface CaseRow {
  id: string;
  case_number: string;
  title: string | null;
  court_name: string | null;
  next_hearing_date: string;
}

interface InvoiceRow {
  id: string;
  invoice_number: string;
  total_amount: number | string | null;
  due_date: string;
  client_id: string | null;
}

function useNotifications() {
  return useQuery({
    queryKey: ["notifications"],
    queryFn: async (): Promise<Notification[]> => {
      const now = new Date();
      const soon = addDays(now, 3);
      const todayStr = now.toISOString().split("T")[0];
      const soonStr = soon.toISOString().split("T")[0];

      // Hearing data lives on cases.next_hearing_date (the hearings table is empty)
      const [caseRows, invoiceRows] = await Promise.all([
        restGet<CaseRow>(
          `cases?select=id,case_number,title,court_name,next_hearing_date` +
            `&next_hearing_date=gte.${todayStr}&next_hearing_date=lte.${soonStr}` +
            `&order=next_hearing_date.asc&limit=10`,
        ),
        restGet<InvoiceRow>(
          `invoices?select=id,invoice_number,total_amount,due_date,client_id` +
            `&due_date=lt.${todayStr}&status=neq.paid&status=neq.cancelled` +
            `&order=due_date.asc&limit=10`,
        ),
      ]);

      // Resolve client names separately — there is no FK join exposed on invoices
      const clientIds = [...new Set(invoiceRows.map(i => i.client_id).filter(Boolean))];
      const clientNames = new Map<string, string>();
      if (clientIds.length) {
        const clients = await restGet<{ id: string; name: string }>(
          `clients?select=id,name&id=in.(${clientIds.join(",")})`,
        );
        clients.forEach(c => clientNames.set(c.id, c.name));
      }

      const hearings: Notification[] = caseRows.map(c => ({
        kind: "hearing",
        id: c.id,
        label: c.title || c.case_number,
        sub: c.court_name || "Court TBD",
        date: c.next_hearing_date + "T00:00:00",
      }));

      const invoices: Notification[] = invoiceRows.map(inv => ({
        kind: "invoice",
        id: inv.id,
        label: `Invoice #${inv.invoice_number}`,
        sub: (inv.client_id && clientNames.get(inv.client_id)) || "No client",
        amount: Number(inv.total_amount ?? 0),
        dueDate: inv.due_date,
      }));

      return [...hearings, ...invoices];
    },
    refetchInterval: 5 * 60 * 1000,
    retry: false,
  });
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { data: notifications = [] } = useNotifications();

  const count = notifications.length;

  const handleClick = (n: Notification) => {
    setOpen(false);
    if (n.kind === "hearing") navigate(`/cases/${n.id}`);
    else navigate("/invoices");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          title="Notifications"
          className="relative w-8 h-8 flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <Bell className="w-4 h-4" />
          {count > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center leading-none">
              {count > 9 ? "9+" : count}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 p-0 shadow-xl" sideOffset={8}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">Notifications</span>
            {count > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-rose-500/10 text-rose-600 text-[10px] font-bold">{count}</span>
            )}
          </div>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setOpen(false)}>
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>

        {/* List */}
        <div className="max-h-80 overflow-y-auto divide-y divide-border">
          {notifications.length === 0 ? (
            <div className="py-10 flex flex-col items-center justify-center text-muted-foreground">
              <CheckCircle className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-sm font-medium">All caught up!</p>
              <p className="text-xs mt-0.5">No upcoming hearings or overdue invoices.</p>
            </div>
          ) : (
            notifications.map(n => (
              <button
                key={`${n.kind}-${n.id}`}
                onClick={() => handleClick(n)}
                className="w-full flex items-start gap-3 px-4 py-3 hover:bg-muted/40 transition-colors text-left"
              >
                <div className={`mt-0.5 p-1.5 rounded-md flex-shrink-0 ${
                  n.kind === "hearing" ? "bg-amber-500/10" : "bg-rose-500/10"
                }`}>
                  {n.kind === "hearing"
                    ? <CalendarClock className="w-3.5 h-3.5 text-amber-600" />
                    : <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{n.label}</p>
                  <p className="text-xs text-muted-foreground truncate">{n.sub}</p>
                  <p className={`text-[10px] font-semibold mt-1 ${
                    n.kind === "hearing" ? "text-amber-600" : "text-rose-600"
                  }`}>
                    {n.kind === "hearing"
                      ? format(new Date(n.date), "EEE, MMM d · h:mm a")
                      : `${CURRENCY}${n.amount.toLocaleString(LOCALE)} — Due ${n.dueDate}`}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        {notifications.length > 0 && (
          <div className="border-t border-border px-4 py-2 flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-xs"
              onClick={() => { setOpen(false); navigate("/hearings"); }}
            >
              <CalendarClock className="w-3.5 h-3.5 mr-1.5 text-amber-600" /> Hearings
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-xs"
              onClick={() => { setOpen(false); navigate("/invoices"); }}
            >
              <AlertTriangle className="w-3.5 h-3.5 mr-1.5 text-rose-600" /> Invoices
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
