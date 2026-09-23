import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { restGet, restGetAll } from "@/lib/restClient";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, isToday, isSameMonth } from "date-fns";
import { ChevronLeft, ChevronRight, CalendarDays, Gavel } from "lucide-react";

export default function HearingCalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Fetch all cases with next_hearing_date
  const { data: hearings = [] } = useQuery({
    queryKey: ["calendar-hearings"],
    queryFn: async () => {
      // 1. Fetch cases with next_hearing_date (paginated past PostgREST's 1000 cap)
      const caseHearings = await restGetAll<any>("cases?select=id,case_number,title,next_hearing_date,court_name,case_stage&next_hearing_date=not.is.null&order=next_hearing_date.asc");

      // 2. Fetch hearings table entries
      const hearingsData = await restGet<any>("hearings?select=id,case_id,hearing_date,court_name,purpose,status&order=hearing_date.asc").catch(() => []);

      // 3. Merge both sources (avoid duplicates by using a map keyed by date+case)
      const all: any[] = [];
      const seen = new Set<string>();

      // Add case hearings
      caseHearings.forEach(c => {
        const key = `${c.next_hearing_date}_${c.id}`;
        if (!seen.has(key)) {
          seen.add(key);
          all.push({ ...c, source: "case" });
        }
      });

      // Add hearings table entries
      (hearingsData || []).forEach((h: any) => {
        const dateStr = h.hearing_date ? h.hearing_date.split("T")[0] : null;
        if (!dateStr) return;
        const key = `${dateStr}_${h.case_id || h.id}`;
        if (!seen.has(key)) {
          seen.add(key);
          all.push({
            id: h.case_id || h.id,
            case_number: h.purpose || "Hearing",
            title: h.purpose || "Scheduled Hearing",
            next_hearing_date: dateStr,
            court_name: h.court_name,
            case_stage: h.status,
            source: "hearing",
          });
        }
      });

      return all;
    },
  });

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Group hearings by date
  const hearingsByDate = useMemo(() => {
    const map: Record<string, any[]> = {};
    hearings.forEach((h: any) => {
      if (h.next_hearing_date) {
        const key = h.next_hearing_date; // YYYY-MM-DD
        if (!map[key]) map[key] = [];
        map[key].push(h);
      }
    });
    return map;
  }, [hearings]);

  // Count hearings this month
  const thisMonthCount = days.reduce((count, day) => {
    const key = format(day, "yyyy-MM-dd");
    return count + (hearingsByDate[key]?.length || 0);
  }, 0);

  // Pad days to start on Monday
  const startDay = monthStart.getDay(); // 0=Sun
  const paddingBefore = startDay === 0 ? 6 : startDay - 1;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <PageHeader title="Hearing Calendar" breadcrumbs={[{ label: "Dashboard", path: "/" }, { label: "Hearing Calendar" }]} />
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 border border-primary/20 rounded-lg px-3 py-1.5">
            <span className="text-sm font-bold text-primary">{thisMonthCount}</span>
            <span className="text-xs text-muted-foreground ml-1">hearings this month</span>
          </div>
        </div>
      </div>

      {/* Calendar Card */}
      <div className="bg-card border border-border shadow-sm rounded-xl overflow-hidden">
        {/* Month Navigation */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-muted/10">
          <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div className="text-center">
            <h2 className="text-lg font-bold text-foreground">{format(currentMonth, "MMMM yyyy")}</h2>
            <p className="text-xs text-muted-foreground">{hearings.length} total upcoming hearings</p>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>

        {/* Week days header */}
        <div className="grid grid-cols-7 border-b border-border bg-muted/20">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(d => (
            <div key={d} className="text-center py-2 text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
              {d}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7">
          {/* Padding cells */}
          {Array.from({ length: paddingBefore }).map((_, i) => (
            <div key={`pad-${i}`} className="min-h-[100px] border-r border-b border-border/50 bg-muted/5" />
          ))}

          {/* Day cells */}
          {days.map(day => {
            const key = format(day, "yyyy-MM-dd");
            const dayHearings = hearingsByDate[key] || [];
            const isCurrentDay = isToday(day);

            return (
              <div
                key={key}
                className={`min-h-[110px] border-r border-b border-border/50 p-1.5 transition-colors ${
                  isCurrentDay ? "bg-primary/5 ring-2 ring-inset ring-primary/30" : "hover:bg-muted/20"
                }`}
              >
                {/* Day number */}
                <div className={`text-right mb-1 ${isCurrentDay ? "font-bold text-primary" : "text-foreground"}`}>
                  <span className={`text-xs font-semibold ${isCurrentDay ? "bg-primary text-white px-1.5 py-0.5 rounded-full" : ""}`}>
                    {format(day, "d")}
                  </span>
                  {dayHearings.length > 0 && (
                    <span className="ml-1 text-[9px] bg-primary/10 text-primary px-1 py-0.5 rounded-full font-bold">{dayHearings.length}</span>
                  )}
                </div>

                {/* Hearings */}
                <div className="space-y-0.5 overflow-y-auto max-h-[80px] custom-scrollbar">
                  {dayHearings.slice(0, 3).map((h: any) => (
                    <Link
                      key={h.id}
                      to={`/cases/${h.id}`}
                      className="block px-1.5 py-0.5 rounded text-[10px] font-bold truncate bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors"
                      title={`${h.case_number} - ${h.title}`}
                    >
                      {h.case_number}
                    </Link>
                  ))}
                  {dayHearings.length > 3 && (
                    <p className="text-[9px] text-muted-foreground font-bold text-center">+{dayHearings.length - 3} more</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Today's Hearings Detail */}
      {(() => {
        const todayKey = format(new Date(), "yyyy-MM-dd");
        const todayHearings = hearingsByDate[todayKey] || [];
        if (todayHearings.length === 0) return null;
        return (
          <div className="bg-card border border-amber-200 dark:border-amber-700 shadow-sm rounded-xl p-5">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2 mb-3">
              <Gavel className="w-4 h-4 text-amber-600" />
              Today's Hearings ({todayHearings.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {todayHearings.map((h: any) => (
                <Link key={h.id} to={`/cases/${h.id}`} className="p-3 rounded-lg border border-border hover:bg-muted/20 transition-colors">
                  <p className="text-sm font-bold text-foreground truncate">{h.case_number}</p>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{h.title}</p>
                  <p className="text-[10px] text-amber-600 font-medium mt-1">{h.court_name || "Court"} • {h.case_stage || "—"}</p>
                </Link>
              ))}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
