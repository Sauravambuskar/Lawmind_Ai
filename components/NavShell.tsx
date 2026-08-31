"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/campaigns", label: "Campaigns" },
  { href: "/leads", label: "Leads" },
  { href: "/settings", label: "Settings" },
];

export function NavShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen w-full">
      <aside className="hidden w-60 shrink-0 border-r border-slate-200 bg-white md:flex md:flex-col">
        <div className="flex h-16 items-center gap-2 border-b border-slate-200 px-6">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white">
            AI
          </div>
          <span className="text-sm font-semibold text-slate-900">AI Lead Finder</span>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-4">
          {LINKS.map((link) => {
            const active = pathname === link.href || pathname.startsWith(link.href + "/");
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-blue-50 text-blue-700"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-slate-200 p-4 text-xs text-slate-400">
          Self-hosted Firecrawl + Groq
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 md:px-8">
          <div className="flex items-center gap-2 md:hidden">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white">
              AI
            </div>
            <span className="text-sm font-semibold text-slate-900">AI Lead Finder</span>
          </div>
          <nav className="flex gap-4 md:hidden">
            {LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="text-xs font-medium text-slate-600">
                {link.label}
              </Link>
            ))}
          </nav>
          <div />
        </header>
        <main className="flex-1 bg-slate-50 px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
