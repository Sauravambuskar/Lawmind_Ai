import { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { AppHeader } from "./AppHeader";
import { useIsMobile } from "@/hooks/use-mobile";

export function AppLayout() {
  const isMobile = useIsMobile();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Auto-collapse on mobile
  useEffect(() => {
    if (isMobile) setCollapsed(true);
  }, [isMobile]);

  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      {/* Mobile overlay */}
      {isMobile && mobileOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 transition-opacity" onClick={() => setMobileOpen(false)} />
      )}

      <AppSidebar
        collapsed={isMobile ? !mobileOpen : collapsed}
        onToggle={() => isMobile ? setMobileOpen(!mobileOpen) : setCollapsed(!collapsed)}
        isMobile={isMobile}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      <div className={`transition-all duration-300 ease-in-out ${isMobile ? "ml-0" : collapsed ? "ml-[64px]" : "ml-60"} flex flex-col min-h-screen`}>
        <AppHeader onToggleSidebar={() => isMobile ? setMobileOpen(!mobileOpen) : setCollapsed(!collapsed)} />
        <main className="flex-1 p-4 md:p-6 xl:p-8">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

