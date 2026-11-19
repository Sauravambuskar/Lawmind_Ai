import { LegalList, LegalPolicyLayout, LegalSection } from "@/components/legal/LegalPolicyLayout";
import { LEGAL_BUSINESS_NAME } from "@/lib/constants";

const effectiveDate = "19 November 2026";

export default function CopyrightPolicyPage() {
  return (
    <LegalPolicyLayout
      title="Copyright & Ownership Policy"
      summary="This policy identifies ownership of LawMind and explains the permitted use of its software, design, content and brand assets."
      effectiveDate={effectiveDate}
    >
      <LegalSection title="1. Ownership of LawMind">
        <p><strong>LawMind belongs to {LEGAL_BUSINESS_NAME}.</strong> {LEGAL_BUSINESS_NAME} is a sole proprietorship and owns and operates LawMind as its software product and brand. LawMind is not a separate incorporated entity.</p>
        <p>Except for customer content and identified third-party materials, the LawMind software and original product materials are owned by or licensed to CoreLearn.</p>
      </LegalSection>

      <LegalSection title="2. Protected materials">
        <p>Protected materials may include:</p>
        <LegalList>
          <li>source code, object code, software architecture and databases;</li>
          <li>interface layouts, visual design, graphics, icons and original artwork;</li>
          <li>documentation, workflows, templates and original written content;</li>
          <li>the LawMind name, product identity and associated brand presentation; and</li>
          <li>compilations, reports and other original product materials.</li>
        </LegalList>
        <p>Protection applies under the Copyright Act, 1957 and other applicable intellectual-property laws, subject to lawful exceptions and third-party rights.</p>
      </LegalSection>

      <LegalSection title="3. Limited right to use the service">
        <p>During an authorised subscription, engagement or evaluation, CoreLearn grants the approved user a limited, non-exclusive, non-transferable and revocable right to access LawMind for the user’s internal professional or business purpose. This is a right to use the service, not a sale or transfer of the software or its intellectual property.</p>
      </LegalSection>

      <LegalSection title="4. Restrictions">
        <p>Unless permitted by law or authorised in writing, no person may copy, reproduce, republish, distribute, sell, sublicense, frame, mirror, scrape, reverse engineer, decompile, create derivative products from, remove ownership notices from, or commercially exploit LawMind or a substantial part of it.</p>
      </LegalSection>

      <LegalSection title="5. Customer and user content">
        <p>Customers and users retain their rights in documents, records, logos and other content they lawfully provide. They grant CoreLearn only the permissions reasonably necessary to host, process, reproduce and display that content for operating LawMind and providing the requested service.</p>
        <p>Users must not upload material they do not have the right to use.</p>
      </LegalSection>

      <LegalSection title="6. Third-party materials">
        <p>Open-source software, libraries, fonts, images, court information, integrations and other third-party materials remain subject to their respective licences and ownership notices. Their inclusion does not transfer ownership to CoreLearn or the user.</p>
      </LegalSection>

      <LegalSection title="7. Brand use">
        <p>The LawMind and CoreLearn names, logos and product presentation may not be used in a way that suggests sponsorship, affiliation or endorsement without written permission. Genuine references to the product must be accurate and must not mislead users about ownership or source.</p>
      </LegalSection>

      <LegalSection title="8. Reporting infringement">
        <p>A copyright or ownership concern should be reported through the official CoreLearn/LawMind contact details stated in the applicable service agreement, invoice or authorised business communication. The report should identify the protected work, the disputed material, its location, the claimant’s authority and sufficient contact information for verification.</p>
      </LegalSection>

      <LegalSection title="9. Reservation of rights">
        <p>All rights not expressly granted are reserved by {LEGAL_BUSINESS_NAME} and the respective third-party rights holders. Nothing in this policy waives any right or remedy available under applicable law or contract.</p>
      </LegalSection>
    </LegalPolicyLayout>
  );
}
