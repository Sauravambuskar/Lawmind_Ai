import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Download, Sparkles, FileSignature, ScrollText, Pencil, Copy } from "lucide-react";
import { toast } from "sonner";
import { jsPDF } from "jspdf";

// ── Template Definitions ──────────────────────────────────────────────
interface TemplateField {
  key: string;
  label: string;
  placeholder: string;
  required?: boolean;
  type?: "text" | "date" | "textarea" | "select";
  halfWidth?: boolean;
  options?: string[];
}

// Pre-filled court name options
const COURT_OPTIONS = [
  "Hon'ble ___ th Addl. C.J.M., Akola",
  "Hon'ble J.M.F.C., Akola",
  "Hon'ble ___ th Addl. C.J.M., Washim",
  "Hon'ble Civil Judge Senior Division, Washim",
  "Hon'ble Civil Judge Junior Division, Akola",
  "District and Session Court, Akola",
  "Hon'ble ___ th Addl. Sessions Judge, Akola",
  "Other (type below)",
];

interface DocTemplate {
  id: string;
  label: string;
  icon: any;
  description: string;
  category: "criminal" | "civil" | "general";
  fields: TemplateField[];
  generate: (values: Record<string, string>) => string;
}

const TEMPLATES: DocTemplate[] = [
  {
    id: "issue_process",
    label: "Application for Issue Process (Sec. 204 CrPC)",
    icon: FileSignature,
    description: "Application for passing issue process order U/S 204 of Cr.P.C.",
    category: "criminal",
    fields: [
      { key: "courtName", label: "Court Name", placeholder: "Select court...", required: true, type: "select" as const, options: COURT_OPTIONS },
      { key: "caseNumber", label: "SCC No.", placeholder: "e.g. SCC 123/2024", required: true, halfWidth: true },
      { key: "filingFor", label: "F.F.", placeholder: "e.g. F.F.", halfWidth: true },
      { key: "complainant", label: "Complainant", placeholder: "Name of Complainant", required: true },
      { key: "accused", label: "Accused / Opposite Party", placeholder: "Name of Accused", required: true },
      { key: "orderDate", label: "Date of Order U/S 202", placeholder: "e.g. 21.11.2022", required: true, halfWidth: true },
      { key: "date", label: "Application Date", placeholder: "", type: "date", halfWidth: true },
      { key: "place", label: "Place", placeholder: "e.g. Akola", halfWidth: true },
      { key: "advocateName", label: "Counsel Name", placeholder: "Advocate Name", halfWidth: true },
      { key: "additionalFacts", label: "Additional Facts (optional)", placeholder: "Any extra facts to include...", type: "textarea" },
    ],
    generate: (v) => {
      const date = v.date ? new Date(v.date).toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" }) : "____/____/________";
      return `BEFORE THE HON'BLE ${v.courtName?.toUpperCase() || "________________"}

${v.caseNumber || "SCC. ____/____"}                                              ${v.filingFor || "F.F."}

${v.complainant || "________________"}
                              ...Complainant
                    vs
${v.accused || "________________"}
                              ...Accused

APPLICATION FOR PASSING ISSUE PROCESS ORDER UNDER SECTION 204 OF Cr.P.C.

The Counsel for complainant most humbly submits as under:

1)  That the present matter is fixed on today's board for report U/S. 202 of Cr.P.C.. It is submitted that on dated ${v.orderDate || "________"} the hon'ble court has passed an order u/s 202 of Crpc. It is submitted that the hon'ble court has not received any report till today of the same. Moreover it is submitted that as per sec 202 of Cr.P.C., the magistrate i.e. presiding officer trying the case may inquire into the case himself. It is submitted that there is no use of waiting for the report as it results in prolonging the matter unnecessarily.

${v.additionalFacts ? `2)  ${v.additionalFacts}\n\n` : ""}Hence considering the above said facts this application may kindly be allowed and inquiry may kindly be done by this hon'ble court itself and issue process order u/s 204 may kindly be passed in the interest of justice.


PRAYER:  It is therefore prayed that considering the above said facts this application may kindly be allowed and inquiry may kindly be done by this hon'ble court itself and issue process order u/s 204 may kindly be passed in the interest of justice.

${v.place || "Akola"}

Date:- ${date}                                          ${v.advocateName || "________________"}
                                                        Counsel for Complainant`;
    },
  },
  {
    id: "replace_name",
    label: "Application for Replacing Authorized Person",
    icon: ScrollText,
    description: "Replace name of authorized person of complainant company (NI Act cases)",
    category: "criminal",
    fields: [
      { key: "courtName", label: "Court Name", placeholder: "Select court...", required: true, type: "select" as const, options: COURT_OPTIONS },
      { key: "caseNumber", label: "SCC No.", placeholder: "e.g. SCC 456/2020", required: true, halfWidth: true },
      { key: "filingFor", label: "F.F.", placeholder: "e.g. F.F.", halfWidth: true },
      { key: "companyName", label: "Complainant Company", placeholder: "e.g. Crystal Crop Protection Pvt. Ltd.", required: true },
      { key: "accused", label: "Accused", placeholder: "Name of Accused", required: true },
      { key: "oldPerson", label: "Outgoing Authorized Person", placeholder: "e.g. Mr. Vijay Ramchandra Ghatole", required: true },
      { key: "newPerson", label: "New Authorized Person", placeholder: "e.g. Mr. Piyushkumar", required: true },
      { key: "resignReason", label: "Reason for Change", placeholder: "e.g. resigned from company", halfWidth: true },
      { key: "date", label: "Date", placeholder: "", type: "date", halfWidth: true },
      { key: "place", label: "Place", placeholder: "e.g. Akola", halfWidth: true },
      { key: "advocateName", label: "Counsel Name", placeholder: "Advocate Name", halfWidth: true },
      { key: "deponentName", label: "Deponent Full Name (Optional)", placeholder: "e.g. Omprakash Laxminarayan Mundhada" },
      { key: "deponentAge", label: "Deponent Age (Optional)", placeholder: "e.g. 52", halfWidth: true },
      { key: "deponentOcc", label: "Deponent Occupation (Optional)", placeholder: "e.g. Service", halfWidth: true },
      { key: "deponentAddress", label: "Deponent Address (Optional)", placeholder: "e.g. R/o. Akola, Tq. Dist- Akola" },
    ],
    generate: (v) => {
      const date = v.date ? new Date(v.date).toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" }) : "____/____/20__";
      return `IN THE COURT OF ${v.courtName?.toUpperCase() || "HON'BLE ________________"}

${v.caseNumber || "SCC NO. ____/20__"}                                           ${v.filingFor || "F.F."}

${v.companyName || "________________"} ---- V/S ---- ${v.accused || "________________"}

APPLICATION FOR REPLACING THE NAME OF AUTHORIZED PERSON OF COMPLAINANT

The Counsel for complainant most humbly & respectfully submits as under:-

1]  That in the above said matter complainant Company filed complaint u/s 138 of N.I. ACT through its authorized person ${v.oldPerson || "________________"}, now the said complaint is fixed for evidence.

2]  Now thereafter ${v.oldPerson || "________________"} has ${v.resignReason || "resigned from complainant company"}. Now the company has appointed ${v.newPerson || "________________"}, who is the authorized person on behalf of company, hence now the name of ${v.newPerson || "________________"} is replacing at the place of ${v.oldPerson || "________________"}.

3]  There is no any harm cause to any person if the name of authorized person of complainant is changed.

    Hence application may kindly be allowed and the name of ${v.newPerson || "________________"} may kindly be replaced in the place of ${v.oldPerson || "________________"}, in the interest of justice.

PRAYER:-  Application may kindly be allowed and the name of ${v.newPerson || "________________"} may kindly be replaced in the place of ${v.oldPerson || "________________"}, in the interest of justice.

${v.place || "AKOLA"}

DATE: ${date}                                           ${v.advocateName || "________________"}
                                                        COUNSEL FOR COMPLAINANT


────────────────────────────────────────────────────────

AFFIDAVIT

    I, ${v.deponentName || "________________"}, Age-${v.deponentAge || "__"} years, Occ. ${v.deponentOcc || "________"}, ${v.deponentAddress || "R/o. ________________"}, does hereby take an oath and state on solemn affirmation as under:-

    That the content of above paras Nos. 1 to 3 in the Application are drafted by my counsel as per my instruction and the same are read over and explained to me in vernacular language, I admit the same to be true and correct to the best of my own knowledge and belief.

                   Hence this affidavit.

                                                        ………………………
                                                          DEPONENT


VERIFICATION

    I, ${v.deponentName || "________________"}, Age-${v.deponentAge || "__"} years, Occ. ${v.deponentOcc || "________"}, ${v.deponentAddress || "R/o. ________________"}, Deponent, do hereby verify that, the content of above affidavit are true and correct to the best of my knowledge and belief.

    Hence, sworn, signed and verified at ${v.place || "Akola"} on this
    day of ________-20__.

${v.place || "Akola"}                                   ………………………
DATE: ${date}                                             DEPONENT

I know the deponent,
Who has signed before me.

(${v.advocateName || "Advocate"}, ${v.place || "Akola"})`;
    },
  },
];

