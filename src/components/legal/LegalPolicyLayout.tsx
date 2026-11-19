import { useEffect, type ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { Link, NavLink } from "react-router-dom";
import { LEGAL_BUSINESS_NAME } from "@/lib/constants";

const policies = [
  { label: "Privacy Policy", path: "/privacy-policy" },
  { label: "Terms & Conditions", path: "/terms" },
  { label: "Copyright & Ownership", path: "/copyright-policy" },
];

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-slate-200 py-8 first:border-t-0 first:pt-0">
      <h2 className="font-serif text-2xl font-bold tracking-tight text-[#14243b]">{title}</h2>
      <div className="mt-3 space-y-4 text-[15px] leading-7 text-slate-700">{children}</div>
    </section>
  );
}

export function LegalList({ children }: { children: ReactNode }) {
  return <ul className="list-disc space-y-2 pl-5 marker:text-[#7b2433]">{children}</ul>;
}

interface LegalPolicyLayoutProps {
  title: string;
  summary: string;
  effectiveDate: string;
  children: ReactNode;
}

export function LegalPolicyLayout({ title, summary, effectiveDate, children }: LegalPolicyLayoutProps) {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = `${title} | LawMind`;
    return () => {
      document.title = previousTitle;
    };
  }, [title]);

  return (
    <div className="min-h-screen bg-[#eef1f4] text-slate-900">
      <header className="border-b border-white/10 bg-[#14243b] text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Link to="/login" className="flex items-center gap-3 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
            <img src="https://advmdsarda.in/wp-content/uploads/2026/04/img18-1.jpg" alt="LawMind" className="h-9 w-9 rounded-md bg-white object-contain" />
            <span className="font-serif text-lg font-bold">LawMind</span>
          </Link>
          <Link to="/login" className="inline-flex items-center gap-2 text-sm font-medium text-slate-200 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to sign in
          </Link>
        </div>
      </header>

      <div className="border-b border-[#14243b]/10 bg-white">
        <div className="mx-auto max-w-6xl px-5 py-11 sm:px-8 sm:py-14">
          <div className="h-1 w-16 bg-[#7b2433]" />
          <h1 className="mt-6 max-w-4xl font-serif text-4xl font-bold leading-tight tracking-tight text-[#14243b] sm:text-5xl">{title}</h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600">{summary}</p>
          <p className="mt-5 text-sm text-slate-500">Effective date: {effectiveDate}</p>
        </div>
      </div>

      <main className="mx-auto grid max-w-6xl gap-8 px-5 py-10 sm:px-8 lg:grid-cols-[15rem_minmax(0,1fr)] lg:py-14">
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <nav aria-label="Legal policies" className="border border-[#14243b]/15 bg-white p-3 shadow-sm">
            {policies.map((policy) => (
              <NavLink
                key={policy.path}
                to={policy.path}
                className={({ isActive }) => `block border-l-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive ? "border-[#7b2433] bg-[#f6f3f1] text-[#14243b]" : "border-transparent text-slate-600 hover:bg-slate-50 hover:text-[#14243b]"
                }`}
              >
                {policy.label}
              </NavLink>
            ))}
          </nav>
        </aside>

        <article className="min-w-0 bg-white px-6 py-8 shadow-sm sm:px-10 sm:py-10">
          <div className="mb-9 border-l-4 border-[#7b2433] bg-[#f6f3f1] p-5 text-[15px] leading-7 text-slate-700 sm:p-6">
            <p className="font-serif text-xl font-bold text-[#14243b]">About the provider</p>
            <p className="mt-2">
              LawMind is a legal-practice software product owned and operated by <strong>{LEGAL_BUSINESS_NAME}</strong>, a sole proprietorship. LawMind is a product and brand, not a separate incorporated legal entity.
            </p>
          </div>
          {children}
        </article>
      </main>

      <footer className="bg-[#14243b] px-5 py-7 text-center text-xs leading-6 text-slate-300 sm:px-8">
        <p>© {new Date().getFullYear()} {LEGAL_BUSINESS_NAME}. All rights reserved.</p>
        <div className="mt-1 flex flex-wrap justify-center gap-x-4 gap-y-1">
          {policies.map((policy) => <Link key={policy.path} to={policy.path} className="hover:text-white hover:underline">{policy.label}</Link>)}
        </div>
      </footer>
    </div>
  );
}
