import { LegalList, LegalPolicyLayout, LegalSection } from "@/components/legal/LegalPolicyLayout";

const effectiveDate = "19 November 2026";

export default function TermsAndConditionsPage() {
  return (
    <LegalPolicyLayout
      title="Terms & Conditions"
      summary="These terms govern access to and use of LawMind. Please read them before creating an account or using the service."
      effectiveDate={effectiveDate}
    >
      <LegalSection title="1. Acceptance and authority">
        <p>By accessing or using LawMind, you agree to these Terms & Conditions and the Privacy Policy. If you use LawMind for a firm, chamber, organisation or client, you confirm that you are authorised to accept these terms and use the relevant information on its behalf.</p>
        <p>If you do not agree, do not access or use the service.</p>
      </LegalSection>

      <LegalSection title="2. The LawMind service">
        <p>LawMind provides software tools for legal-practice administration, including case, hearing, client, document, task, expense, invoice, reporting and communication workflows. Features may be added, changed, suspended or discontinued as the product develops.</p>
        <p>LawMind is an administrative technology service. It is not a court, government portal, law firm, legal publisher or substitute for independent professional judgment.</p>
      </LegalSection>

      <LegalSection title="3. Accounts and authorised users">
        <LegalList>
          <li>Provide accurate account information and keep it current.</li>
          <li>Keep passwords and access credentials confidential.</li>
          <li>Use only the permissions assigned to you.</li>
          <li>Notify the account administrator of suspected unauthorised access.</li>
          <li>Remain responsible for activity carried out through your account unless prohibited by law.</li>
        </LegalList>
        <p>Account administrators are responsible for inviting users, assigning roles, removing access and ensuring that workspace use complies with professional and organisational duties.</p>
      </LegalSection>

      <LegalSection title="4. Acceptable use">
        <p>You must not use LawMind to break the law; infringe privacy, confidentiality or intellectual-property rights; upload malicious code; gain unauthorised access; interfere with security; misrepresent identity; send spam; scrape the service; or copy, reverse engineer, resell or exploit the software except where expressly permitted in writing.</p>
      </LegalSection>

      <LegalSection title="5. Customer information and confidentiality">
        <p>You retain responsibility for information you or your authorised users enter into LawMind. You confirm that you have a lawful basis and appropriate authority to collect, use, upload and communicate that information. You must apply professional confidentiality, privilege, retention and court-related obligations applicable to your practice.</p>
      </LegalSection>

      <LegalSection title="6. Automated and AI-assisted features">
        <p>Drafts, summaries, suggestions and other automated outputs may be incomplete, outdated or incorrect. They are provided as assistance only. Users must independently review facts, citations, dates, calculations, procedural requirements and legal conclusions before relying on or sharing an output.</p>
        <p>No automated output creates a lawyer-client relationship with CoreLearn or constitutes legal advice from CoreLearn.</p>
      </LegalSection>

      <LegalSection title="7. Communications">
        <p>LawMind may send account, security, service and transactional communications connected with actions requested by a user or services used by an account. Marketing communication, if any, will be handled in accordance with applicable consent, preference and opt-out requirements. Message delivery may depend on telecom networks and third-party providers.</p>
      </LegalSection>

      <LegalSection title="8. Third-party services">
        <p>Some features rely on third-party hosting, storage, database, communication, payment, court-data, artificial-intelligence or other services. Their availability and use may be subject to separate terms. CoreLearn is not responsible for third-party services beyond the extent required by applicable law.</p>
      </LegalSection>

      <LegalSection title="9. Fees, suspension and termination">
        <p>Where a paid plan or service order applies, fees, taxes, billing cycles and renewal terms will be stated in the applicable proposal, invoice or agreement. Access may be restricted or suspended for non-payment, security risk, unlawful use, material breach or conduct that threatens the service or other users.</p>
        <p>On termination, access may end and data may be retained or deleted in accordance with the service agreement, Privacy Policy and applicable obligations.</p>
      </LegalSection>

      <LegalSection title="10. Availability and disclaimers">
        <p>LawMind is provided on an “as available” basis. While reasonable efforts are made to maintain reliability and security, uninterrupted availability, error-free operation, complete data recovery or compatibility with every device or integration is not guaranteed.</p>
      </LegalSection>

      <LegalSection title="11. Liability">
        <p>To the extent permitted by law, CoreLearn will not be liable for indirect, incidental, special or consequential loss, loss of profits, loss of opportunity, or loss arising from professional decisions, user-entered information, third-party services or unauthorised account use. Any liability that cannot lawfully be excluded remains limited only to the extent permitted by applicable law and the governing service agreement.</p>
      </LegalSection>

      <LegalSection title="12. Governing law and changes">
        <p>These terms are governed by the laws of India. Disputes will be subject to the courts or dispute process having competent jurisdiction under the applicable service agreement and law. We may update these terms when the service, business or legal requirements change; continued use after the effective date constitutes acceptance where permitted by law.</p>
      </LegalSection>
    </LegalPolicyLayout>
  );
}