// ── More Templates (Civil) ────────────────────────────────────────────
TEMPLATES.push(
  {
    id: "file_documents",
    label: "Application to File Documents",
    icon: FileText,
    description: "Permission to file documents on record in civil suit",
    category: "civil",
    fields: [
      { key: "courtName", label: "Court Name", placeholder: "Select court...", required: true, type: "select" as const, options: COURT_OPTIONS },
      { key: "caseNumber", label: "Case No.", placeholder: "e.g. R.C.S. No. 227/2024", required: true, halfWidth: true },
      { key: "filingFor", label: "F.F. / Next Date", placeholder: "e.g. F.F. 16/12/2025", halfWidth: true },
      { key: "plaintiff", label: "Plaintiff Name", placeholder: "e.g. Miss Rajeshri", required: true },
      { key: "defendant", label: "Defendant(s)", placeholder: "e.g. Rambhau & Others", required: true },
      { key: "suitType", label: "Suit Filed For", placeholder: "e.g. grant of temporary Injunction along with other relief" },
      { key: "exhibitNo", label: "Hearing Below Exhibit", placeholder: "e.g. Exh. 5", halfWidth: true },
      { key: "docPurpose", label: "Purpose of Filing Documents", placeholder: "e.g. real controversy involved in the matter", type: "textarea" },
      { key: "date", label: "Date", placeholder: "", type: "date", halfWidth: true },
      { key: "place", label: "Place", placeholder: "e.g. Akola", halfWidth: true },
      { key: "advocateName", label: "Counsel Name", placeholder: "Advocate Name", halfWidth: true },
    ],
    generate: (v) => {
      const date = v.date ? new Date(v.date).toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" }) : "____/____/________";
      return `IN THE COURT OF HON'BLE ${v.courtName?.toUpperCase() || "________________"}

${v.caseNumber || "R.C.S. No. ____/____"}                            ${v.filingFor || "F.F. ____/____/____"}

${v.plaintiff || "________________"}

                              ….Plaintiff
                    Versus

${v.defendant || "________________"}

                              ….Defendant(s)

APPLICATION FOR GRANT OF PERMISSION TO FILE THE DOCUMENTS

The counsel for plaintiff most humbly submits as under,

    That, the Plaintiff has filed the present suit for ${v.suitType || "________________"}. That, the matter is kept on today for hearing${v.exhibitNo ? ` below ${v.exhibitNo}` : ""}. That, the Plaintiff wants to file some material documents on record which are ${v.docPurpose || "real controversy involved in the matter"} and therefore, plaintiff may kindly be permitted to file the documents on record in the interest of justice.

PRAYER:  An application may kindly be allowed and plaintiff may kindly be permitted to file the documents on record in the interest of justice.



${v.place || "Akola"}

Date: ${date}                                           ${v.plaintiff || "________________"}
                                                        Plaintiff



                                                        ${v.advocateName || "________________"}
                                                        Counsel for Plaintiff`;
    },
  },
  {
    id: "list_documents",
    label: "List of Documents",
    icon: ScrollText,
    description: "List of documents filed on behalf of party in civil suit",
    category: "civil",
    fields: [
      { key: "courtName", label: "Court Name", placeholder: "Select court...", required: true, type: "select" as const, options: COURT_OPTIONS },
      { key: "caseNumber", label: "Case No.", placeholder: "e.g. R.C.S. No. 227/2024", required: true, halfWidth: true },
      { key: "filingFor", label: "F.F. / Next Date", placeholder: "e.g. F.F. 16/12/2025", halfWidth: true },
      { key: "plaintiff", label: "Plaintiff Name", placeholder: "e.g. Miss Rajeshri", required: true },
      { key: "defendant", label: "Defendant(s)", placeholder: "e.g. Rambhau & Others", required: true },
      { key: "partyType", label: "Documents on behalf of", placeholder: "e.g. Plaintiff", halfWidth: true },
      { key: "documentsList", label: "Documents (one per line: Sr.No | Particulars | Date)", placeholder: "1 | Notice | 09/09/2024\n2 | Complaint to Chief Secretary | 26/11/2024\n3 | Writ Petition with Order | 06/08/2025", required: true, type: "textarea" },
      { key: "date", label: "Date", placeholder: "", type: "date", halfWidth: true },
      { key: "place", label: "Place", placeholder: "e.g. Akola", halfWidth: true },
      { key: "advocateName", label: "Counsel Name", placeholder: "Advocate Name", halfWidth: true },
    ],
    generate: (v) => {
      const date = v.date ? new Date(v.date).toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" }) : "____/____/________";
      const docs = (v.documentsList || "").split("\n").filter(Boolean).map(line => {
        const parts = line.split("|").map(p => p.trim());
        return { sr: parts[0] || "", particulars: parts[1] || "", docDate: parts[2] || "--" };
      });
      const maxPartLen = Math.max(14, ...docs.map(d => d.particulars.length));
      const tableHeader = `  SR. NO.    PARTICULARS${" ".repeat(Math.max(0, maxPartLen - 11))}    DATE`;
      const tableSep = "  " + "\u2500".repeat(8) + "  " + "\u2500".repeat(maxPartLen + 4) + "  " + "\u2500".repeat(12);
      const tableRows = docs.map(d =>
        `  ${d.sr.padEnd(8)}  ${d.particulars.padEnd(maxPartLen + 4)}  ${d.docDate}`
      ).join("\n");
      return `IN THE COURT OF HON'BLE ${v.courtName?.toUpperCase() || "________________"}

${v.caseNumber || "R.C.S. No. ____/____"}                            ${v.filingFor || "F.F. ____/____/____"}

${v.plaintiff || "________________"} ….Versus…. ${v.defendant || "________________"}

LIST OF DOCUMENTS ON BEHALF OF ${(v.partyType || "PLAINTIFF").toUpperCase()}

${tableHeader}
${tableSep}
${tableRows}
${tableSep}


${v.place || "Akola"}

Date: ${date}                                           ${v.plaintiff || "________________"}
                                                        ${v.partyType || "Plaintiff"}



                                                        ${v.advocateName || "________________"}
                                                        Counsel for ${v.partyType || "Plaintiff"}`;
    },
  },
  {
    id: "pursis",
    label: "Pursis",
    icon: FileSignature,
    description: "Pursis for Civil Judge Senior Division, Washim",
    category: "civil",
    fields: [
      { key: "caseNumber", label: "R.C.S. No.", placeholder: "e.g. R.C.S. No. 227/2024", required: true, halfWidth: true },
      { key: "filingFor", label: "F.F. Date", placeholder: "e.g. 16/12/2025", halfWidth: true },
      { key: "plaintiff", label: "Plaintiff Name", placeholder: "e.g. Miss Rajeshri", required: true },
      { key: "defendant", label: "Defendant(s)", placeholder: "e.g. Rambhau & Others", required: true },
      { key: "pursisBody", label: "Pursis Body (submission text)", placeholder: "Enter the specific submission here...", required: true, type: "textarea" },
      { key: "date", label: "Date", placeholder: "", type: "date", halfWidth: true },
      { key: "place", label: "Place", placeholder: "e.g. Akola", halfWidth: true },
      { key: "advocateName", label: "Counsel for Plaintiff", placeholder: "Advocate Name", halfWidth: true },
    ],
    generate: (v) => {
      const date = v.date ? new Date(v.date).toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" }) : "____/____/________";
      return `IN THE COURT OF HON'BLE CIVIL JUDGE SENIOR DIVISION WASHIM

${v.caseNumber || "R.C.S. No. ____/____"}                             F.F. ${v.filingFor || "____/____/____"}

${v.plaintiff || "________________"}
\u2026.Versus\u2026.
${v.defendant || "________________"}

PURSIS

The applicant respectfully submits that ${v.pursisBody || "________________"}

Hence, the present pursis is submitted for the kind perusal and record of this Hon'ble Court.


${v.place || "Akola"}
Date. ${date}                                                ${v.plaintiff || "________________"}
                                                             Plaintiff



                                                             ${v.advocateName || "________________"}
                                                             Counsel for Plaintiff`;
    },
  }
);

