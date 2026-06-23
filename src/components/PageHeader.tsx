import { Home, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

interface PageHeaderProps {
  title: string;
  breadcrumbs: { label: string; path?: string }[];
}

export function PageHeader({ title, breadcrumbs }: PageHeaderProps) {
  return (
    <div>
      {/* Breadcrumb trail */}
      <div className="flex items-center gap-1 text-[11px] text-muted-foreground mb-1.5">
        <Link to="/" className="hover:text-foreground transition-colors">
          <Home className="w-3 h-3" />
        </Link>
        {breadcrumbs.map((crumb, i) => (
          <span key={i} className="flex items-center gap-1">
            <ChevronRight className="w-2.5 h-2.5 opacity-40" />
            {crumb.path ? (
              <Link to={crumb.path} className="hover:text-foreground transition-colors">
                {crumb.label}
              </Link>
            ) : (
              <span className="text-foreground/60">{crumb.label}</span>
            )}
          </span>
        ))}
      </div>

      {/* Page title */}
      <h1 className="font-serif text-[1.6rem] text-foreground leading-tight">{title}</h1>

      {/* Gold accent rule */}
      <div className="mt-2 w-8 h-[2px] rounded-full bg-amber-400/70" />
    </div>
  );
}
