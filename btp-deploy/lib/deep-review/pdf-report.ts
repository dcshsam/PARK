// Client-side PDF report builder for the AI Enabled Review.
//
// Faithful port of the SPR `review_report_service.py` (ReportLab) report:
// cover (verdict + score + headline stats + meta + summary), strengths,
// critical issues, per-section analysis, errors & warnings, improvements,
// requirement coverage, numerical check, and rule checks — rendered with
// jsPDF + jspdf-autotable so it downloads as a real .pdf with no backend.

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { DeepReview } from "./types";

type RGB = [number, number, number];

const INK: RGB = [17, 24, 39];
const MUTED: RGB = [107, 114, 128];
const SUBTLE: RGB = [156, 163, 175];
const DIVIDER: RGB = [229, 231, 235];
const PANEL: RGB = [249, 250, 251];
const GREEN: RGB = [22, 163, 74];
const GREEN_BG: RGB = [236, 253, 245];
const YELLOW: RGB = [202, 138, 4];
const YELLOW_BG: RGB = [254, 249, 195];
const RED: RGB = [220, 38, 38];
const RED_BG: RGB = [254, 226, 226];
const BLUE: RGB = [37, 99, 235];
const BLUE_BG: RGB = [219, 234, 254];
const CRIT_FG: RGB = [127, 29, 29];
const CRIT_BG: RGB = [254, 202, 202];

function scoreColor(s: number): RGB {
  return s >= 80 ? GREEN : s >= 60 ? YELLOW : RED;
}

function verdictPalette(verdict: string): { fg: RGB; bg: RGB } {
  switch ((verdict || "").toLowerCase()) {
    case "excellent":
      return { fg: GREEN, bg: GREEN_BG };
    case "good":
      return { fg: BLUE, bg: BLUE_BG };
    case "needs improvement":
      return { fg: YELLOW, bg: YELLOW_BG };
    case "critical":
      return { fg: CRIT_FG, bg: CRIT_BG };
    default:
      return { fg: RED, bg: RED_BG };
  }
}

function fmtDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso || "";
  }
}

const A4_W = 595.28;
const A4_H = 841.89;
const MARGIN = 40;
const CONTENT_W = A4_W - MARGIN * 2;

type JsPDFWithTable = jsPDF & { lastAutoTable: { finalY: number } };

class ReportBuilder {
  doc: jsPDF;
  y = MARGIN;

  constructor() {
    this.doc = new jsPDF({ unit: "pt", format: "a4" });
  }

  private ensure(needed: number) {
    if (this.y + needed > A4_H - MARGIN - 14) {
      this.doc.addPage();
      this.y = MARGIN;
    }
  }

  pageBreak() {
    this.doc.addPage();
    this.y = MARGIN;
  }

  heading(text: string, size = 14, opts: { color?: RGB; spaceBefore?: number; spaceAfter?: number } = {}) {
    const { color = INK, spaceBefore = 10, spaceAfter = 6 } = opts;
    this.y += spaceBefore;
    this.ensure(size * 1.4);
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(size);
    this.doc.setTextColor(...color);
    this.doc.text(text, MARGIN, this.y, { baseline: "top" });
    this.y += size * 1.3 + spaceAfter;
  }

  paragraph(text: string, opts: { size?: number; color?: RGB; bold?: boolean; spaceAfter?: number } = {}) {
    if (!text) return;
    const { size = 10, color = INK, bold = false, spaceAfter = 6 } = opts;
    this.doc.setFont("helvetica", bold ? "bold" : "normal");
    this.doc.setFontSize(size);
    this.doc.setTextColor(...color);
    const lines = this.doc.splitTextToSize(text, CONTENT_W) as string[];
    const lh = size * 1.35;
    for (const line of lines) {
      this.ensure(lh);
      this.doc.text(line, MARGIN, this.y, { baseline: "top" });
      this.y += lh;
    }
    this.y += spaceAfter;
  }

