import { LogOut, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { GlobalSearch } from "@/components/GlobalSearch";
import { NotificationBell } from "@/components/NotificationBell";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
const aiBotIcon = "https://static.naukimg.com/s/0/0/i/job-agent/pwa/v0/agent_icon.gif";
import { format } from "date-fns";
import { getRoleLabel, getRoleBadge, getRoleDot } from "@/hooks/useRole";

export function AppHeader({ onToggleSidebar }: { onToggleSidebar: () => void }) {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();

  const { profile } = useAuth();
  const role = profile?.role ?? 'agent';
  const initials = (profile?.full_name?.charAt(0) || user?.email?.charAt(0) || "U").toUpperCase();
  const displayName = profile?.full_name || user?.email?.split("@")[0] || "User";
  const today = format(new Date(), "EEE, dd MMM yyyy");

  return (
    <header className="sticky top-0 z-30 h-16 bg-background border-b border-border/70 flex items-center justify-between px-4 md:px-6"
      style={{ borderTop: "2px solid hsl(42 58% 52% / 0.35)" }}>

      {/* Left — toggle + search + AI */}
      <div className="flex items-center gap-2 md:gap-3">
        <Button variant="ghost" size="icon" onClick={onToggleSidebar}
          className="text-muted-foreground hover:bg-muted hover:text-foreground shrink-0 rounded-md">
          <Menu className="w-4.5 h-4.5" />
        </Button>

        <div className="w-48 sm:w-64 md:w-80">
          <GlobalSearch />
        </div>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => navigate("/ai-agent")}
              className="hidden sm:flex items-center gap-2.5 px-3.5 py-2 ml-2 rounded-xl
              bg-violet-100/90 border border-violet-300 hover:bg-violet-200/80 hover:border-violet-400 transition-all duration-150
              hover:shadow-md hover:shadow-violet-500/10 active:scale-[0.97]">
              <img src={aiBotIcon} alt="AI" className="w-9 h-9 object-contain rounded-md" />
              <span className="text-[13px] font-extrabold text-violet-700 hidden md:inline tracking-wider uppercase">
                Ask AI
              </span>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom"><p>Open LawMind AI Agent</p></TooltipContent>
        </Tooltip>
      </div>

      {/* Right — date + user + actions */}
      <div className="flex items-center gap-2 md:gap-3">

        {/* Date */}
        <div className="hidden lg:block text-right mr-1">
          <span className="text-[11px] text-muted-foreground font-medium tracking-wide">{today}</span>
        </div>

        <div className="h-6 w-px bg-border hidden sm:block" />

        {/* User info */}
        <div className="hidden md:flex flex-col items-end gap-0.5">
          <span className="text-[12px] font-medium text-foreground leading-none">{displayName}</span>
          <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border ${getRoleBadge(role)} leading-none`}>
            <span className={`inline-block w-1 h-1 rounded-full mr-1 ${getRoleDot(role)}`} />
            {getRoleLabel(role)}
          </span>
        </div>

        {/* Avatar button → profile */}
        <button onClick={() => navigate("/profile")} title="Profile"
          className="w-8 h-8 rounded-full bg-primary/10 border border-primary/25 flex items-center justify-center text-[12px] font-semibold text-primary hover:bg-primary/15 transition-colors shrink-0">
          {initials}
        </button>

        <NotificationBell />



        <Button variant="ghost" size="icon" onClick={signOut} title="Sign out"
          className="text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500 rounded-md shrink-0">
          <LogOut className="w-4 h-4" />
        </Button>
      </div>
    </header>
  );
}