// ── Court Document Templates (Criminal - from system prompt §6) ───────
TEMPLATES.push(
  {
    id: "warrant_bailable",
    label: "Warrant (Bailable / Non-Bailable) - Sec. 75 CrPC",
    icon: FileSignature,
    description: "Bailable or Non-Bailable Warrant, JMFC Akola (two copies as per court format)",
    category: "criminal",
    fields: [
      { key: "warrantType", label: "Warrant Type", placeholder: "BAILABLE or NON-BAILABLE", required: true, halfWidth: true },
      { key: "sccNo", label: "SCC No.", placeholder: "e.g. SCC 123/2024", required: true, halfWidth: true },
      { key: "complainant", label: "Complainant", placeholder: "Name of Complainant", required: true },
      { key: "accused", label: "Accused (Vs)", placeholder: "Name of Accused", required: true },
      { key: "ffDate", label: "F.F. Date", placeholder: "e.g. ____/___/2024", halfWidth: true },
      { key: "whereasText", label: "Whereas (charge details)", placeholder: "e.g. Full name & address of accused", type: "textarea" },
      { key: "bailAmount", label: "Bail Amount (Rs.)", placeholder: "e.g. 10,000", halfWidth: true },
      { key: "attendDate", label: "Attend Before Date (Dt.)", placeholder: "e.g. 15/03/2025", halfWidth: true },
      { key: "issueDate", label: "Date of Issue", placeholder: "e.g. 01/02/2025", halfWidth: true },
      { key: "policeStation", label: "Police Station", placeholder: "e.g. Ramdaspeth, Akola", halfWidth: true },
      { key: "courtNo", label: "Court No.", placeholder: "e.g. 3", halfWidth: true },
    ],
    generate: (v) => {
      const warrantType = (v.warrantType || "BAILABLE / NON-BAILABLE").toUpperCase();
      const copy = `BEFORE THE HON'BLE JUDICIAL MAGISTRATE FIRST CLASS, AKOLA (MAHARASHTRA)
         (see Section 75 of Cr.P.C.)
${warrantType} WARRANT
SCC No. ${v.sccNo || "____/____"}              ${v.complainant || "________________"} Vs ${v.accused || "________________"}
F.F. ${v.ffDate || "____/___/2024"}
Whereas ${v.whereasText || "______________________________________________________________________________________________________"}
Stands charged with the offence under Section 138 of N.I. Act. You are hereby directed to arrest the said accused to produce before me on or before mentioned date herein fail not.
         If the accused ${v.accused || "______________________________________"} shall give bail himself in sum of Rs ${v.bailAmount || "_________________"} with one surety in the same amount to attend before me on the Dt. ${v.attendDate || "________________"} and to continue so to attend until otherwise directed by me, he may be released.
Date of Issue: ${v.issueDate || "_____/____/2024"}
Police Station ${v.policeStation || "________________________"}
                                                              (                              )
______________________________________
Judicial Magistrate First Class
Seal                                                          Court No. ${v.courtNo || "___"} Akola, Maharashtra`;

      return `${copy}


─────────────────────────────────────────────────────────────────────────────────────────────────────

${copy}`;
    },
  },
  {
    id: "warrant_crpc_421",
    label: "Warrant for Recovery of Interim Compensation (Sec. 421 CrPC)",
    icon: FileSignature,
    description: "Warrant to District Collector for recovery under Sec. 143A NI Act (two copies)",
    category: "criminal",
    fields: [
      { key: "courtType", label: "Court Type", placeholder: "JMFC or Additional Chief Judicial Magistrate", required: true },
      { key: "courtNo", label: "Court No.", placeholder: "e.g. 3", required: true, halfWidth: true },
      { key: "sccNo", label: "S.C.C. No.", placeholder: "e.g. SCC 456/2023", required: true, halfWidth: true },
      { key: "fixedFor", label: "Fixed For", placeholder: "e.g. 15/03/2025", halfWidth: true },
      { key: "complainant", label: "Complainant", placeholder: "Name of Complainant", required: true },
      { key: "accused", label: "Accused", placeholder: "Name of Accused", required: true },
      { key: "accusedAddress", label: "Accused Address (R/o.)", placeholder: "Full address of accused", type: "textarea" },
      { key: "warrantDay", label: "Day of Warrant", placeholder: "e.g. 10th January 2025", halfWidth: true },
      { key: "twentyPercent", label: "20% Amount (Rs.)", placeholder: "e.g. 50,000", halfWidth: true },
      { key: "chequeAmount", label: "Cheque Amount (Rs.)", placeholder: "e.g. 2,50,000", halfWidth: true },
      { key: "orderDate", label: "Order Dated", placeholder: "e.g. 01/11/2024", halfWidth: true },
      { key: "exhibitNo", label: "Below Exh. (if ACJM)", placeholder: "e.g. Exh. 1", halfWidth: true },
      { key: "issueDay", label: "Issued on Day", placeholder: "e.g. 15th", halfWidth: true },
      { key: "issueMonth", label: "Issued Month", placeholder: "e.g. March", halfWidth: true },
      { key: "issueYear", label: "Issued Year (20__)", placeholder: "e.g. 25", halfWidth: true },
      { key: "collectorAddress", label: "District Collector Address (3 lines)", placeholder: "Line1\nLine2\nLine3", type: "textarea" },
    ],
    generate: (v) => {
      const courtTitle = (v.courtType || "").toUpperCase().includes("ADDITIONAL")
        ? `${v.courtType?.toUpperCase() || "__ ADDITIONAL CHIEF JUDICIAL MAGISTRATE"}, COURT NO.${v.courtNo || "___"}, AKOLA, MAHARASHTRA`
        : `JUDICIAL MAGISTRATE FIRST CLASS, COURT NO.${v.courtNo || "___"}, AKOLA, MAHARASHTRA`;
      const collectorLines = (v.collectorAddress || "__________________\n__________________\n__________________").split("\n");
      const exhLine = (v.courtType || "").toUpperCase().includes("ADDITIONAL") ? ` below Exh${v.exhibitNo || "___"}` : "";

      const copy = `${courtTitle}
WARRANT FOR RECOVERY OF INTERIM COMPENSATION
(See Section 421 of Cr.P.C.)

 S.C.C. NO ${v.sccNo || "____________"}
         Fixed For: ${v.fixedFor || "____________"}

${v.complainant || "___________________________"} versus ${v.accused || "__________________________"}
To,
The District Collector,
${collectorLines[0] || "__________________"}
${collectorLines[1] || "__________________"}
${collectorLines[2] || "__________________"}


Whereas the accused ${v.accused || "____________________________________"}
R/o. ${v.accusedAddress || "______________________________________________________________________________________________________"}
On the day of ${v.warrantDay || "_________"} warrant for recovery of Interim compensation was issued under section 421 of Cr.P.C. as the accused failed to comply the direction to pay 20% amount of Rs.${v.twentyPercent || "___________"} of the cheque of Rs.${v.chequeAmount || "___________"} as per section 143 A of Negotiable Instruments Act, in the present case as per order dated${v.orderDate || "________"}${exhLine}.
Whereas the said accused ${v.accused || "______________________________"}, although required to pay the said Interim compensation, has not paid the same or any part of thereof;
You are hereby authorized and requested to realize the amount of the said Interim compensation as arrears of Land revenue from the movable or immovable property, or both, of the said accused ${v.accused || "_________________________________"} and to certify without delay what you may have done in pursuance of this order.
Issued on today ${v.issueDay || "___"} day of ${v.issueMonth || "_________"} 20${v.issueYear || "__"} with the sign and seal of the court.
Date:-
Court Seal                                                ${courtTitle.includes("ADDITIONAL") ? "__Additional Chief Judicial Magistrate ," : "__Judicial Magistrate First Class,"}
                                                        Court No.${v.courtNo || "___"},Akola, Maharashtra`;

      return `${copy}



─────────────────────────────────────────────────────────────────────────────────────────────────────

${copy}`;
    },
  },
  {
    id: "proclamation_notice",
    label: "Proclamation Notice (Form No. 4, Sec. 82 CrPC)",
    icon: FileSignature,
    description: "Proclamation Notice against accused to remain present - ACJM, Akola",
    category: "criminal",
    fields: [
      { key: "acjmNumber", label: "ACJM Number (e.g. 3rd)", placeholder: "e.g. 3rd", required: true, halfWidth: true },
      { key: "courtNo", label: "Court No.", placeholder: "e.g. 5", required: true, halfWidth: true },
      { key: "sccNo", label: "S.C.C. No.", placeholder: "e.g. SCC 1317/2020", required: true, halfWidth: true },
      { key: "fixedFor", label: "Fixed For", placeholder: "e.g. 10/08/2022", halfWidth: true },
      { key: "complainant", label: "Complainant", placeholder: "Name of Complainant", required: true },
      { key: "accused", label: "Accused", placeholder: "Name of Accused", required: true },
      { key: "accusedAddress", label: "Accused Address (R/o)", placeholder: "Full address of accused", type: "textarea" },
      { key: "appearanceDate", label: "Appearance Date", placeholder: "e.g. 15/04/2025", required: true, halfWidth: true },
      { key: "proclamationDay", label: "Proclamation Day", placeholder: "e.g. 10th", halfWidth: true },
      { key: "proclamationMonth", label: "Proclamation Month", placeholder: "e.g. March", halfWidth: true },
      { key: "proclamationYear", label: "Proclamation Year", placeholder: "e.g. 2025", halfWidth: true },
      { key: "date", label: "Date", placeholder: "", type: "date", halfWidth: true },
    ],
    generate: (v) => {
      const date = v.date ? new Date(v.date).toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" }) : "____/____/________";
      return `FORM NO. 4

${v.acjmNumber || "___"} ADDITIONAL CHIEF JUDICIAL MAGISTRATE, COURT NO. ${v.courtNo || "___"}, AKOLA

PROCLAMATION NOTICE AGAINST THE ACCUSED PERSON TO REMAIN PRESENT

See Section 82 of Cr.P.C.

S.C.C. No. ${v.sccNo || "____________"}
Fixed For: ${v.fixedFor || "____________"}

${v.complainant || "________________"}
                              ...Complainant
                    Versus
${v.accused || "________________"}
                              ...Accused

Whereas the accused ${v.accused || "________________"}, R/o ${v.accusedAddress || "________________"} has done or is subjected to punishment of offence under section 138 of Negotiable Instruments Act, 1881 and it appears that a Non-Bailable Warrant has been issued against the accused ${v.accused || "________________"} who has evaded the execution of the said warrant and the said accused ${v.accused || "________________"} has absconded or is concealing himself / herself to avoid the execution of warrant issued against him / her.

Therefore, this proclamation notice under section 82 of Cr.P.C. is issued directing the accused ${v.accused || "________________"} to appear before this court on dated ${v.appearanceDate || "________________"} at 11:00 AM to answer the said complaint, and if the accused ${v.accused || "________________"} fails to appear at the specified place and specified time, the case will be proceeded against as declared proclaimed offender under section 83 of Cr.P.C.

Hence this Proclamation is issued today on ${v.proclamationDay || "___"} day of ${v.proclamationMonth || "_________"} ${v.proclamationYear || "20__"} under my hand and seal of this Court.

Date: ${date}

Court Seal                                              ${v.acjmNumber || "___"} Additional Chief Judicial Magistrate
                                                        Court No. ${v.courtNo || "___"}, Akola, Maharashtra`;
    },
  },
  {
    id: "show_cause_notice",
    label: "Show Cause Notice to Police Station",
    icon: FileSignature,
    description: "Show cause notice to police for non-execution of warrant (JMFC, Akola)",
    category: "criminal",
    fields: [
      { key: "courtName", label: "Court Name", placeholder: "Select court...", required: true, type: "select" as const, options: COURT_OPTIONS },
      { key: "sccNo", label: "S.C.C. No.", placeholder: "e.g. SCC 1317/2020", required: true, halfWidth: true },
      { key: "ffDate", label: "F.F. Date", placeholder: "e.g. ____/____/2022", halfWidth: true },
      { key: "complainant", label: "Complainant", placeholder: "e.g. AXIS CROP SCIENCE", required: true },
      { key: "accused", label: "Accused (V/S)", placeholder: "e.g. JAI DURGA", required: true },
      { key: "policeStation", label: "Police Station Name", placeholder: "e.g. Police Station Kaithal", required: true },
      { key: "policeAddress", label: "Police Station Address", placeholder: "e.g. Tehsil Road, Main Bazar, Old City, Kaithal, Dist.- Kaithal, Haryana 136027", type: "textarea" },
      { key: "warrantType", label: "Warrant Type Issued", placeholder: "e.g. Bailable Warrant", halfWidth: true },
      { key: "fixedForDate", label: "Warrant Fixed For Date", placeholder: "e.g. 10.08.2022", halfWidth: true },
      { key: "refusedDate", label: "Date Warrant Refused", placeholder: "e.g. 29.06.2022", halfWidth: true },
      { key: "explainByDate", label: "Explain By Date", placeholder: "e.g. _______.2022", halfWidth: true },
      { key: "date", label: "Date", placeholder: "", type: "date", halfWidth: true },
      { key: "place", label: "Place", placeholder: "e.g. Akola", halfWidth: true },
    ],
    generate: (v) => {
      const date = v.date ? new Date(v.date).toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" }) : "____/____/________";
      return `IN THE COURT OF ${v.courtName?.toUpperCase() || "___JMFC, AKOLA"}.

SHOW CAUSE NOTICE

                                                                 S.C.C. NO. ${v.sccNo || "____/____"}
                                            ${v.complainant || "________________"} V/S ${v.accused || "________________"}
                                                                     F. F. ${v.ffDate || "____/____/____"}
TO,
Police Station Incharge,
${v.policeStation || "________________"},
${v.policeAddress || "________________"}

Subject:- Report of warrant issued in S.C.C. NO. ${v.sccNo || "____/____"} in ${v.complainant || "________________"} V/S ${v.accused || "________________"}

That in the above said matter ${v.warrantType || "Bailable Warrant"} was issued accused in the above said matter against the accused and the humdast of the said BW was sent to you which was fixed for ${v.fixedForDate || "________"}. The said warrant you refused on dated ${v.refusedDate || "________"} and the refused article of the same also received to this court. Because of the said refusal of warrant the above said case is being delayed as you refused to comply with the court's order to execute the bailable warrant.

Therefore you are hereby directed to explain that why warrant not served or executed against the said accused person, on or before dated ${v.explainByDate || "_______.____"}.

Date :- ${date}
${v.place || "Akola"}                                          ________________________________,
                                                        ${v.courtName || "___ Judicial Magistrate First Class"}
                                                        District Court, Akola, M.S.
Seal of Court`;
    },
  }
);