  bullets(items: string[], color: RGB, marker = "•") {
    const size = 9.5;
    const lh = size * 1.35;
    this.doc.setFontSize(size);
    for (const item of items.filter(Boolean)) {
      const lines = this.doc.splitTextToSize(item, CONTENT_W - 16) as string[];
      this.ensure(lh * lines.length);
      const markerY = this.y;
      this.doc.setFont("helvetica", "bold");
      this.doc.setTextColor(...color);
      this.doc.text(marker, MARGIN, markerY, { baseline: "top" });
      this.doc.setFont("helvetica", "normal");
      this.doc.setTextColor(...INK);
      for (const line of lines) {
        this.doc.text(line, MARGIN + 16, this.y, { baseline: "top" });
        this.y += lh;
      }
    }
    this.y += 4;
  }

  private box(x: number, y: number, w: number, h: number, fill: RGB, border?: RGB) {
    this.doc.setFillColor(...fill);
    if (border) {
      this.doc.setDrawColor(...border);
      this.doc.setLineWidth(1.2);
      this.doc.rect(x, y, w, h, "FD");
    } else {
      this.doc.rect(x, y, w, h, "F");
    }
  }

  table(head: (string | object)[][], body: (string | object)[][], opts: { startGap?: number } = {}) {
    const t = this.doc as JsPDFWithTable;
    autoTable(this.doc, {
      head: head as never,
      body: body as never,
      startY: this.y + (opts.startGap ?? 2),
      margin: { left: MARGIN, right: MARGIN },
      theme: "grid",
      styles: { fontSize: 8.5, cellPadding: 4, textColor: INK, lineColor: DIVIDER, lineWidth: 0.3, valign: "top" },
      headStyles: { fillColor: PANEL, textColor: INK, fontStyle: "bold", lineColor: DIVIDER },
    });
    this.y = t.lastAutoTable.finalY + 12;
  }

  // ── Cover ──────────────────────────────────────────────────────────────────

  cover(r: DeepReview) {
    const verdict = r.verdict || "Unknown";
    const { fg, bg } = verdictPalette(verdict);
    const score = Math.round(r.overall_score);

    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(24);
    this.doc.setTextColor(...INK);
    this.doc.text("Proposal Deep Review", MARGIN, this.y, { baseline: "top" });
    this.y += 30;
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(10);
    this.doc.setTextColor(...MUTED);
    this.doc.text(r.file_name || "Untitled", MARGIN, this.y, { baseline: "top" });
    this.y += 22;

    // DO NOT SEND banner
    if (verdict.toLowerCase() === "critical") {
      const n = r.numerical_check?.discrepancies.length ?? 0;
      const text =
        `DO NOT SEND this proposal to the customer. The numerical audit found ${n} arithmetic ` +
        `error${n === 1 ? "" : "s"} — mismatched totals or incorrect cost calculations. Fix the ` +
        `calculations and re-run the review before sending. See the Numerical Check section for details.`;
      this.doc.setFontSize(10.5);
      const lines = this.doc.splitTextToSize(text, CONTENT_W - 24) as string[];
      const h = 16 + lines.length * 14;
      this.ensure(h + 6);
      this.box(MARGIN, this.y, CONTENT_W, h, CRIT_BG, CRIT_FG);
      this.doc.setTextColor(...CRIT_FG);
      this.doc.setFont("helvetica", "normal");
      let ty = this.y + 10;
      for (const line of lines) {
        this.doc.text(line, MARGIN + 12, ty, { baseline: "top" });
        ty += 14;
      }
      this.y += h + 14;
    }

    // Score + verdict boxes
    this.ensure(74);
    const boxW = (CONTENT_W - 12) / 2;
    const boxH = 60;
    const top = this.y;
    this.box(MARGIN, top, boxW, boxH, PANEL);
    const scoreStr = String(score);
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(34);
    const sw = this.doc.getTextWidth(scoreStr);
    this.doc.setFontSize(12);
    const suffix = " / 100";
    const fw = this.doc.getTextWidth(suffix);
    const startX = MARGIN + (boxW - (sw + fw)) / 2;
    this.doc.setFontSize(34);
    this.doc.setTextColor(...scoreColor(score));
    this.doc.text(scoreStr, startX, top + boxH / 2, { baseline: "middle" });
    this.doc.setFontSize(12);
    this.doc.setTextColor(...SUBTLE);
    this.doc.text(suffix, startX + sw, top + boxH / 2 + 6, { baseline: "middle" });

    this.box(MARGIN + boxW + 12, top, boxW, boxH, bg);
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(18);
    this.doc.setTextColor(...fg);
    this.doc.text(verdict, MARGIN + boxW + 12 + boxW / 2, top + boxH / 2, { align: "center", baseline: "middle" });
    this.y = top + boxH + 14;

    // Headline stats
    this.statRow([
      { label: "Criteria passed", value: `${r.criteria_passed}/${r.criteria_total}`, color: GREEN },
      { label: "Criteria failed", value: String(r.criteria_failed), color: RED },
      { label: "Critical issues", value: String(r.critical_issues.length), color: RED },
      { label: "Word count", value: r.word_count.toLocaleString(), color: INK },
    ]);

    // Meta
    this.table(
      [],
      [
        [{ content: "File", styles: { fontStyle: "bold", textColor: MUTED } }, r.file_name || ""],
        [{ content: "Analyzed", styles: { fontStyle: "bold", textColor: MUTED } }, fmtDateTime(r.analyzed_at)],
        [{ content: "AI powered", styles: { fontStyle: "bold", textColor: MUTED } }, r.ai_powered ? "Yes" : "No (heuristic fallback)"],
        [{ content: "Strictness", styles: { fontStyle: "bold", textColor: MUTED } }, (r.strictness || "medium").replace(/^\w/, (c) => c.toUpperCase())],
        [{ content: "Model", styles: { fontStyle: "bold", textColor: MUTED } }, r.modelUsed || "—"],
      ]
    );

    if (r.summary) {
      this.heading("Summary", 13);
      this.paragraph(r.summary);
    }
  }

