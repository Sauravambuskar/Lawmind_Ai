type PdfDocument = import("jspdf").jsPDF;

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN = 16;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const CONTENT_TOP = 29;
const CONTENT_BOTTOM = 279;

const palette = {
  navy: [20, 35, 58] as [number, number, number],
  gold: [193, 145, 52] as [number, number, number],
  ink: [31, 41, 55] as [number, number, number],
  muted: [92, 103, 116] as [number, number, number],
  line: [211, 218, 226] as [number, number, number],
  tableHeader: [235, 239, 244] as [number, number, number],
};

const cleanText = (value: string) => value
  .replace(/\u00a0/g, " ")
  .replace(/[\u2013\u2014]/g, "-")
  .replace(/\u2026/g, "...")
  .replace(/[\u2018\u2019]/g, "'")
  .replace(/[\u201c\u201d]/g, '"')
  .replace(/\u20b9/g, "INR ")
  .replace(/[\u2022\u25cf\u25e6]/g, "-")
  .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "")
  .normalize("NFKD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, " ")
  .replace(/[ \t]+/g, " ")
  .trim();

const stripInlineMarkdown = (value: string) => cleanText(value
  .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
  .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)")
  .replace(/(\*\*|__)(.*?)\1/g, "$2")
  .replace(/(^|\s)[*_]([^*_]+)[*_](?=\s|$)/g, "$1$2")
  .replace(/`([^`]+)`/g, "$1"));

const tableCells = (line: string) => line.trim()
  .replace(/^\|/, "")
  .replace(/\|$/, "")
  .split("|")
  .map(stripInlineMarkdown);

const isTableDivider = (line: string) => {
  const cells = tableCells(line);
  return cells.length > 1 && cells.every((cell) => /^:?-{3,}:?$/.test(cell.replace(/\s/g, "")));
};

const reportTitle = (content: string) => {
  const heading = content.split(/\r?\n/).find((line) => /^#{1,6}\s+/.test(line.trim()));
  return heading ? stripInlineMarkdown(heading.replace(/^#{1,6}\s+/, "")) : "AI Generated Report";
};

export async function buildAiChatPdf(content: string) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const title = reportTitle(content);
  let y = CONTENT_TOP;

  const drawChrome = () => {
    doc.setFillColor(...palette.navy);
    doc.rect(0, 0, PAGE_WIDTH, 18, "F");
    doc.setFillColor(...palette.gold);
    doc.rect(0, 18, PAGE_WIDTH, 1.2, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setCharSpace(0);
    doc.text("LAWMIND AI", MARGIN, 11.5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text("Professional Report", PAGE_WIDTH - MARGIN, 11.5, { align: "right" });
  };

  const nextPage = () => {
    doc.addPage();
    drawChrome();
    y = CONTENT_TOP;
  };

  const ensureSpace = (height: number) => {
    if (y + height > CONTENT_BOTTOM) nextPage();
  };

  const writeText = (
    text: string,
    options: { size?: number; bold?: boolean; color?: [number, number, number]; indent?: number; gap?: number } = {},
  ) => {
    const size = options.size ?? 10;
    const indent = options.indent ?? 0;
    const lineHeight = size * 0.43;
    doc.setFont("helvetica", options.bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(...(options.color ?? palette.ink));
    doc.setCharSpace(0);
    const lines = doc.splitTextToSize(stripInlineMarkdown(text), CONTENT_WIDTH - indent) as string[];
    ensureSpace(Math.max(lineHeight, lines.length * lineHeight) + (options.gap ?? 2.5));
    doc.text(lines, MARGIN + indent, y, { lineHeightFactor: 1.18 });
    y += Math.max(lineHeight, lines.length * lineHeight) + (options.gap ?? 2.5);
  };

  const drawTable = (headers: string[], rows: string[][]) => {
    const columnCount = Math.max(headers.length, ...rows.map((row) => row.length));
    const allRows = [headers, ...rows].map((row) => Array.from({ length: columnCount }, (_, i) => row[i] ?? ""));
    const weights = Array.from({ length: columnCount }, (_, column) => {
      const longest = Math.max(...allRows.map((row) => row[column].length), 8);
      return Math.min(34, Math.max(10, longest));
    });
    const totalWeight = weights.reduce((sum, value) => sum + value, 0);
    const widths = weights.map((weight) => CONTENT_WIDTH * weight / totalWeight);

    const drawRow = (row: string[], header: boolean) => {
      doc.setFont("helvetica", header ? "bold" : "normal");
      doc.setFontSize(8);
      doc.setCharSpace(0);
      const wrapped = row.map((cell, index) => doc.splitTextToSize(cell, widths[index] - 4) as string[]);
      const height = Math.max(9, Math.max(...wrapped.map((lines) => lines.length)) * 3.7 + 3.5);
      if (y + height > CONTENT_BOTTOM) {
        nextPage();
        if (!header) drawRow(headers, true);
      }
      let x = MARGIN;
      row.forEach((_, index) => {
        if (header) {
          doc.setFillColor(...palette.tableHeader);
          doc.rect(x, y, widths[index], height, "F");
        }
        doc.setDrawColor(...palette.line);
        doc.rect(x, y, widths[index], height);
        doc.setTextColor(...palette.ink);
        doc.text(wrapped[index], x + 2, y + 4.5, { lineHeightFactor: 1.12 });
        x += widths[index];
      });
      y += height;
    };

    ensureSpace(14);
    drawRow(allRows[0], true);
    allRows.slice(1).forEach((row) => drawRow(row, false));
    y += 4;
  };

  drawChrome();
  writeText(title, { size: 18, bold: true, gap: 2 });
  writeText(`Generated ${new Date().toLocaleString("en-IN")}`, { size: 8, color: palette.muted, gap: 6 });

  const lines = content.replace(/\r/g, "").split("\n");
  let skippedTitle = false;
  for (let index = 0; index < lines.length;) {
    const line = lines[index].trim();
    if (!line) {
      y += 2;
      index += 1;
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      const headingText = stripInlineMarkdown(heading[2]);
      if (!skippedTitle && headingText === title) {
        skippedTitle = true;
      } else {
        const level = heading[1].length;
        writeText(headingText, { size: level <= 2 ? 14 : level === 3 ? 12 : 10.5, bold: true, gap: 3.5 });
      }
      index += 1;
      continue;
    }

    if (line.includes("|") && index + 1 < lines.length && isTableDivider(lines[index + 1])) {
      const headers = tableCells(line);
      const rows: string[][] = [];
      index += 2;
      while (index < lines.length && lines[index].includes("|") && lines[index].trim()) {
        rows.push(tableCells(lines[index]));
        index += 1;
      }
      drawTable(headers, rows);
      continue;
    }

    const listItem = line.match(/^([-*+]\s+|\d+[.)]\s+)(.+)$/);
    if (listItem) {
      const marker = /^\d/.test(listItem[1]) ? listItem[1].trim() : "-";
      writeText(`${marker} ${listItem[2]}`, { indent: 4, gap: 1.8 });
      index += 1;
      continue;
    }

    const paragraph = [line];
    index += 1;
    while (index < lines.length) {
      const candidate = lines[index].trim();
      if (!candidate || /^#{1,6}\s+/.test(candidate) || /^([-*+]\s+|\d+[.)]\s+)/.test(candidate)) break;
      if (candidate.includes("|") && index + 1 < lines.length && isTableDivider(lines[index + 1])) break;
      paragraph.push(candidate);
      index += 1;
    }
    writeText(paragraph.join(" "));
  }

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(...palette.line);
    doc.line(MARGIN, 285, PAGE_WIDTH - MARGIN, 285);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...palette.muted);
    doc.setCharSpace(0);
    doc.text("LawMind AI - Confidential", MARGIN, 290);
    doc.text(`Page ${page} of ${pages}`, PAGE_WIDTH - MARGIN, 290, { align: "right" });
  }

  return doc;
}

export async function downloadAiChatPdf(content: string) {
  const doc = await buildAiChatPdf(content);
  const date = new Date().toISOString().slice(0, 10);
  doc.save(`lawmind-ai-report-${date}.pdf`);
}
