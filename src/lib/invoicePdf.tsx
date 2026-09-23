import React from "react";
import { Document, Page, Text, View, StyleSheet, pdf } from "@react-pdf/renderer";

function formatCurrency(n: number) {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function numberToWords(num: number): string {
  if (num === 0) return "Zero Rupees Only";
  const a = ["", "One ", "Two ", "Three ", "Four ", "Five ", "Six ", "Seven ", "Eight ", "Nine ", "Ten ", "Eleven ", "Twelve ", "Thirteen ", "Fourteen ", "Fifteen ", "Sixteen ", "Seventeen ", "Eighteen ", "Nineteen "];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  
  const inWords = (n: number): string => {
    let str = "";
    if (n > 9999999) {
      str += inWords(Math.floor(n / 10000000)) + "Crore ";
      n %= 10000000;
    }
    if (n > 99999) {
      str += inWords(Math.floor(n / 100000)) + "Lakh ";
      n %= 100000;
    }
    if (n > 999) {
      str += inWords(Math.floor(n / 1000)) + "Thousand ";
      n %= 1000;
    }
    if (n > 99) {
      str += a[Math.floor(n / 100)] + "Hundred ";
      n %= 100;
    }
    if (n > 0) {
      if (n < 20) str += a[n];
      else {
        str += b[Math.floor(n / 10)];
        if (n % 10 > 0) str += " " + a[n % 10];
        else str += " ";
      }
    }
    return str;
  };
  
  return "INR " + inWords(Math.floor(num)).trim() + " Rupees Only";
}

const borderColor = "#cbd5e1"; // Slate 300
const primaryText = "#0f172a"; // Slate 900
const secondaryText = "#475569"; // Slate 600
const labelText = "#64748b"; // Slate 500

const styles = StyleSheet.create({
  page: {
    padding: 32,
    fontFamily: "Helvetica",
    fontSize: 9,
    color: primaryText,
  },
  watermark: {
    position: "absolute",
    top: 350,
    left: 80,
    opacity: 0.03,
    transform: "rotate(-45deg)",
    fontSize: 110,
    fontFamily: "Helvetica-Bold",
    color: primaryText,
    zIndex: -1,
  },
  bold: {
    fontFamily: "Helvetica-Bold",
  },
  label: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    color: labelText,
    textTransform: "uppercase",
  },
  container: {
    border: `1px solid ${borderColor}`,
    flex: 1,
  },
  topBar: {
    height: 24,
    borderBottom: `1px solid ${borderColor}`,
    flexDirection: "row",
    alignItems: "center",
  },
  topBarLeft: {
    flex: 1,
  },
  topBarCenter: {
    flex: 1,
    textAlign: "center",
  },
  topBarRight: {
    flex: 1,
    textAlign: "right",
    paddingRight: 8,
    color: secondaryText,
    fontSize: 8,
    letterSpacing: 0.5,
  },
  titleText: {
    fontFamily: "Helvetica-Bold",
    fontSize: 12,
    color: "#2563eb",
    letterSpacing: 2,
  },
  companyRow: {
    flexDirection: "row",
    height: 75,
    borderBottom: `1px solid ${borderColor}`,
  },
  companyCol: {
    flex: 2,
    borderRight: `1px solid ${borderColor}`,
    padding: 8,
  },
  metaGrid: {
    flex: 2,
    flexDirection: "row",
    flexWrap: "wrap",
  },
  metaBox: {
    width: "50%",
    height: "50%",
    borderBottom: `1px solid ${borderColor}`,
    borderRight: `1px solid ${borderColor}`,
    padding: 8,
    justifyContent: "center",
  },
  metaBoxNoBorder: {
    borderRight: "none",
  },
  customerBankRow: {
    flexDirection: "row",
    borderBottom: `1px solid ${borderColor}`,
  },
  customerCol: {
    flex: 6,
    padding: 8,
    borderRight: `1px solid ${borderColor}`,
  },
  bankCol: {
    flex: 4,
    padding: 8,
  },
  table: {
    flex: 1,
    flexDirection: "column",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f1f5f9", // Slate 100
    borderBottom: `1px solid ${borderColor}`,
    height: 22,
    alignItems: "center",
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 8,
  },
  col1: { width: "5%", textAlign: "center", borderRight: `1px solid ${borderColor}` },
  col2: { width: "45%", paddingLeft: 8, borderRight: `1px solid ${borderColor}` },
  col3: { width: "10%", textAlign: "center", borderRight: `1px solid ${borderColor}` },
  col4: { width: "15%", textAlign: "right", paddingRight: 8, borderRight: `1px solid ${borderColor}` },
  col5: { width: "10%", textAlign: "center", borderRight: `1px solid ${borderColor}` },
  col6: { width: "15%", textAlign: "right", paddingRight: 8 },
  
  colHeader: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    color: secondaryText,
  },
  tableLine: {
    flex: 1,
    flexDirection: "row",
  },
  totalItemsRow: {
    borderTop: `1px solid ${borderColor}`,
    borderBottom: `1px solid ${borderColor}`,
    padding: 6,
    paddingLeft: 8,
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    color: secondaryText,
  },
  totalsRow: {
    flexDirection: "row",
    height: 18,
    alignItems: "center",
    borderBottom: `1px solid ${borderColor}`,
  },
  totalsRowLabel: {
    flex: 1,
    textAlign: "right",
    paddingRight: 8,
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    color: secondaryText,
  },
  totalsRowValue: {
    width: "15%",
    textAlign: "right",
    paddingRight: 8,
    borderLeft: `1px solid ${borderColor}`,
    fontSize: 9,
  },
  amountInWords: {
    padding: 8,
    fontSize: 8,
    borderBottom: `1px solid ${borderColor}`,
    color: secondaryText,
  },
  footerText: {
    fontSize: 8,
    color: secondaryText,
    marginTop: 12,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  // Page 2 specific
  signatureArea: {
    flexDirection: "row",
    height: 100,
    borderBottom: `1px solid ${borderColor}`,
  },
  sigLeft: {
    flex: 6,
    borderRight: `1px solid ${borderColor}`,
  },
  sigRight: {
    flex: 4,
    padding: 8,
    justifyContent: "space-between",
  },
  termsArea: {
    flexDirection: "row",
    flex: 1,
  },
  termsLeft: {
    flex: 6,
    padding: 10,
    borderRight: `1px solid ${borderColor}`,
  },
  termsRight: {
    flex: 4,
    padding: 10,
  },
});