  statRow(tiles: { label: string; value: string; color: RGB }[]) {
    const n = tiles.length;
    const gap = 6;
    const tw = (CONTENT_W - gap * (n - 1)) / n;
    const th = 42;
    this.ensure(th + 10);
    const top = this.y;
    tiles.forEach((tile, i) => {
      const x = MARGIN + i * (tw + gap);
      this.box(x, top, tw, th, PANEL);
      this.doc.setFont("helvetica", "bold");
      this.doc.setFontSize(14);
      this.doc.setTextColor(...tile.color);
      this.doc.text(tile.value, x + tw / 2, top + 16, { align: "center", baseline: "middle" });
      this.doc.setFont("helvetica", "normal");
      this.doc.setFontSize(8);
      this.doc.setTextColor(...MUTED);
      this.doc.text(tile.label, x + tw / 2, top + 30, { align: "center", baseline: "middle" });
    });
    this.y = top + th + 12;
  }

  // ── Footer (page numbers) ────────────────────────────────────────────────────

  finalizeFooters() {
    const pages = this.doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      this.doc.setPage(i);
      this.doc.setFont("helvetica", "normal");
      this.doc.setFontSize(8);
      this.doc.setTextColor(...MUTED);
      this.doc.text("AI Enabled Review — Proposal Deep Review Report", MARGIN, A4_H - 18, { baseline: "middle" });
      this.doc.text(`Page ${i} of ${pages}`, A4_W - MARGIN, A4_H - 18, { align: "right", baseline: "middle" });
    }
  }
}

// ── Section renderers ──────────────────────────────────────────────────────────

function renderStrengths(b: ReportBuilder, r: DeepReview) {
  if (!r.strengths.length) return;
  b.heading("Strengths", 13);
  b.bullets(r.strengths, GREEN);
}

function renderCriticalIssues(b: ReportBuilder, r: DeepReview) {
  if (!r.critical_issues.length) return;
  b.heading(`Critical Issues (${r.critical_issues.length})`, 13);
  b.paragraph("These items must be addressed before submission — evaluators specifically look for them.", { size: 9, color: MUTED });
  r.critical_issues.forEach((ci, i) => {
    b.paragraph(`${i + 1}. ${ci.issue}`, { bold: true, size: 11, color: INK, spaceAfter: 2 });
    b.paragraph(`Impact: ${ci.impact}`, { size: 9.5 });
    b.paragraph(`Fix: ${ci.fix}`, { size: 9.5, color: GREEN, spaceAfter: 8 });
  });
}

