import type { DeepReview, ReviewSection, Strictness, Verdict } from "./types";

type ExcelRow = Record<string, unknown>;

const verdicts: Verdict[] = ["Excellent", "Good", "Needs Improvement", "Poor", "Critical", "Unknown"];

function text(value: unknown): string {
  return value === undefined || value === null ? "" : String(value).trim();
}

function numberInRange(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(100, Math.max(0, Math.round(parsed))) : fallback;
}

function yes(value: unknown, fallback = false): boolean {
  const normalized = text(value).toLowerCase();
  if (["yes", "true", "pass", "passed", "1"].includes(normalized)) return true;
  if (["no", "false", "fail", "failed", "0"].includes(normalized)) return false;
  return fallback;
}

function splitList(value: unknown): string[] {
  return text(value)
    .split(/\r?\n|;/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function valueFor(row: ExcelRow, heading: string): unknown {
  const key = Object.keys(row).find((candidate) => candidate.trim().toLowerCase() === heading.toLowerCase());
  return key ? row[key] : undefined;
}

function scoreVerdict(score: number): Verdict {
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Good";
  if (score >= 60) return "Needs Improvement";
  if (score >= 40) return "Poor";
  return "Critical";
}

export async function downloadReviewExcelTemplate(): Promise<void> {
  const XLSX = await import("xlsx");
  const summary = [
    { Field: "Overall Score", Value: 82 },
    { Field: "Verdict", Value: "Good" },
    { Field: "Summary", Value: "Add the overall reviewer summary here." },
    { Field: "Strengths", Value: "Clear solution approach; Strong delivery plan" },
    { Field: "Strictness", Value: "medium" },
  ];
  const reviewItems = [
    {
      Section: "Executive Summary",
      "Section Score": 85,
      "Section Found": "Yes",
      Criterion: "Customer problem and business outcome are clearly stated",
      Passed: "Yes",
      Note: "Evidence or reviewer note",
      Severity: "warning",
      Issue: "",
      Improvement: "Make the expected outcome measurable",
      "Improvement Benefit": "Improves executive clarity",
      "Improvement Priority": "quick_win",
      "Critical Impact": "",
      "Critical Fix": "",
    },
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(summary), "Summary");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(reviewItems), "Review Items");
  XLSX.writeFile(workbook, "proposal-review-template.xlsx");
}

export async function importReviewFromExcel(
  file: File,
  proposalId: string,
  fallbackStrictness: Strictness
): Promise<DeepReview> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const summarySheet = workbook.Sheets["Summary"];
  const itemsSheet = workbook.Sheets["Review Items"];
  if (!summarySheet || !itemsSheet) {
    throw new Error('The workbook must contain "Summary" and "Review Items" sheets. Download the template and use its sheet names.');
  }

  const summaryRows = XLSX.utils.sheet_to_json<ExcelRow>(summarySheet, { defval: "" });
  const summary = new Map(
    summaryRows.map((row) => [text(valueFor(row, "Field")).toLowerCase(), valueFor(row, "Value")])
  );
  const itemRows = XLSX.utils.sheet_to_json<ExcelRow>(itemsSheet, { defval: "" });
  if (itemRows.length === 0) throw new Error('The "Review Items" sheet must contain at least one review row.');

  const grouped = new Map<string, ExcelRow[]>();
  for (const row of itemRows) {
    const section = text(valueFor(row, "Section"));
    const criterion = text(valueFor(row, "Criterion"));
    if (!section || !criterion) continue;
    grouped.set(section, [...(grouped.get(section) ?? []), row]);
  }
  if (grouped.size === 0) throw new Error("Each review row must include a Section and Criterion.");

  const sections: ReviewSection[] = [...grouped.entries()].map(([name, rows]) => ({
    name,
    score: numberInRange(valueFor(rows[0], "Section Score")),
    found: yes(valueFor(rows[0], "Section Found"), true),
    checklist: rows.map((row) => ({
      criterion: text(valueFor(row, "Criterion")),
      passed: yes(valueFor(row, "Passed")),
      note: text(valueFor(row, "Note")),
    })),
    errors: rows.flatMap((row) => splitList(valueFor(row, "Issue"))),
    improvements: rows.flatMap((row) => splitList(valueFor(row, "Improvement"))),
  }));

  const criteriaTotal = sections.reduce((total, section) => total + section.checklist.length, 0);
  const criteriaPassed = sections.reduce(
    (total, section) => total + section.checklist.filter((item) => item.passed).length,
    0
  );
  const derivedScore = Math.round(sections.reduce((total, section) => total + section.score, 0) / sections.length);
  const overallScore = numberInRange(summary.get("overall score"), derivedScore);
  const suppliedVerdict = text(summary.get("verdict"));
  const verdict = verdicts.find((item) => item.toLowerCase() === suppliedVerdict.toLowerCase()) ?? scoreVerdict(overallScore);
  const suppliedStrictness = text(summary.get("strictness")).toLowerCase();
  const strictness: Strictness = ["low", "medium", "high"].includes(suppliedStrictness)
    ? (suppliedStrictness as Strictness)
    : fallbackStrictness;

  const allErrors = itemRows.flatMap((row) =>
    splitList(valueFor(row, "Issue")).map((error) => ({
      section: text(valueFor(row, "Section")) || "General",
      error,
      severity: text(valueFor(row, "Severity")).toLowerCase() === "error" ? ("error" as const) : ("warning" as const),
    }))
  );
  const allImprovements = itemRows.flatMap((row) =>
    splitList(valueFor(row, "Improvement")).map((action) => ({
      priority: text(valueFor(row, "Improvement Priority")).toLowerCase() === "quick_win"
        ? ("quick_win" as const)
        : ("improvement" as const),
      section: text(valueFor(row, "Section")) || "General",
      action,
      benefit: text(valueFor(row, "Improvement Benefit")),
    }))
  );
  const criticalIssues = itemRows.flatMap((row) => {
    const impact = text(valueFor(row, "Critical Impact"));
    if (!impact) return [];
    return [{
      issue: text(valueFor(row, "Issue")) || text(valueFor(row, "Criterion")),
      impact,
      fix: text(valueFor(row, "Critical Fix")),
    }];
  });

  return {
    id: crypto.randomUUID(),
    proposalId,
    file_name: file.name,
    word_count: 0,
    analyzed_at: new Date().toISOString(),
    ai_powered: false,
    strictness,
    overall_score: overallScore,
    verdict,
    summary: text(summary.get("summary")),
    strengths: splitList(summary.get("strengths")),
    sections,
    criteria_total: criteriaTotal,
    criteria_passed: criteriaPassed,
    criteria_failed: criteriaTotal - criteriaPassed,
    critical_issues: criticalIssues,
    all_errors: allErrors,
    all_improvements: allImprovements,
    rule_check: {
      total_rules: 0,
      passed_rules: 0,
      failed_rules: 0,
      builtin_rules_count: 0,
      custom_rules_count: 0,
      results: [],
    },
    requirement_coverage: null,
    numerical_check: null,
    modelUsed: "Excel upload",
  };
}
