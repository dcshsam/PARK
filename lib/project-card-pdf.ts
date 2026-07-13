import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { ProjectCard } from "@/lib/project-cards-data";

const navy: [number, number, number] = [18, 39, 72];
const blue: [number, number, number] = [1, 118, 211];
const cyan: [number, number, number] = [16, 185, 201];
const green: [number, number, number] = [22, 163, 74];
const amber: [number, number, number] = [217, 119, 6];
const red: [number, number, number] = [220, 38, 38];
const slate: [number, number, number] = [90, 101, 117];

const healthColor = (health: ProjectCard["health"]) =>
  health === "On track" ? green : health === "At risk" ? amber : red;

export function downloadProjectCardPdf(project: ProjectCard) {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const width = doc.internal.pageSize.getWidth();
  const margin = 38;
  const contentWidth = width - margin * 2;

  doc.setFillColor(...navy);
  doc.rect(0, 0, width, 126, "F");
  doc.setFillColor(...blue);
  doc.rect(0, 0, 8, 126, "F");
  doc.setFillColor(27, 150, 255);
  doc.circle(width - 45, 15, 88, "F");
  doc.setFillColor(32, 91, 155);
  doc.circle(width - 4, 114, 72, "F");

  doc.setTextColor(175, 220, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("WEEKLY PROJECT BRIEF  •  SPARC PORTFOLIO", margin, 27);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.text(project.initiative, margin, 55, { maxWidth: 390 });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`${project.phase}  •  ${project.owner}  •  ${project.clientName || "Client not set"}`, margin, 80);

  doc.setFillColor(...healthColor(project.health));
  doc.roundedRect(margin, 94, 72, 20, 10, 10, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text(project.health.toUpperCase(), margin + 36, 107, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.text(`Prepared ${new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date())}`, width - margin, 107, { align: "right" });

  let y = 149;
  doc.setTextColor(...navy);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("EXECUTIVE SUMMARY", margin, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.2);
  doc.setTextColor(...slate);
  const summaryLines = doc.splitTextToSize(project.summary, contentWidth);
  doc.text(summaryLines, margin, y + 17);
  y += 17 + summaryLines.length * 11 + 10;

  const metrics = [
    { label: "DELIVERY", value: `${project.progress}%`, color: blue },
    { label: "CONFIDENCE", value: `${project.confidence}%`, color: cyan },
    { label: "ROADMAP", value: `${project.currentEvent ?? 1}/8`, color: amber },
    { label: "OPEN / BLOCKED", value: `${project.inProgress} / ${project.blocked}`, color: project.blocked > 2 ? red : green },
  ];
  const gap = 8;
  const boxWidth = (contentWidth - gap * 3) / 4;
  metrics.forEach((metric, index) => {
    const x = margin + index * (boxWidth + gap);
    doc.setFillColor(246, 249, 252);
    doc.setDrawColor(222, 229, 238);
    doc.roundedRect(x, y, boxWidth, 52, 7, 7, "FD");
    doc.setFillColor(...metric.color);
    doc.roundedRect(x, y, 4, 52, 2, 2, "F");
    doc.setTextColor(...slate);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.8);
    doc.text(metric.label, x + 12, y + 17);
    doc.setTextColor(...navy);
    doc.setFontSize(16);
    doc.text(metric.value, x + 12, y + 39);
  });
  y += 72;

  const leftWidth = 310;
  const rightX = margin + leftWidth + 18;
  const rightWidth = contentWidth - leftWidth - 18;
  doc.setTextColor(...navy);
  doc.setFontSize(10);
  doc.text("6-WEEK DELIVERY TREND", margin, y);
  doc.text("WORKSTREAMS", rightX, y);
  y += 12;

  const chartHeight = 94;
  doc.setFillColor(250, 251, 253);
  doc.roundedRect(margin, y, leftWidth, chartHeight, 6, 6, "F");
  const plotX = margin + 18;
  const plotY = y + 12;
  const plotW = leftWidth - 34;
  const plotH = chartHeight - 31;
  [0, 25, 50, 75, 100].forEach((value) => {
    const lineY = plotY + plotH - (value / 100) * plotH;
    doc.setDrawColor(226, 232, 240);
    doc.line(plotX, lineY, plotX + plotW, lineY);
  });
  const drawTrend = (key: "planned" | "actual", color: [number, number, number]) => {
    doc.setDrawColor(...color);
    doc.setLineWidth(2);
    project.trend.forEach((point, index) => {
      if (index === 0) return;
      const previous = project.trend[index - 1];
      const x1 = plotX + ((index - 1) / (project.trend.length - 1)) * plotW;
      const x2 = plotX + (index / (project.trend.length - 1)) * plotW;
      doc.line(x1, plotY + plotH - (previous[key] / 100) * plotH, x2, plotY + plotH - (point[key] / 100) * plotH);
    });
  };
  drawTrend("planned", [148, 163, 184]);
  drawTrend("actual", blue);
  doc.setFontSize(6.5);
  doc.setTextColor(...slate);
  project.trend.forEach((point, index) => doc.text(point.week, plotX + (index / (project.trend.length - 1)) * plotW, y + chartHeight - 7, { align: "center" }));

  project.workstreams.forEach((stream, index) => {
    const streamY = y + index * 30;
    doc.setFontSize(7.3);
    doc.setTextColor(...navy);
    doc.setFont("helvetica", "bold");
    doc.text(stream.name, rightX, streamY + 9, { maxWidth: rightWidth - 34 });
    doc.text(`${stream.progress}%`, rightX + rightWidth, streamY + 9, { align: "right" });
    doc.setFillColor(229, 235, 242);
    doc.roundedRect(rightX, streamY + 15, rightWidth, 6, 3, 3, "F");
    doc.setFillColor(...healthColor(stream.status));
    doc.roundedRect(rightX, streamY + 15, rightWidth * (stream.progress / 100), 6, 3, 3, "F");
  });
  y += chartHeight + 22;

  const sectionTitle = (label: string, x: number, top: number) => {
    doc.setTextColor(...navy);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(label, x, top);
  };
  const bulletList = (items: string[], x: number, top: number, maxWidth: number, color: [number, number, number]) => {
    let cursor = top;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    items.forEach((item) => {
      doc.setFillColor(...color);
      doc.circle(x + 3, cursor - 2, 2.2, "F");
      doc.setTextColor(...slate);
      const lines = doc.splitTextToSize(item, maxWidth - 13);
      doc.text(lines, x + 12, cursor);
      cursor += lines.length * 9 + 5;
    });
    return cursor;
  };
  const columnWidth = (contentWidth - 18) / 2;
  sectionTitle("WINS THIS WEEK", margin, y);
  sectionTitle("NEXT 7 DAYS", margin + columnWidth + 18, y);
  const leftEnd = bulletList(project.achievements, margin, y + 16, columnWidth, green);
  const rightEnd = bulletList(project.nextSteps, margin + columnWidth + 18, y + 16, columnWidth, blue);
  y = Math.max(leftEnd, rightEnd) + 8;

  sectionTitle("RISKS & DECISIONS", margin, y);
  autoTable(doc, {
    startY: y + 8,
    margin: { left: margin, right: margin },
    head: [["Type", "Item", "Response / owner", "Due"]],
    body: [
      ...project.risks.map((risk) => [risk.level + " risk", risk.title, risk.mitigation, "Active"]),
      ...project.decisions.map((decision) => ["Decision", decision.title, decision.owner, decision.due]),
    ],
    theme: "plain",
    styles: { font: "helvetica", fontSize: 7, textColor: slate, cellPadding: 4, lineColor: [228, 233, 240], lineWidth: 0.5 },
    headStyles: { fillColor: navy, textColor: [255, 255, 255], fontStyle: "bold" },
    columnStyles: { 0: { cellWidth: 58 }, 1: { cellWidth: 130 }, 3: { cellWidth: 44 } },
  });
  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 18;

  sectionTitle("LATEST PROPOSAL LOG", margin, y);
  autoTable(doc, {
    startY: y + 8,
    margin: { left: margin, right: margin },
    body: project.logs.slice(0, 4).map((log) => [log.date, log.title, log.detail]),
    theme: "striped",
    styles: { font: "helvetica", fontSize: 7.2, textColor: slate, cellPadding: 4 },
    alternateRowStyles: { fillColor: [247, 249, 252] },
    columnStyles: { 0: { cellWidth: 44, fontStyle: "bold", textColor: navy }, 1: { cellWidth: 128, fontStyle: "bold", textColor: navy } },
    didDrawPage: () => {
      doc.setDrawColor(225, 231, 239);
      doc.line(margin, 814, width - margin, 814);
      doc.setFontSize(7);
      doc.setTextColor(128, 139, 154);
      doc.text(`${project.shortName} • Weekly project brief`, margin, 826);
      doc.text(`SPARC • Internal`, width - margin, 826, { align: "right" });
    },
  });

  doc.save(`${project.shortName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-weekly-brief.pdf`);
}