function renderSections(b: ReportBuilder, r: DeepReview) {
  if (!r.sections.length) return;
  b.pageBreak();
  b.heading("Section Analysis", 16, { spaceBefore: 0 });
  for (const sec of r.sections) {
    const passed = sec.checklist.filter((c) => c.passed).length;
    const total = sec.checklist.length;
    b.heading(`${sec.name}   —   ${sec.score}/100 · ${passed}/${total} criteria`, 12, {
      color: scoreColor(sec.score),
      spaceBefore: 8,
      spaceAfter: 2,
    });
    if (!sec.found) {
      b.paragraph("Section not found in the proposal.", { bold: true, color: RED, size: 9.5 });
    }
    if (sec.checklist.length) {
      b.table(
        [["", "Criterion", "Note"]],
        sec.checklist.map((c) => [
          { content: c.passed ? "PASS" : "FAIL", styles: { textColor: c.passed ? GREEN : RED, fontStyle: "bold" } },
          c.criterion,
          { content: c.note || "", styles: { textColor: MUTED } },
        ]),
        { startGap: 0 }
      );
    }
    if (sec.errors.filter(Boolean).length) {
      b.paragraph("Errors", { bold: true, size: 9.5, spaceAfter: 2 });
      b.bullets(sec.errors.filter(Boolean), RED);
    }
    if (sec.improvements.filter(Boolean).length) {
      b.paragraph("Improvements", { bold: true, size: 9.5, spaceAfter: 2 });
      b.bullets(sec.improvements.filter(Boolean), BLUE, "→");
    }
  }
}

function renderErrorsWarnings(b: ReportBuilder, r: DeepReview) {
  const errors = r.all_errors.filter((e) => e.severity === "error");
  const warnings = r.all_errors.filter((e) => e.severity === "warning");
  if (!errors.length && !warnings.length) return;
  b.pageBreak();
  b.heading("Errors & Warnings", 16, { spaceBefore: 0 });
  if (errors.length) {
    b.heading(`Errors (${errors.length})`, 12);
    b.table([["Section", "Issue"]], errors.map((e) => [{ content: e.section, styles: { fontStyle: "bold" } }, e.error]));
  }
  if (warnings.length) {
    b.heading(`Warnings (${warnings.length})`, 12);
    b.table([["Section", "Issue"]], warnings.map((e) => [{ content: e.section, styles: { fontStyle: "bold" } }, e.error]));
  }
}

function renderImprovements(b: ReportBuilder, r: DeepReview) {
  if (!r.all_improvements.length) return;
  b.pageBreak();
  b.heading("Improvements", 16, { spaceBefore: 0 });
  const quick = r.all_improvements.filter((i) => i.priority === "quick_win");
  const rest = r.all_improvements.filter((i) => i.priority !== "quick_win");
  if (quick.length) {
    b.heading(`Quick wins (${quick.length})`, 12);
    b.table([["Action", "Benefit"]], quick.map((q) => [q.action, { content: q.benefit || "", styles: { textColor: MUTED } }]));
  }
  if (rest.length) {
    b.heading(`By section (${rest.length})`, 12);
    b.table([["Section", "Action"]], rest.map((i) => [{ content: i.section, styles: { fontStyle: "bold" } }, i.action]));
  }
}

function renderCoverage(b: ReportBuilder, r: DeepReview) {
  const cov = r.requirement_coverage;
  if (!cov) return;
  b.pageBreak();
  b.heading("Customer Requirement Coverage", 16, { spaceBefore: 0 });
  if (cov.summary) b.paragraph(cov.summary);
  b.statRow([
    { label: "Coverage score", value: String(cov.coverage_score), color: scoreColor(cov.coverage_score) },
    { label: "Addressed", value: String(cov.addressed_count), color: GREEN },
    { label: "Partial", value: String(cov.partial_count), color: YELLOW },
    { label: "Missing", value: String(cov.missing_count), color: RED },
  ]);
  if (cov.missing_topics.length) {
    b.heading("Topics asked but not addressed", 11);
    b.bullets(cov.missing_topics, RED);
  }
  if (cov.items.length) {
    b.heading("Per-requirement detail", 11);
    b.table(
      [["ID", "Requirement", "Status", "Evidence / Gap"]],
      cov.items.map((it) => {
        const status = (it.status || "missing").toString();
        const color = status === "addressed" ? GREEN : status === "partial" ? YELLOW : RED;
        const detail = [it.evidence ? `Evidence: ${it.evidence}` : "", it.gap ? `Gap: ${it.gap}` : ""].filter(Boolean).join("\n") || "—";
        return [
          { content: it.requirement_id || "", styles: { textColor: MUTED } },
          it.requirement_title,
          { content: status.replace(/^\w/, (c) => c.toUpperCase()), styles: { textColor: color, fontStyle: "bold" } },
          { content: detail, styles: { textColor: MUTED } },
        ];
      })
    );
  }
}