const InvoiceDocument = ({ invoice }: { invoice: any }) => {
  const invoiceDate = new Date(invoice.created_at).toLocaleDateString("en-IN", { day: '2-digit', month: 'short', year: 'numeric' });
  const dueDate = invoice.due_date ? new Date(invoice.due_date).toLocaleDateString("en-IN", { day: '2-digit', month: 'short', year: 'numeric' }) : "Upon Receipt";
  const clientName = invoice.clients?.name || "—";
  const clientEmail = invoice.clients?.email || "";
  const caseTitle = invoice.cases?.title || "General Legal Services";

  return (
    <Document>
      {/* PAGE 1 */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.watermark}>LAWMIND</Text>
        
        <View style={styles.container}>
          {/* Top Bar */}
          <View style={styles.topBar}>
            <View style={styles.topBarLeft} />
            <View style={styles.topBarCenter}>
              <Text style={styles.titleText}>INVOICE</Text>
            </View>
            <Text style={styles.topBarRight}>ORIGINAL FOR RECIPIENT</Text>
          </View>

          {/* Company Info & Meta */}
          <View style={styles.companyRow}>
            <View style={styles.companyCol}>
              <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 16, letterSpacing: 1 }}>LAWMIND</Text>
              <Text style={{ fontSize: 8, marginTop: 2, color: secondaryText }}>Legal Services & Consultancy</Text>
              <Text style={{ marginTop: 6 }}>Mobile: +1 (555) 123-4567</Text>
              <Text style={{ marginTop: 2 }}>Email: contact@lawmind.com</Text>
              <Text style={{ marginTop: 2 }}>Website: www.lawmind.com</Text>
            </View>
            <View style={styles.metaGrid}>
              <View style={styles.metaBox}>
                <Text style={styles.label}>Invoice #:</Text>
                <Text style={{ marginTop: 4, fontFamily: "Helvetica-Bold" }}>{invoice.invoice_number}</Text>
              </View>
              <View style={[styles.metaBox, styles.metaBoxNoBorder]}>
                <Text style={styles.label}>Invoice Date:</Text>
                <Text style={{ marginTop: 4 }}>{invoiceDate}</Text>
              </View>
              <View style={[styles.metaBox, { width: "100%", borderBottom: "none" }]}>
                <Text style={styles.label}>Due Date:</Text>
                <Text style={{ marginTop: 4 }}>{dueDate}</Text>
              </View>
            </View>
          </View>

          {/* Customer & Bank Details */}
          <View style={styles.customerBankRow}>
            <View style={styles.customerCol}>
              <Text style={styles.label}>Billed To:</Text>
              <Text style={[styles.bold, { marginTop: 6, fontSize: 10 }]}>{clientName}</Text>
              {clientEmail && <Text style={{ marginTop: 4 }}>Email: {clientEmail}</Text>}
            </View>
            <View style={styles.bankCol}>
              <Text style={styles.label}>Bank Details:</Text>
              <Text style={{ marginTop: 6 }}>Bank: HDFC Bank Ltd.</Text>
              <Text style={{ marginTop: 3 }}>A/C No: 50100239481729</Text>
              <Text style={{ marginTop: 3 }}>IFSC: HDFC0001234</Text>
            </View>
          </View>

          {/* Table */}
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.col1, styles.colHeader, { borderRight: "none" }]}>#</Text>
              <View style={[styles.col1, { width: 0, padding: 0 }]} />
              <Text style={[styles.col2, styles.colHeader, { borderRight: "none" }]}>Item</Text>
              <View style={[styles.col1, { width: 0, padding: 0 }]} />
              <Text style={[styles.col3, styles.colHeader, { borderRight: "none" }]}>HSN/SAC</Text>
              <View style={[styles.col1, { width: 0, padding: 0 }]} />
              <Text style={[styles.col4, styles.colHeader, { borderRight: "none" }]}>Rate / Item</Text>
              <View style={[styles.col1, { width: 0, padding: 0 }]} />
              <Text style={[styles.col5, styles.colHeader, { borderRight: "none" }]}>Qty</Text>
              <View style={[styles.col1, { width: 0, padding: 0 }]} />
              <Text style={[styles.col6, styles.colHeader, { borderRight: "none" }]}>Amount</Text>
            </View>
            
            {/* Table Body (Flex line drawing) */}
            <View style={styles.tableLine}>
              <View style={styles.col1}>
                <Text style={{ marginTop: 8 }}>1</Text>
              </View>
              <View style={styles.col2}>
                <Text style={[styles.bold, { marginTop: 8 }]}>Professional Fees / Services Rendered</Text>
                <Text style={{ marginTop: 4, color: secondaryText, lineHeight: 1.3 }}>Case: {caseTitle}</Text>
                {invoice.notes && <Text style={{ marginTop: 2, color: secondaryText, lineHeight: 1.3 }}>Notes: {invoice.notes}</Text>}
              </View>
              <View style={styles.col3}>
                <Text style={{ marginTop: 8 }}>-</Text>
              </View>
              <View style={styles.col4}>
                <Text style={{ marginTop: 8 }}>{formatCurrency(Number(invoice.amount))}</Text>
              </View>
              <View style={styles.col5}>
                <Text style={{ marginTop: 8 }}>1</Text>
              </View>
              <View style={styles.col6}>
                <Text style={{ marginTop: 8 }}>{formatCurrency(Number(invoice.amount))}</Text>
              </View>
            </View>
          </View>

          {/* Totals Section */}
          <View style={styles.totalItemsRow}>
            <Text>Total Items / Qty : 1 / 1</Text>
          </View>
          
          <View style={styles.totalsRow}>
            <Text style={styles.totalsRowLabel}>Tax Amount</Text>
            <Text style={styles.totalsRowValue}>{formatCurrency(Number(invoice.tax_amount ?? 0))}</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsRowLabel}>Total Discount</Text>
            <Text style={styles.totalsRowValue}>0.00</Text>
          </View>
          <View style={[styles.totalsRow, { borderBottom: "none", height: 22, backgroundColor: "#f8fafc" }]}>
            <Text style={[styles.totalsRowLabel, { fontSize: 10, color: primaryText }]}>Total Due</Text>
            <Text style={[styles.totalsRowValue, styles.bold, { fontSize: 10, color: "#2563eb" }]}>₹ {formatCurrency(Number(invoice.total_amount ?? 0))}</Text>
          </View>

          {/* Words */}
          <View style={[styles.amountInWords, { borderBottom: "none", borderTop: `1px solid ${borderColor}` }]}>
            <Text>Total amount (in words): <Text style={styles.bold}>{numberToWords(Number(invoice.total_amount ?? 0))}</Text></Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footerText}>
          <Text>Page 1 / 2 • This is a computer generated document and requires no signature.</Text>
          <Text style={[styles.bold, { color: primaryText }]}>Powered By LawMind</Text>
        </View>
      </Page>

      {/* PAGE 2 */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.watermark}>LAWMIND</Text>
        
        <View style={styles.container}>
          {/* Top Bar */}
          <View style={styles.topBar}>
            <View style={styles.topBarLeft} />
            <View style={styles.topBarCenter}>
              <Text style={styles.titleText}>INVOICE</Text>
            </View>
            <Text style={styles.topBarRight}>ORIGINAL FOR RECIPIENT</Text>
          </View>

          {/* Signature Area */}
          <View style={styles.signatureArea}>
            <View style={styles.sigLeft}></View>
            <View style={styles.sigRight}>
              <Text style={{ textAlign: "right", color: secondaryText }}>For <Text style={[styles.bold, { color: primaryText }]}>LawMind Legal Services</Text></Text>
              <Text style={{ textAlign: "right", color: primaryText }}>Authorized Signatory</Text>
            </View>
          </View>

          {/* Notes & Terms */}
          <View style={styles.termsArea}>
            <View style={styles.termsLeft}>
              <Text style={[styles.label, { color: primaryText }]}>Notes & Instructions:</Text>
              <Text style={{ marginTop: 6, lineHeight: 1.5, color: secondaryText }}>
                {invoice.notes || "Thank you for considering us for your legal needs. We are committed to providing you with a tailored solution that not only meets but exceeds your expectations.\n\nThe following invoice outlines the professional services rendered, tailored specifically to your case requirements, as discussed in our previous communications.\n\nPlease note, we understand that your legal needs may evolve, and we are fully prepared to adapt our services accordingly."}
              </Text>
            </View>
            <View style={styles.termsRight}>
              <Text style={[styles.label, { color: primaryText }]}>Terms and Conditions:</Text>
              <Text style={{ marginTop: 6, lineHeight: 1.5, color: secondaryText }}>
                <Text style={styles.bold}>Payment Terms:</Text> Payment due within 30 days of invoice date.{"\n\n"}
                <Text style={styles.bold}>Services:</Text> Professional legal services provided under standard retainer or case-specific agreements.{"\n\n"}
                <Text style={styles.bold}>Liability:</Text> Liability limited to the extent of professional fees paid.{"\n\n"}
                <Text style={styles.bold}>Governing Law:</Text> Governed by the laws of India, with disputes subject to arbitration.
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.footerText}>
          <Text>Page 2 / 2 • This is a computer generated document and requires no signature.</Text>
          <Text style={[styles.bold, { color: primaryText }]}>Powered By LawMind</Text>
        </View>
      </Page>
    </Document>
  );
};

export async function downloadInvoicePdf(invoice: any) {
  const blob = await pdf(<InvoiceDocument invoice={invoice} />).toBlob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `Invoice_${invoice.invoice_number}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
