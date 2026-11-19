import { LegalList, LegalPolicyLayout, LegalSection } from "@/components/legal/LegalPolicyLayout";

const effectiveDate = "19 November 2026";

export default function PrivacyPolicyPage() {
  return (
    <LegalPolicyLayout
      title="Privacy Policy"
      summary="This policy explains what information LawMind collects, why it is used, how it is protected and the choices available to users."
      effectiveDate={effectiveDate}
    >
      <LegalSection title="1. Scope of this policy">
        <p>This Privacy Policy applies to the LawMind website, web application and related services. It covers information handled when a person visits the website, creates or uses an account, communicates with us, or uses features made available through LawMind.</p>
        <p>Law firms and other organisations may use LawMind to manage information for their own professional work. In those situations, the organisation using LawMind is responsible for deciding what information it enters and for ensuring that it has authority to do so.</p>
      </LegalSection>

      <LegalSection title="2. Information we collect">
        <LegalList>
          <li><strong>Account and identity information:</strong> name, email address, telephone number, role, login identifiers and profile information.</li>
          <li><strong>Professional and practice information:</strong> client, case, hearing, document, invoice, expense, task and contact records entered by authorised users.</li>
          <li><strong>Technical information:</strong> browser, device, IP address, session, security, diagnostic and usage information needed to operate and protect the service.</li>
          <li><strong>Communications:</strong> enquiries, support requests, service notices and records of authorised email, SMS, WhatsApp or similar communications.</li>
          <li><strong>Files and integrations:</strong> documents and information a user chooses to upload, generate or exchange through connected services.</li>
        </LegalList>
      </LegalSection>

      <LegalSection title="3. How we use information">
        <LegalList>
          <li>Provide, maintain and improve LawMind and its legal-practice workflows.</li>
          <li>Authenticate users, administer permissions and protect accounts.</li>
          <li>Store and organise records submitted by authorised users.</li>
          <li>Deliver requested reminders, service updates and transactional communications.</li>
          <li>Respond to support, security, legal and regulatory requests.</li>
          <li>Detect misuse, prevent fraud and maintain audit and operational records.</li>
        </LegalList>
        <p>LawMind does not sell personal information or mobile-number consent. Promotional communication, if any, is sent only where permitted by the recipient’s consent and applicable preferences.</p>
      </LegalSection>

      <LegalSection title="4. When information is shared">
        <p>Information may be shared with hosting, database, storage, communication, analytics, security, artificial-intelligence or other technology providers only to the extent needed to operate features selected by the user or account administrator. These providers may process information under their own contractual and privacy obligations.</p>
        <p>Information may also be disclosed when required by law, court order or lawful authority; to protect users or the service; to investigate misuse; or as part of a business restructuring subject to appropriate safeguards.</p>
      </LegalSection>

      <LegalSection title="5. Data retention and deletion">
        <p>Information is retained for as long as an account remains active or as reasonably necessary to provide the service, maintain security and audit records, resolve disputes, enforce agreements and comply with legal or professional obligations. Account administrators control many records stored within their workspace.</p>
        <p>A valid deletion or correction request will be assessed against contractual, professional, evidentiary and legal retention requirements. Backup copies may remain for a limited period before secure deletion or overwrite.</p>
      </LegalSection>

      <LegalSection title="6. Security">
        <p>LawMind uses reasonable administrative, technical and organisational measures designed to protect information, including access controls, authentication, encrypted transmission and restricted service credentials. No internet service can guarantee absolute security, and users must protect their credentials and promptly report suspected unauthorised access.</p>
      </LegalSection>

      <LegalSection title="7. Your choices and rights">
        <p>Subject to applicable law and the authority of the relevant account administrator, a person may request access, correction, updating or deletion of their personal information; withdraw consent where processing depends on consent; or raise a grievance about how information is handled.</p>
        <p>Service and security messages may still be sent when necessary to complete an action requested by the user, protect an account or meet a legal obligation. Recipients may opt out of promotional messages using the method stated in the message or the official service contact channel.</p>
      </LegalSection>

      <LegalSection title="8. Children, external services and changes">
        <p>LawMind is intended for professional and business use and is not directed to children. External websites and integrations are governed by their own terms and privacy practices. We may update this policy when the service or legal requirements change; the updated effective date will be displayed on this page.</p>
      </LegalSection>

      <LegalSection title="9. Privacy and grievance requests">
        <p>Privacy, correction, deletion and grievance requests may be submitted through the LawMind account administrator or through the official CoreLearn/LawMind contact details stated in the applicable service agreement, invoice or authorised business communication. Requests should identify the relevant account and information so they can be verified and handled securely.</p>
      </LegalSection>
    </LegalPolicyLayout>
  );
}