// ── General Templates ─────────────────────────────────────────────────
TEMPLATES.push(
  {
    id: "adjournment",
    label: "Adjournment Application",
    icon: ScrollText,
    description: "Application for grant of adjournment (Civil Judge Senior Division, Washim)",
    category: "general",
    fields: [
      { key: "caseNumber", label: "R.C.S. No.", placeholder: "e.g. R.C.S. No. 227/2024", required: true, halfWidth: true },
      { key: "filingFor", label: "F.F. Date", placeholder: "e.g. 16/12/2025", halfWidth: true },
      { key: "plaintiff", label: "Plaintiff / Applicant", placeholder: "e.g. Miss Rajeshri", required: true },
      { key: "defendant", label: "Defendant(s)", placeholder: "e.g. Rambhau & Others", required: true },
      { key: "reason", label: "Reason for Adjournment", placeholder: "e.g. advocate is engaged in another court / medical reasons", type: "textarea" },
      { key: "date", label: "Date", placeholder: "", type: "date", halfWidth: true },
      { key: "place", label: "Place", placeholder: "e.g. Akola", halfWidth: true },
      { key: "advocateName", label: "Counsel for Plaintiff", placeholder: "Advocate Name", halfWidth: true },
    ],
    generate: (v) => {
      const date = v.date ? new Date(v.date).toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" }) : "____/____/________";
      return `IN THE COURT OF HON'BLE CIVIL JUDGE SENIOR DIVISION WASHIM

${v.caseNumber || "R.C.S. No. ____/____"}                             F.F. ${v.filingFor || "____/____/____"}

${v.plaintiff || "________________"}
\u2026.Versus\u2026.
${v.defendant || "________________"}

APPLICATION FOR GRANT OF ADJOURNMENT

The cousel for plaintiff most humbly submits as under,
                                That the above-named matter is listed before this Hon'ble Court on today's board. That, the applicant is unable to proceed with the matter today due to ${v.reason || "___"} and hence seeks adjournment. That the present request is made without any intention to delay the proceedings, and the applicant assures this Hon'ble Court of full cooperation on the next date. Hence adjournment may kindly be granted by allowing this application in the interest of justice.

Prayer: the applicant most respectfully prays that this Hon'ble Court may be pleased to Kindly allow the present application, and Be pleased to grant a adjournment of the matter, in the interest of justice.

${v.place || "Akola"}
Date. ${date}                                                ${v.plaintiff || "________________"}
                                                             Plaintiff



                                                             ${v.advocateName || "________________"}
                                                             Counsel for Plaintiff`;
    },
  },
  {
    id: "personal_exception",
    label: "Application for Personal Exception (Exemption from Appearance)",
    icon: ScrollText,
    description: "Exemption from personal appearance of accused (Civil Judge Senior Division, Washim)",
    category: "general",
    fields: [
      { key: "caseNumber", label: "R.C.S. No.", placeholder: "e.g. R.C.S. No. 227/2024", required: true, halfWidth: true },
      { key: "filingFor", label: "F.F. Date", placeholder: "e.g. 16/12/2025", halfWidth: true },
      { key: "plaintiff", label: "Plaintiff / Applicant", placeholder: "e.g. Miss Rajeshri", required: true },
      { key: "defendant", label: "Defendant(s)", placeholder: "e.g. Rambhau & Others", required: true },
      { key: "accusedNo", label: "Accused No.", placeholder: "e.g. 1", halfWidth: true },
      { key: "reason", label: "Reason for Exemption", placeholder: "e.g. suffering from ill-health / medical difficulty / unavoidable personal difficulty", type: "textarea" },
      { key: "date", label: "Date", placeholder: "", type: "date", halfWidth: true },
      { key: "place", label: "Place", placeholder: "e.g. Akola", halfWidth: true },
      { key: "advocateName", label: "Counsel for Plaintiff", placeholder: "Advocate Name", halfWidth: true },
    ],
    generate: (v) => {
      const date = v.date ? new Date(v.date).toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" }) : "____/____/________";
      const accusedNo = v.accusedNo || "___";
      return `IN THE COURT OF HON'BLE CIVIL JUDGE SENIOR DIVISION WASHIM

${v.caseNumber || "R.C.S. No. ____/____"}                             F.F. ${v.filingFor || "____/____/____"}

${v.plaintiff || "________________"}
\u2026.Versus\u2026.
${v.defendant || "________________"}

APPLICATION FOR GRANT OF ADJOURNMENT

The counsel for plaintiff most humbly submits as under,
That the above-mentioned matter is fixed before this Hon'ble Court on today's board. That Accused No. ${accusedNo} is presently ${v.reason || "suffering from ill-health / medical difficulty / unavoidable personal difficulty"}, and due to the same is unable to remain personally present before this Hon'ble Court today. That the absence of Accused No. ${accusedNo} is neither intentional nor deliberate, and the applicant undertakes to remain present on the next date as directed by this Hon'ble Court. Hence it is requested that exemption from personal appearance may be granted for today, and the same would be in the interest of justice.

Prayer: Hon'ble Court may be pleased to Kindly exempt Accused No. ${accusedNo} from personal appearance for today in the interest of justice by allowing this application.

${v.place || "Akola"}
Date. ${date}                                                ${v.plaintiff || "________________"}
                                                             Plaintiff



                                                             ${v.advocateName || "________________"}
                                                             Counsel for Plaintiff`;
    },
  }
);

