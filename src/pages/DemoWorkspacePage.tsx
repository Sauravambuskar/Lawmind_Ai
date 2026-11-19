import { Link } from "react-router-dom";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  LogOut,
  Scale,
  ShieldCheck,
  Users,
} from "lucide-react";
import { LEGAL_BUSINESS_NAME } from "@/lib/constants";

const metrics = [
  { label: "Active matters", value: "24", icon: Scale, note: "6 updated this week" },
  { label: "Upcoming hearings", value: "8", icon: CalendarDays, note: "Next 7 days" },
  { label: "Clients", value: "41", icon: Users, note: "Sample directory" },
  { label: "Documents", value: "126", icon: FileText, note: "Demo records" },
];

const hearings = [
  { case: "Patil v. Deshmukh", court: "District Court, Akola", date: "21 Nov", stage: "Arguments" },
  { case: "Sharma Industries", court: "Civil Court, Washim", date: "24 Nov", stage: "Evidence" },
  { case: "State v. Sample Client", court: "Sessions Court, Akola", date: "27 Nov", stage: "Hearing" },
];

export default function DemoWorkspacePage() {
  return (
    <div className="min-h-screen bg-[#f4f6f8] text-slate-900">
      <header className="border-b border-white/10 bg-[#14243b] text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <img src="https://advmdsarda.in/wp-content/uploads/2026/04/img18-1.jpg" alt="LawMind" className="h-9 w-9 rounded-md bg-white object-contain" />
            <div>
              <p className="font-serif text-lg font-bold leading-none">LawMind</p>
              <p className="mt-1 text-[10px] text-slate-300">Client demonstration</p>
            </div>
          </div>
          <Link to="/login" className="inline-flex items-center gap-2 text-sm text-slate-200 hover:text-white"><LogOut className="h-4 w-4" /> Exit demo</Link>
        </div>
      </header>

      <div className="border-b border-amber-200 bg-amber-50">
        <div className="mx-auto flex max-w-7xl items-start gap-3 px-4 py-3 text-sm text-amber-900 sm:items-center sm:px-6">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 sm:mt-0" />
          <p><strong>Safe demo workspace:</strong> all names, matters and figures on this page are fictional. This demo cannot access or change production data.</p>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-10">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-medium text-[#7b2433]">Welcome, Demo Client</p>
            <h1 className="mt-1 font-serif text-3xl font-bold tracking-tight text-[#14243b] sm:text-4xl">Practice overview</h1>
            <p className="mt-2 text-sm text-slate-600">A sample view of the LawMind legal-practice workspace.</p>
          </div>
          <Link to="/login" className="inline-flex items-center gap-2 self-start rounded-md bg-[#14243b] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#203754]">Request full access <ArrowRight className="h-4 w-4" /></Link>
        </div>

        <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Demo summary">
          {metrics.map(({ label, value, icon: Icon, note }) => (
            <div key={label} className="border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <div><p className="text-sm text-slate-500">{label}</p><p className="mt-2 font-serif text-3xl font-bold text-[#14243b]">{value}</p></div>
                <div className="rounded-full bg-[#f6f3f1] p-2.5 text-[#7b2433]"><Icon className="h-5 w-5" /></div>
              </div>
              <p className="mt-4 text-xs text-slate-500">{note}</p>
            </div>
          ))}
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(18rem,0.75fr)]">
          <section className="border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div><h2 className="font-serif text-xl font-bold text-[#14243b]">Upcoming hearings</h2><p className="mt-1 text-xs text-slate-500">Sample schedule</p></div>
              <CalendarDays className="h-5 w-5 text-[#7b2433]" />
            </div>
            <div className="divide-y divide-slate-100">
              {hearings.map((hearing) => (
                <div key={hearing.case} className="grid gap-2 px-5 py-4 sm:grid-cols-[5rem_minmax(0,1fr)_7rem] sm:items-center">
                  <div className="font-semibold text-[#7b2433]">{hearing.date}</div>
                  <div><p className="font-medium text-slate-900">{hearing.case}</p><p className="mt-1 text-xs text-slate-500">{hearing.court}</p></div>
                  <span className="w-fit rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">{hearing.stage}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2"><Clock3 className="h-5 w-5 text-[#7b2433]" /><h2 className="font-serif text-xl font-bold text-[#14243b]">Today’s workflow</h2></div>
            <ul className="mt-5 space-y-4 text-sm text-slate-700">
              {["Review two hearing briefs", "Upload signed affidavit", "Confirm client appointment", "Prepare weekly expense summary"].map((task, index) => (
                <li key={task} className="flex gap-3"><CheckCircle2 className={`mt-0.5 h-4 w-4 shrink-0 ${index < 2 ? "text-emerald-600" : "text-slate-300"}`} /><span className={index < 2 ? "line-through decoration-slate-400" : ""}>{task}</span></li>
              ))}
            </ul>
          </section>
        </div>
      </main>

      <footer className="mt-8 border-t border-slate-200 bg-white px-5 py-5 text-center text-xs leading-5 text-slate-500">
        <p>This product belongs to {LEGAL_BUSINESS_NAME}.</p>
        <div className="mt-1 flex flex-wrap justify-center gap-x-4 gap-y-1">
          <Link to="/privacy-policy" className="hover:text-[#14243b] hover:underline">Privacy Policy</Link>
          <Link to="/terms" className="hover:text-[#14243b] hover:underline">Terms & Conditions</Link>
          <Link to="/copyright-policy" className="hover:text-[#14243b] hover:underline">Copyright</Link>
        </div>
      </footer>
    </div>
  );
}
