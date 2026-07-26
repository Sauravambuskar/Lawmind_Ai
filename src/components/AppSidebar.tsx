import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { getRoleLabel, getRoleBadge, getRoleDot } from "@/hooks/useRole";
import { usePermissions } from "@/hooks/usePermissions";
import {
  Home, Users, UserCheck, MessageSquare,
  Calendar, CalendarDays, FileText, Receipt, File, DollarSign,
  ChevronDown, ChevronRight, Scale, Phone, StickyNote,
  Settings2, BarChart3, User, X, BriefcaseBusiness, Bot,
  ListTodo, Sunrise, FolderOpen, FileSignature, Shield,
} from "lucide-react";

const AIAgentIcon = ({ className, strokeWidth, ...props }: { className?: string; strokeWidth?: number }) => (
  <img 
    src="https://static.naukimg.com/s/0/0/i/job-agent/pwa/v0/agent_icon.gif" 
    alt="AI Agent" 
    className={className} 
    style={{ width: "20px", height: "20px", objectFit: "contain", borderRadius: "3px" }} 
    {...props}
  />
);

const navSections = [
  {
    title: "Home",
    items: [
      { label: "Dashboard", icon: Home, path: "/" },
      { label: "Today's Diary", icon: Sunrise, path: "/today" },
      {
        label: "Staff Management", icon: Users, path: "/staff",
        children: [{ label: "Users", path: "/staff/users" }],
      },
    ],
  },
  {
    title: "Practice",
    items: [
      { label: "Clients", icon: UserCheck, path: "/clients" },
      { label: "Advocates", icon: Scale, path: "/advocates" },
      { label: "Advice", icon: MessageSquare, path: "/advice" },
      { label: "Cases", icon: BriefcaseBusiness, path: "/cases" },
      { label: "Hearings", icon: Calendar, path: "/hearings" },
      { label: "Hearing Calendar", icon: CalendarDays, path: "/hearing-calendar" },
      { label: "Evidence", icon: FileText, path: "/evidence" },
      { label: "Invoices", icon: Receipt, path: "/invoices" },
      { label: "Documents", icon: File, path: "/documents" },
      { label: "Important Documents", icon: FolderOpen, path: "/impdocs" },
      { label: "Notice Maker", icon: FileSignature, path: "/notice-maker" },
      { label: "Quick Docs", icon: FileText, path: "/quick-docs" },
      { label: "Expenses", icon: DollarSign, path: "/expenses" },
      { label: "Contacts", icon: Phone, path: "/contacts" },
      { label: "Notes", icon: StickyNote, path: "/notes" },
      { label: "Tasks", icon: ListTodo, path: "/tasks" },
      { label: "AI Agent", icon: AIAgentIcon, path: "/ai-agent" },
    ],
  },
  {
    title: "Administration",
    items: [
      {
        label: "Master Setup", icon: Settings2, path: "/setup",
        children: [
          { label: "Matters", path: "/setup/matters" },
          { label: "Tags", path: "/setup/tags" },
          { label: "Expense Types", path: "/setup/expense-types" },
          { label: "Templates", path: "/setup/templates" },
          { label: "Audit Logs", path: "/setup/logs" },
          { label: "AI Settings", path: "/setup/ai-settings" },
          { label: "Email Settings", path: "/setup/email" },
        ],
      },
      { label: "Reports", icon: BarChart3, path: "/setup/reports" },
      { label: "Permissions", icon: Shield, path: "/setup/permissions" },
      { label: "Profile", icon: User, path: "/profile" },
    ],
  },
];

interface AppSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  isMobile?: boolean;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

function SectionLabel({ title, collapsed }: { title: string; collapsed?: boolean }) {
  if (collapsed) {
    return <div className="my-3 mx-auto w-5 h-px bg-slate-600/60" />;
  }
  return (
    <div className="flex items-center gap-2.5 px-3 mt-3 mb-1.5">
      <div className="h-px flex-1 bg-slate-600/50" />
      <span className="text-[10px] font-bold text-slate-200 uppercase tracking-[0.2em] whitespace-nowrap drop-shadow-md">
        {title}
      </span>
      <div className="h-px flex-1 bg-slate-600/50" />
    </div>
  );
}