// ── Component ─────────────────────────────────────────────────────────
export default function QuickDocsPage() {
  const [selectedId, setSelectedId] = useState<string>("");
  const [values, setValues] = useState<Record<string, string>>({ date: new Date().toISOString().slice(0, 10) });
  const [generatedDoc, setGeneratedDoc] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedDoc, setEditedDoc] = useState("");

  const template = TEMPLATES.find(t => t.id === selectedId);

  const handleSelectTemplate = (id: string) => {
    setSelectedId(id);
    setValues({ date: new Date().toISOString().slice(0, 10) });
    setGeneratedDoc(null);
    setIsEditing(false);
  };

  const handleGenerate = () => {
    if (!template) { toast.error("Select a template first"); return; }
    const missing = template.fields.filter(f => f.required && !values[f.key]);
    if (missing.length > 0) {
      toast.error(`Please fill: ${missing.map(f => f.label).join(", ")}`);
      return;
    }
    const doc = template.generate(values);
    setGeneratedDoc(doc);
    setEditedDoc(doc);
    setIsEditing(false);
    toast.success("Document generated!");
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(isEditing ? editedDoc : (generatedDoc || ""));
    toast.success("Copied to clipboard!");
  };

  const handleDownload = () => {
    const content = isEditing ? editedDoc : (generatedDoc || "");
    if (!content) return;

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginLeft = 25;
    const marginRight = 20;
    const marginTop = 25;
    const marginBottom = 25;
    const usableWidth = pageWidth - marginLeft - marginRight;
    const lineHeight = 6.2;
    let y = marginTop;

    const checkPageBreak = (needed: number) => {
      if (y + needed > pageHeight - marginBottom) {
        doc.addPage();
        y = marginTop;
      }
    };

    doc.setFont("times", "normal");
    doc.setFontSize(12);

    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Detect separator lines
      if (/^[\u2500\u2550]+$/.test(trimmed)) {
        checkPageBreak(6);
        y += 2;
        doc.setDrawColor(150);
        doc.setLineWidth(0.3);
        doc.line(marginLeft, y, pageWidth - marginRight, y);
        y += 4;
        continue;
      }

      // Empty line = spacing
      if (trimmed === "") {
        y += lineHeight * 0.5;
        if (y > pageHeight - marginBottom) { doc.addPage(); y = marginTop; }
        continue;
      }

      // Detect if line is right-aligned (starts with lots of spaces)
      const leadingSpaces = line.length - line.trimStart().length;
      const isRightAligned = leadingSpaces >= 30;
      const isCenterIndented = leadingSpaces >= 15 && leadingSpaces < 30;

      // Detect headings: ALL CAPS lines that are titles
      const isMainTitle = /^(IN THE COURT|BEFORE THE HON|FORM NO)/.test(trimmed);
      const isSectionTitle = /^(APPLICATION FOR|LIST OF|AFFIDAVIT|VERIFICATION|PRAYER|PURSIS|SHOW CAUSE|PROCLAMATION|WARRANT|BAILABLE|NON-BAILABLE)/.test(trimmed);
      const isVersus = /^(vs|versus|\u2026\.?Versus\u2026\.?|\.\.\.\.?versus\.\.\.\.?|v\/s)/i.test(trimmed);
      const isPartyLabel = /^\.\.\.\.(Plaintiff|Defendant|Applicant|Respondent|Complainant|Accused)/i.test(trimmed) || /^\.\.\.(Plaintiff|Defendant|Applicant|Respondent|Complainant|Accused)/i.test(trimmed);

      // Set font style
      if (isMainTitle || isSectionTitle) {
        doc.setFont("times", "bold");
      } else {
        doc.setFont("times", "normal");
      }
      doc.setFontSize(12);

      // Wrap text
      const wrapped: string[] = doc.splitTextToSize(trimmed, usableWidth);

      for (const wLine of wrapped) {
        checkPageBreak(lineHeight);

        if (isMainTitle && wrapped.length <= 2) {
          doc.text(wLine, pageWidth / 2, y, { align: "center" });
        } else if (isSectionTitle && wrapped.length <= 2) {
          doc.text(wLine, pageWidth / 2, y, { align: "center" });
        } else if (isVersus) {
          doc.text(wLine, marginLeft + 30, y);
        } else if (isPartyLabel) {
          doc.text(wLine, marginLeft + 35, y);
        } else if (isRightAligned) {
          doc.text(wLine, pageWidth - marginRight, y, { align: "right" });
        } else if (isCenterIndented) {
          doc.text(wLine, marginLeft + 25, y);
        } else {
          doc.text(wLine, marginLeft, y);
        }
        y += lineHeight;
      }
    }

    // Page numbers
    const totalPages = doc.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      doc.setFont("times", "normal");
      doc.setFontSize(9);
      doc.setTextColor(120);
      doc.text(`Page ${p} of ${totalPages}`, pageWidth / 2, pageHeight - 10, { align: "center" });
      doc.setTextColor(0);
    }

    doc.save(`${template?.label || "document"}.pdf`);
    toast.success("PDF downloaded!");
  };

  const categories = [
    { key: "criminal", label: "Criminal" },
    { key: "civil", label: "Civil" },
    { key: "general", label: "General" },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader title="Quick Docs" breadcrumbs={[{ label: "Dashboard", path: "/" }, { label: "Quick Docs" }]} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Template Selection + Fields */}
        <div className="lg:col-span-1 space-y-4">
          <Card className="border border-border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Select Template</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 max-h-[70vh] overflow-y-auto custom-scrollbar">
              {categories.map(cat => {
                const catTemplates = TEMPLATES.filter(t => t.category === cat.key);
                if (catTemplates.length === 0) return null;
                return (
                  <div key={cat.key}>
                    <p className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground mb-2">{cat.label}</p>
                    {catTemplates.map(t => (
                      <div
                        key={t.id}
                        onClick={() => handleSelectTemplate(t.id)}
                        className={`p-3 rounded-lg cursor-pointer border transition-all mb-2 ${selectedId === t.id ? "border-primary bg-primary/5 shadow-sm" : "border-transparent hover:bg-muted/40"}`}
                      >
                        <div className="flex items-center gap-2">
                          <t.icon className="w-4 h-4 text-primary flex-shrink-0" />
                          <span className="text-sm font-medium leading-tight">{t.label}</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-1 ml-6">{t.description}</p>
                      </div>
                    ))}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        {/* Middle Column: Form Fields */}
        <div className="lg:col-span-1">
          <Card className="border border-border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                {template ? template.label : "Fill Details"}
              </CardTitle>
              {template && <CardDescription className="text-xs">{template.description}</CardDescription>}
            </CardHeader>
            <CardContent className="space-y-3 max-h-[65vh] overflow-y-auto custom-scrollbar">
              {!template ? (
                <p className="text-sm text-muted-foreground py-8 text-center">\u2190 Select a template to begin</p>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    {template.fields.map(f => (
                      <div key={f.key} className={f.halfWidth ? "col-span-1" : "col-span-2"}>
                        <Label className="text-xs font-semibold text-muted-foreground">{f.label}{f.required && " *"}</Label>
                        {f.type === "textarea" ? (
                          <Textarea
                            placeholder={f.placeholder}
                            value={values[f.key] || ""}
                            onChange={e => setValues(p => ({ ...p, [f.key]: e.target.value }))}
                            className="bg-muted/50 text-sm min-h-[70px] mt-1"
                          />
                        ) : f.type === "select" && f.options ? (
                          <div className="space-y-1.5 mt-1">
                            <Select value={values[f.key] || ""} onValueChange={v => setValues(p => ({ ...p, [f.key]: v === "Other (type below)" ? "" : v }))}>
                              <SelectTrigger className="bg-muted/50 text-sm"><SelectValue placeholder={f.placeholder || "Select..."} /></SelectTrigger>
                              <SelectContent>
                                {f.options.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                              </SelectContent>
                            </Select>
                            {(values[f.key] === "" || !f.options.includes(values[f.key] || "")) && (
                              <Input
                                placeholder="Or type custom court name..."
                                value={values[f.key] || ""}
                                onChange={e => setValues(p => ({ ...p, [f.key]: e.target.value }))}
                                className="bg-muted/50 text-sm"
                              />
                            )}
                          </div>
                        ) : (
                          <Input
                            type={f.type || "text"}
                            placeholder={f.placeholder}
                            value={values[f.key] || ""}
                            onChange={e => setValues(p => ({ ...p, [f.key]: e.target.value }))}
                            className="bg-muted/50 text-sm mt-1"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                  <Button onClick={handleGenerate} className="w-full mt-4">
                    <Sparkles className="w-4 h-4 mr-2" /> Generate Document
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Preview */}
        <div className="lg:col-span-1">
          <Card className="border border-border shadow-sm h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" /> Preview
                </CardTitle>
                {generatedDoc && (
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setIsEditing(!isEditing); if (!isEditing) setEditedDoc(generatedDoc); }} title="Edit">
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCopy} title="Copy">
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleDownload} title="Download">
                      <Download className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {generatedDoc ? (
                isEditing ? (
                  <Textarea
                    value={editedDoc}
                    onChange={e => setEditedDoc(e.target.value)}
                    className="font-mono text-xs leading-relaxed min-h-[500px] bg-muted/20 border-border"
                  />
                ) : (
                  <div className="bg-white dark:bg-muted/20 border border-border rounded-lg p-5 min-h-[500px] max-h-[70vh] overflow-y-auto custom-scrollbar">
                    <pre className="whitespace-pre-wrap text-xs font-mono leading-relaxed text-foreground">{generatedDoc}</pre>
                  </div>
                )
              ) : (
                <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
                  <FileText className="w-12 h-12 text-muted-foreground opacity-30 mb-3" />
                  <p className="text-sm font-medium text-muted-foreground">Generated document will appear here</p>
                  <p className="text-xs text-muted-foreground mt-1">Select template \u2192 Fill details \u2192 Generate</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