function renderNumerical(b: ReportBuilder, r: DeepReview) {
  const nc = r.numerical_check;
  if (!nc || !nc.claims_extracted) return;
  b.pageBreak();
  b.heading("Numerical Check", 16, { spaceBefore: 0 });
  b.paragraph(
    "Arithmetic claims (line-item sums, days × rate, percentage breakdowns) were extracted from the proposal and verified by exact arithmetic.",
    { size: 9, color: MUTED }
  );
  b.statRow([
    { label: "Claims extracted", value: String(nc.claims_extracted), color: INK },
    { label: "Verified OK", value: String(nc.ok), color: GREEN },
    { label: "Mismatched", value: String(nc.discrepancies.length), color: RED },
    { label: "Skipped", value: String(nc.skipped_low_confidence ?? 0), color: SUBTLE },
  ]);
  if (!nc.discrepancies.length) {
    b.paragraph("All extracted claims reconciled correctly.");
    return;
  }
  b.table(
    [["Claim", "Kind", "Expected", "Stated", "Diff"]],
    nc.discrepancies.map((d) => {
      const unit = d.unit ? ` ${d.unit}` : "";
      return [
        { content: d.label + (d.context ? `\n${d.context}` : ""), styles: {} },
        { content: (d.kind || "").replace("_", " "), styles: { textColor: MUTED } },
        { content: `${d.expected.toLocaleString()}${unit}`, styles: { textColor: GREEN, fontStyle: "bold" } },
        { content: `${d.stated.toLocaleString()}${unit}`, styles: { textColor: RED, fontStyle: "bold" } },
        `${d.diff > 0 ? "+" : ""}${d.diff.toLocaleString()}${unit}`,
      ];
    })
  );
}

function renderRuleChecks(b: ReportBuilder, r: DeepReview) {
  const rc = r.rule_check;
  if (!rc.results.length) return;
  b.pageBreak();
  b.heading("Rule Checks", 16, { spaceBefore: 0 });
  b.paragraph(
    `${rc.passed_rules} of ${rc.total_rules} rules passed (${rc.builtin_rules_count} built-in, ${rc.custom_rules_count} custom).`,
    { size: 9, color: MUTED }
  );
  b.table(
    [["#", "Rule", "Type", "Status", "Details"]],
    rc.results.map((rule, i) => {
      const { text, color } = rule.passed
        ? { text: "Passed", color: GREEN }
        : rule.severity === "error"
          ? { text: "Failed", color: RED }
          : { text: "Warning", color: YELLOW };
      return [
        { content: String(i + 1), styles: { textColor: MUTED } },
        rule.rule_name,
        { content: rule.is_builtin ? "Built-in" : "Custom", styles: { textColor: MUTED } },
        { content: text, styles: { textColor: color, fontStyle: "bold" } },
        { content: rule.details || "", styles: { textColor: MUTED } },
      ];
    })
  );
}

// ── Public API ────────────────────────────────────────────────────────────────

export function buildReviewPdf(review: DeepReview): jsPDF {
  const b = new ReportBuilder();
  b.cover(review);
  b.pageBreak();
  renderStrengths(b, review);
  renderCriticalIssues(b, review);
  renderSections(b, review);
  renderErrorsWarnings(b, review);
  renderImprovements(b, review);
  renderCoverage(b, review);
  renderNumerical(b, review);
  renderRuleChecks(b, review);
  b.finalizeFooters();
  return b.doc;
}

export function downloadReviewPdf(review: DeepReview): void {
  const doc = buildReviewPdf(review);
  const base = (review.file_name || "proposal").replace(/\.[^.]+$/, "") || "proposal";
  doc.save(`review-${base}.pdf`);
}