function NavItems({
  collapsed = false,
  onNavClick,
  isActive,
  expandedItems,
  toggleExpand,
}: {
  collapsed?: boolean;
  onNavClick?: () => void;
  isActive: (path: string) => boolean;
  expandedItems: string[];
  toggleExpand: (label: string) => void;
}) {
  const { profile } = useAuth();
  const role = profile?.role ?? 'agent';
  const isAdminOrAbove = role === 'admin' || role === 'super_admin';
  const { hasAccess } = usePermissions();

  // Helper to check if a nav item is accessible based on path
  const canAccess = (path: string) => {
    // Always allow dashboard and profile
    if (path === "/" || path === "/profile") return true;
    // Map path to section ID
    const sectionId = path.replace(/^\/setup\//, "").replace(/^\/staff.*/, "staff").replace(/^\//, "");
    return hasAccess(role, sectionId);
  };

  const activeCls = "bg-amber-400/[0.15] text-amber-400 font-bold drop-shadow-md tracking-wide";
  const regularCls = "text-slate-100 font-semibold hover:bg-white/10 hover:text-white drop-shadow-sm tracking-wide";

  return (
    <>
      {navSections.map(section => (
        <div key={section.title}>
          <SectionLabel title={section.title} collapsed={collapsed} />
          <div className="space-y-0.5 px-2">
            {section.items.filter(item => {
              if (item.label === 'Staff Management') return isAdminOrAbove;
              if (item.label === 'Permissions') return isAdminOrAbove;
              return canAccess(item.path);
            }).map(item => (
              <div key={item.label} className="relative">
                {item.children ? (
                  <>
                    <button
                      onClick={() => toggleExpand(item.label)}
                      title={collapsed ? item.label : undefined}
                      className={`w-full flex items-center ${collapsed ? "justify-center px-2" : "justify-between px-3"} py-2 rounded-md text-[13px] transition-colors duration-150 group ${isActive(item.path) ? activeCls : regularCls}`}
                    >
                      <div className="flex items-center gap-2.5">
                        <item.icon className={`w-[16px] h-[16px] shrink-0 ${isActive(item.path) ? "text-amber-400 drop-shadow-md" : "text-slate-300 group-hover:text-white drop-shadow-sm"}`} strokeWidth={isActive(item.path) ? 2.5 : 2} />
                        {!collapsed && <span className="whitespace-nowrap">{item.label}</span>}
                      </div>
                      {!collapsed && (
                        expandedItems.includes(item.label)
                          ? <ChevronDown className="w-4 h-4 text-slate-300 drop-shadow-sm" />
                          : <ChevronRight className="w-4 h-4 text-slate-300 drop-shadow-sm" />
                      )}
                    </button>
                    {!collapsed && expandedItems.includes(item.label) && (
                      <div className="ml-[30px] mt-0.5 mb-1 pl-3 border-l border-slate-600/40 space-y-0.5">
                        {item.children.map(child => (
                          <Link key={child.path} to={child.path} onClick={onNavClick}
                            className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[12.5px] font-semibold tracking-wide transition-colors whitespace-nowrap drop-shadow-sm ${
                              isActive(child.path)
                                ? "text-amber-400 font-bold drop-shadow-md"
                                : "text-slate-200 hover:text-white hover:bg-white/10"
                            }`}>
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isActive(child.path) ? "bg-amber-400 shadow-[0_0_5px_rgba(251,191,36,0.8)]" : "bg-slate-400"}`} />
                            {child.label}
                          </Link>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <Link to={item.path} onClick={onNavClick}
                    title={collapsed ? item.label : undefined}
                    className={`group flex items-center ${collapsed ? "justify-center px-2" : "px-3 gap-2.5"} py-2 rounded-md text-[13px] transition-colors duration-150 ${isActive(item.path) ? activeCls : regularCls}`}>
                    {isActive(item.path) && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[22px] bg-amber-400 rounded-r-full shadow-[0_0_8px_rgba(251,191,36,0.6)]" />
                    )}
                    <item.icon className={`w-[16px] h-[16px] shrink-0 ${isActive(item.path) ? "text-amber-400 drop-shadow-md" : "text-slate-300 group-hover:text-white drop-shadow-sm"}`} strokeWidth={isActive(item.path) ? 2.5 : 2} />
                    {!collapsed && <span className="whitespace-nowrap">{item.label}</span>}
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

function SidebarLogo({ collapsed }: { collapsed?: boolean }) {
  return (
    <div className={`flex items-center ${collapsed ? "justify-center px-4" : "gap-3 px-5"} h-16 border-b border-amber-400/[0.15]`}>
      <img src="https://advmdsarda.in/wp-content/uploads/2026/04/img18-1.jpg" alt="Logo" className="w-8 h-8 object-contain rounded-md shrink-0 shadow-md shadow-amber-600/50 bg-white" />
      {!collapsed && (
        <div className="overflow-hidden">
          <span className="font-serif text-white text-[15px] font-extrabold uppercase tracking-[0.28em] block leading-none whitespace-nowrap drop-shadow-md">
            Lawmind
          </span>
          <span className="text-[9.5px] text-amber-400 tracking-[0.16em] uppercase font-bold leading-none mt-1.5 block whitespace-nowrap drop-shadow-sm">
            Legal Practice Software
          </span>
        </div>
      )}
    </div>
  );
}

function SidebarFooter({ collapsed }: { collapsed?: boolean }) {
  const { profile } = useAuth();
  const role = profile?.role ?? 'agent';

  return (
    <div className={`border-t border-slate-600/30 py-3 ${collapsed ? "px-2 flex flex-col items-center gap-2" : "px-4 flex items-center gap-2.5"}`}>
      {collapsed ? (
        <>
          <div className={`w-2 h-2 rounded-full ${getRoleDot(role)}`} />
          <Scale className="w-3.5 h-3.5 text-slate-600" />
        </>
      ) : (
        <>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-slate-300 font-medium truncate leading-none">
              {profile?.full_name || 'User'}
            </p>
            <span className={`inline-flex items-center gap-1 text-[9px] font-semibold mt-1 px-1.5 py-0.5 rounded border ${getRoleBadge(role)}`}>
              <span className={`w-1 h-1 rounded-full ${getRoleDot(role)}`} />
              {getRoleLabel(role)}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

export function AppSidebar({ collapsed, onToggle, isMobile, mobileOpen, onMobileClose }: AppSidebarProps) {
  const location = useLocation();
  const [expandedItems, setExpandedItems] = useState<string[]>(["Staff Management", "Master Setup"]);

  const toggleExpand = (label: string) => {
    setExpandedItems(prev =>
      prev.includes(label) ? prev.filter(i => i !== label) : [...prev, label]
    );
  };

  const isActive = (path: string) => location.pathname === path;

  if (isMobile) {
    return (
      <aside className={`fixed left-0 top-0 h-full bg-sidebar z-50 w-64 flex flex-col shadow-2xl transition-transform duration-300 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="absolute inset-0 bg-[url('https://img.magnific.com/premium-photo/american-legal-system-law-concept-statue-lady-justice-with-scales-justice-american-flag_1158146-909.jpg?semt=ais_hybrid&w=740&q=80')] bg-cover bg-center opacity-25 pointer-events-none" />
        <div className="relative z-10 flex flex-col h-full w-full">
          <div className="flex items-center justify-between border-b border-amber-400/[0.15]">
            <SidebarLogo />
            <button onClick={onMobileClose} className="mr-4 p-1.5 rounded-md text-slate-300 hover:text-white hover:bg-white/10 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
          <nav className="flex-1 overflow-y-auto py-2 custom-scrollbar">
            <NavItems isActive={isActive} expandedItems={expandedItems} toggleExpand={toggleExpand} onNavClick={onMobileClose} />
          </nav>
          <SidebarFooter />
        </div>
      </aside>
    );
  }

  return (
    <aside className={`fixed left-0 top-0 h-full bg-sidebar z-40 transition-all duration-300 ease-in-out ${collapsed ? "w-[64px]" : "w-60"} flex flex-col`}>
      <div className="absolute inset-0 bg-[url('https://img.magnific.com/premium-photo/american-legal-system-law-concept-statue-lady-justice-with-scales-justice-american-flag_1158146-909.jpg?semt=ais_hybrid&w=740&q=80')] bg-cover bg-center opacity-25 pointer-events-none" />
      <div className="relative z-10 flex flex-col h-full w-full">
        <SidebarLogo collapsed={collapsed} />
        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-2 custom-scrollbar">
          <NavItems collapsed={collapsed} isActive={isActive} expandedItems={expandedItems} toggleExpand={toggleExpand} />
        </nav>
        <SidebarFooter collapsed={collapsed} />
      </div>
    </aside>
  );
}
