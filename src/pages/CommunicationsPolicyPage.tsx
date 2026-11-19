import { useEffect } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Ban,
  BellRing,
  CheckCircle2,
  FileCheck2,
  LockKeyhole,
  MessageSquareText,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import { LEGAL_BUSINESS_NAME } from "@/lib/constants";

const effectiveDate = "19 November 2026";

const messageCategories = [
  {
    title: "Authentication and security",
    text: "One-time passwords, sign-in verification, password recovery, security alerts and account-protection notices requested by the user.",
  },
  {
    title: "Service and transactional",
    text: "Case or hearing reminders, appointment updates, document availability, invoices, payment status and other updates connected with a service the recipient uses or has requested.",
  },
  {
    title: "Promotional",
    text: "Product announcements, offers or marketing messages are sent only where the recipient has provided valid consent or their registered communication preference permits them.",
  },
];

const safeguards = [
  "The CoreLearn or LawMind identity and the purpose of the communication are stated clearly.",
  "Messages are sent through the applicable registered Principal Entity, header and content template.",
  "Template variables are used only for relevant details such as a name, date, matter reference, amount or secure whitelisted link.",
  "LawMind does not use misleading sender identities, conceal promotional content inside service templates or send commercial messages from ordinary 10-digit numbers.",
  "Consent and communication records may be maintained where required for compliance, audit and complaint resolution.",
];

function PolicySection({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof ShieldCheck;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="scroll-mt-24 border-t border-slate-200 py-8 first:border-t-0 first:pt-0">
      <div className="grid gap-4 md:grid-cols-[2.75rem_minmax(0,1fr)]">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#7b2433] text-white shadow-sm">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <h2 className="font-serif text-2xl font-bold tracking-tight text-[#14243b]">{title}</h2>
          <div className="mt-3 space-y-4 text-[15px] leading-7 text-slate-700">{children}</div>
        </div>
      </div>
    </section>
  );
}

export default function CommunicationsPolicyPage() {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = "Communications & Messaging Policy | LawMind";
    return () => {
      document.title = previousTitle;
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#eef1f4] text-slate-900">
      <header className="border-b border-[#14243b]/15 bg-[#14243b] text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Link to="/login" className="flex items-center gap-3 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
            <img
              src="https://advmdsarda.in/wp-content/uploads/2026/04/img18-1.jpg"
              alt="LawMind"
              className="h-9 w-9 rounded-md bg-white object-contain"
            />
            <span className="font-serif text-lg font-bold">LawMind</span>
          </Link>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-200 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to sign in
          </Link>
        </div>
      </header>

      <main>
        <div className="border-b border-[#14243b]/10 bg-white">
          <div className="mx-auto grid max-w-6xl gap-8 px-5 py-12 sm:px-8 md:grid-cols-[minmax(0,1fr)_19rem] md:py-16">
            <div className="max-w-3xl">
              <div className="mb-6 h-1 w-16 bg-[#7b2433]" />
              <h1 className="font-serif text-4xl font-bold leading-tight tracking-tight text-[#14243b] sm:text-5xl">
                Communications &amp; Messaging Policy
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
                How LawMind identifies itself, obtains permission and sends responsible electronic communications to users and clients.
              </p>
            </div>

            <aside className="border-l-4 border-[#7b2433] bg-[#f6f3f1] px-5 py-4 text-sm leading-6 text-slate-700">
              <p className="font-semibold text-[#14243b]">Policy record</p>
              <p className="mt-2">Effective: {effectiveDate}</p>
              <p>Product: LawMind</p>
              <p>Business: {LEGAL_BUSINESS_NAME}</p>
            </aside>
          </div>
        </div>

        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-10 sm:px-8 lg:grid-cols-[15rem_minmax(0,1fr)] lg:py-14">
          <aside className="lg:sticky lg:top-6 lg:self-start">
            <div className="border border-[#14243b]/15 bg-white p-5 shadow-sm">
              <p className="font-serif text-lg font-bold text-[#14243b]">At a glance</p>
              <ul className="mt-4 space-y-3 text-sm leading-5 text-slate-600">
                <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#7b2433]" /> Clear business identity</li>
                <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#7b2433]" /> Purpose-based consent</li>
                <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#7b2433]" /> Registered templates</li>
                <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#7b2433]" /> Opt-out and revocation</li>
                <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#7b2433]" /> Limited data use</li>
              </ul>
            </div>
          </aside>

          <article className="min-w-0 bg-white px-6 py-8 shadow-sm sm:px-10 sm:py-10">
            <div className="mb-10 border-l-4 border-[#7b2433] bg-[#f6f3f1] p-5 sm:p-6">
              <p className="font-serif text-xl font-bold leading-8 text-[#14243b]">
                This product belongs to {LEGAL_BUSINESS_NAME}.
              </p>
              <p className="mt-2 text-[15px] leading-7 text-slate-700">
                {LEGAL_BUSINESS_NAME} is a sole proprietorship. LawMind is its owned and operated legal-practice software product and brand; LawMind is not represented as a separate incorporated legal entity.
              </p>
            </div>

            <PolicySection icon={FileCheck2} title="Purpose and scope">
              <p>
                This policy applies to SMS, voice, email, WhatsApp and similar electronic communications sent in connection with LawMind. It is intended to support transparent communication practices under applicable Indian telecom rules, including the Telecom Commercial Communications Customer Preference Regulations, 2018, as amended.
              </p>
              <p>
                Publication of this policy does not itself register a sender, header, consent or content template and does not guarantee DLT approval. The particulars submitted to an Access Provider must match the legal and trade-name records of {LEGAL_BUSINESS_NAME}.
              </p>
            </PolicySection>

            <PolicySection icon={MessageSquareText} title="Messages we may send">
              <div className="grid gap-4">
                {messageCategories.map((category) => (
                  <div key={category.title} className="border-l-2 border-[#14243b]/20 pl-4">
                    <h3 className="font-semibold text-[#14243b]">{category.title}</h3>
                    <p className="mt-1">{category.text}</p>
                  </div>
                ))}
              </div>
            </PolicySection>

            <PolicySection icon={UserCheck} title="Consent and recipient choice">
              <p>
                Consent must be voluntary, specific to a stated purpose and attributable to the recipient. It may be captured through an approved digital-consent flow, an account or service request, a clear online choice, or another verifiable method permitted by the applicable telecom framework.
              </p>
              <p>
                Providing a mobile number does not by itself authorise unrelated promotional messaging. Where consent is required, the request identifies the CoreLearn or LawMind brand, explains the purpose and scope, and provides a way to withhold or later revoke permission.
              </p>
            </PolicySection>

            <PolicySection icon={BellRing} title="Frequency and timing">
              <p>
                Authentication and service messages are event-based—for example, when a user requests an OTP or when a scheduled hearing or account event requires an update. Promotional frequency is kept reasonable and aligned with the recipient’s consent and registered preferences. LawMind does not intentionally send repetitive messages merely to increase engagement.
              </p>
            </PolicySection>

            <PolicySection icon={Ban} title="Opt-out, revocation and DND">
              <p>
                A recipient may revoke consent or opt out using the instruction provided in the message, by replying <strong>STOP</strong> where that channel supports replies, or through the CoreLearn/LawMind contact channel associated with the service. The request will be recorded and applied within a reasonable operational period.
              </p>
              <p>
                Promotional communication is subject to the recipient’s registered preferences and applicable Do Not Disturb rules. A user-requested OTP or essential security response may still be sent when necessary to complete the action requested by that user.
              </p>
            </PolicySection>

            <PolicySection icon={ShieldCheck} title="DLT and template safeguards">
              <ul className="space-y-3">
                {safeguards.map((item) => (
                  <li key={item} className="flex gap-3">
                    <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-[#7b2433]" aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </PolicySection>

            <PolicySection icon={LockKeyhole} title="Data use and protection">
              <p>
                Contact details and messaging records are used only to operate the requested service, deliver authorised communications, protect accounts, meet legal or regulatory duties, and resolve complaints. Access is limited to authorised personnel and service providers that support message delivery or system operation.
              </p>
              <p>
                LawMind does not sell mobile numbers or messaging consent. Records are retained only for as long as reasonably necessary for the stated purpose, security, contractual obligations, dispute handling or applicable law.
              </p>
            </PolicySection>

            <PolicySection icon={Ban} title="Complaints and corrections">
              <p>
                Recipients may report an unwanted or inaccurate message through the contact method shown in that message or through their LawMind service administrator. They may also use the complaint and preference facilities provided by their telecom service provider, including the channels prescribed by TRAI.
              </p>
              <p>
                CoreLearn may suspend a campaign, correct a template, update consent records or investigate delivery logs when a complaint indicates that a message was unauthorised, misdirected or inconsistent with this policy.
              </p>
            </PolicySection>

            <div className="mt-2 border-t border-slate-200 pt-6 text-sm leading-6 text-slate-500">
              <p>
                Official guidance: {" "}
                <a
                  href="https://www.trai.gov.in/advice-to-senders"
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-[#7b2433] underline underline-offset-2 hover:text-[#591824]"
                >
                  TRAI advice to senders
                </a>
                . If this policy conflicts with applicable law or an Access Provider’s approved code of practice, the applicable requirement prevails.
              </p>
            </div>
          </article>
        </div>
      </main>

      <footer className="border-t border-white/10 bg-[#14243b] px-5 py-6 text-center text-xs leading-5 text-slate-300 sm:px-8">
        This product belongs to {LEGAL_BUSINESS_NAME}. LawMind is an owned software product of the sole proprietorship.
      </footer>
    </div>
  );
}
