// Deep AI review orchestrator — ported from deep_review_service.run_deep_review().
//
// Runs the rule engine, the AI deep-review (7 sections × criteria), the
// numerical check and the requirement-coverage analysis, then merges them with
// the same penalty-scoring and verdict-escalation logic as the SAP SPR backend.

import type {
  ChecklistItem,
  CriticalIssue,
  DeepReview,
  ErrorItem,
  ImprovementItem,
  RequirementCoverage,
  ReviewSection,
  Strictness,
} from "./types";
import {
  SECTIONS,
  CRITERIA_KEYWORDS,
  DEFAULT_STRICTNESS,
  STRICTNESS_CONFIG,
  applyVerdict,
  getStrictnessConfig,
  type SectionDef,
} from "./sections";
import { invokeLlm, cleanJson, getActiveProviderLabel } from "./llm";
import { BUILTIN_RULE_DEFAULTS, runRuleReview, type DeepRule } from "./builtin-rules";
import { runNumericalCheck } from "./numerical-check";
import { extractRequirements, analyzeRequirementCoverage } from "./coverage";

export interface DeepReviewProgress {
  stage: string;
  percent: number;
}

export interface RunDeepReviewOptions {
  proposalId: string;
  fileName: string;
  /** The text under review (the customer final proposal). */
  proposalText: string;
  /** Supporting documents (RFP / transcript / customer docs) for requirement coverage. */
  contextText?: string;
  strictness?: Strictness;
  rules?: DeepRule[];
  onProgress?: (p: DeepReviewProgress) => void;
}

const PROMPT_TEMPLATE = `You are a senior proposal quality reviewer specializing in IT consulting proposals.
Analyze the proposal excerpt below and return ONLY a valid JSON object — no markdown, no explanation.

REVIEW STANDARD: {strictness_instruction}

JSON structure (follow exactly):
{
  "verdict": "Excellent" | "Good" | "Needs Improvement" | "Poor",
  "score": <integer 0-100>,
  "summary": "<2-sentence overall assessment reflecting the review standard above>",
  "strengths": ["<strength1>", "<strength2>", "<strength3>"],
  "sections": [
    {
      "name": "<exact section name from list>",
      "score": <integer 0-100>,
      "found": <true if section content exists in doc, false if missing>,
      "checklist": [
        {"criterion": "<criterion text>", "passed": <true|false>, "note": "<10-15 word finding from doc>"}
      ],
      "errors": ["<specific error 1>", "<specific error 2>"],
      "improvements": ["<actionable improvement 1>", "<actionable improvement 2>"]
    }
  ],
  "critical_issues": [
    {"issue": "<issue title>", "impact": "<business impact>", "fix": "<specific fix action>"}
  ],
  "quick_wins": [
    {"action": "<specific action>", "benefit": "<expected benefit>"}
  ]
}

Evaluate exactly these 7 sections:
1. Executive Summary — clear problem statement | value proposition articulated | key benefits quantified | expected outcomes defined | executive tone and length
2. Scope & Deliverables — scope boundaries defined | specific deliverables listed | acceptance criteria stated | out-of-scope mentioned | dependencies identified
3. Technical Approach — methodology explained | technology stack specified | architecture described | differentiation highlighted | scalability addressed
4. Timeline & Milestones — phases defined | specific durations provided | milestone criteria clear | dependencies addressed | buffer time included
5. Team & Expertise — team structure shown | domain experience demonstrated | key personnel identified | skills aligned | RACI or org chart referenced
6. Pricing & Commercial — cost breakdown provided | pricing model explained
7. Presentation Quality — consistent formatting | clear concise language | no spelling errors | logical flow | no placeholders

Proposal document:
---
{text}
---`;

interface AiSection {
  name: string;
  score?: number;
  found?: boolean;
  checklist?: ChecklistItem[];
  errors?: string[];
  improvements?: string[];
}

interface AiDeepData {
  verdict?: string;
  score?: number;
  summary?: string;
  strengths?: string[];
  sections?: AiSection[];
  critical_issues?: CriticalIssue[];
  quick_wins?: { action?: string; benefit?: string }[];
  ai_powered?: boolean;
}

async function callAiDeepReview(text: string, strictness: string): Promise<AiDeepData | null> {
  try {
    const cfg = getStrictnessConfig(strictness);
    const truncated = text.length > 60000 ? text.slice(0, 60000) : text;
    const prompt = PROMPT_TEMPLATE.replace("{strictness_instruction}", cfg.ai_instruction).replace(
      "{text}",
      truncated
    );
    const raw = await invokeLlm(prompt, 4000, 0.1);
    return JSON.parse(cleanJson(raw)) as AiDeepData;
  } catch {
    return null;
  }
}

// ── Heuristic fallback (when the AI call fails) ──────────────────────────────

function heuristicSection(text: string, section: SectionDef): ReviewSection {
  const textLower = text.toLowerCase();
  const keywords = section.keywords;
  const found = keywords.length ? keywords.some((kw) => textLower.includes(kw)) : true;
  const checklist: ChecklistItem[] = [];

  for (const criterion of section.criteria) {
    const kws = CRITERIA_KEYWORDS[criterion] ?? [];
    let passed: boolean;
    let note: string;
    if (!kws.length) {
      passed = found;
      note = "Manual check recommended";
    } else if (criterion === "No incomplete placeholders or draft content") {
      const hits = kws.filter((kw) => textLower.includes(kw));
      passed = hits.length === 0;
      note = passed ? "No placeholder text detected" : `Found: ${hits.join(", ")}`;
    } else {
      const hits = kws.filter((kw) => textLower.includes(kw));
      passed = hits.length > 0;
      note = passed ? `Found: ${hits[0]}` : "Not detected in document";
    }
    checklist.push({ criterion, passed, note });
  }

  const passedCount = checklist.filter((c) => c.passed).length;
  const total = checklist.length || 1;
  const score = Math.round((passedCount / total) * 100);
  const errors = checklist.filter((c) => !c.passed).map((c) => `Missing: ${c.criterion}`);
  const improvements = [
    ...(!found ? [`Add a dedicated '${section.name}' section`] : []),
    ...errors.slice(0, 2).map((e) => `Address: ${e.slice(9)}`),
  ];

  return {
    name: section.name,
    score,
    found,
    checklist,
    errors: errors.slice(0, 3),
    improvements: improvements.slice(0, 3),
  };
}

function heuristicDeepReview(text: string, strictness: string): AiDeepData & { sections: ReviewSection[] } {
  const sections = SECTIONS.map((s) => heuristicSection(text, s));
  const allCriteria = sections.flatMap((s) => s.checklist);
  const passedCount = allCriteria.filter((c) => c.passed).length;
  const rawScore = allCriteria.length ? Math.round((passedCount / allCriteria.length) * 100) : 0;

  const cfg = getStrictnessConfig(strictness);
  const score = Math.max(0, Math.min(100, rawScore + cfg.score_adjustment));
  const verdict = applyVerdict(score, strictness);

  const missing = sections.filter((s) => !s.found).map((s) => s.name);
  const critical_issues: CriticalIssue[] = missing.slice(0, 4).map((name) => ({
    issue: `Missing section: ${name}`,
    impact: `Evaluators cannot assess ${name.toLowerCase()}`,
    fix: `Add a '${name}' section with relevant content`,
  }));

  return {
    verdict,
    score,
    summary: `Heuristic analysis (AI unavailable) - ${cfg.label} strictness. ${passedCount}/${allCriteria.length} criteria passed across ${SECTIONS.length} sections.`,
    strengths: sections.filter((s) => s.found).map((s) => `Content detected: ${s.name}`).slice(0, 3),
    sections,
    critical_issues,
    quick_wins: [
      { action: "Add page numbers and a table of contents", benefit: "Improves navigation and professionalism" },
      { action: "Quantify all claims with specific numbers", benefit: "Strengthens proposal credibility" },
    ],
    ai_powered: false,
  };
}

// ── Public entry point ───────────────────────────────────────────────────────

export async function runDeepReview(options: RunDeepReviewOptions): Promise<DeepReview> {
  const strictness: Strictness =
    options.strictness && STRICTNESS_CONFIG[options.strictness] ? options.strictness : DEFAULT_STRICTNESS;
  const cfg = getStrictnessConfig(strictness);
  const text = options.proposalText || "";
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const analyzedAt = new Date().toISOString();
  const rules = options.rules ?? BUILTIN_RULE_DEFAULTS;
  const report = options.onProgress ?? (() => {});

  report({ stage: "Checking rules…", percent: 8 });
  // 1. Rule-engine check (built-in + custom rules)
  const ruleResults = await runRuleReview(text, rules);

  // 2. Fan out the slow LLM calls in parallel (deep review + numerical + coverage)
  report({ stage: "Running AI deep review, numerical & coverage checks…", percent: 20 });

  const aiReviewPromise = callAiDeepReview(text, strictness);
  const numericalPromise = runNumericalCheck(text);
  const coveragePromise: Promise<RequirementCoverage | null> = (async () => {
    if (!options.contextText || !options.contextText.trim()) return null;
    const requirements = await extractRequirements(options.contextText);
    if (!requirements.length) return null;
    return analyzeRequirementCoverage(requirements, text);
  })();

  const [aiData, numericalCheck, coverage] = await Promise.all([
    aiReviewPromise,
    numericalPromise,
    coveragePromise,
  ]);
  report({ stage: "Merging results…", percent: 80 });

  // 3. Build the deep-review block (AI or heuristic fallback)
  let deep: AiDeepData & { sections: ReviewSection[] };
  if (aiData && aiData.sections) {
    const allowed = new Set(SECTIONS.map((s) => s.name));
    const sections = (aiData.sections as AiSection[])
      .filter((sec) => allowed.has(sec.name))
      .map((sec): ReviewSection => {
        const checklist = sec.checklist ?? [];
        const score = checklist.length
          ? Math.round((checklist.filter((c) => c.passed).length / checklist.length) * 100)
          : Number(sec.score ?? 0);
        return {
          name: sec.name,
          score,
          found: sec.found ?? true,
          checklist,
          errors: sec.errors ?? [],
          improvements: sec.improvements ?? [],
        };
      });

    const rawScore = Number(aiData.score ?? 0);
    const adjusted = Math.max(0, Math.min(100, rawScore + cfg.score_adjustment));
    deep = {
      ...aiData,
      score: adjusted,
      verdict: applyVerdict(adjusted, strictness),
      sections,
      ai_powered: true,
    };
  } else {
    deep = heuristicDeepReview(text, strictness);
  }

  // 3b. Consistency guard: a section the model reports as NOT FOUND cannot
  // legitimately pass its content criteria. The LLM (and the keyword heuristic)
  // sometimes mark criteria "passed" on stray keyword matches even when the
  // section is absent — producing a contradictory "Section not found" card with
  // a non-zero score (e.g. Pricing & Commercial = 75 with no pricing content).
  // Force a not-found section to fail all its criteria and score 0.
  for (const sec of deep.sections) {
    if (sec.found === false) {
      sec.checklist = (sec.checklist ?? []).map((c) => ({
        ...c,
        passed: false,
        note: c.note || "Section not present in the document",
      }));
      sec.score = 0;
    }
  }

  // 4. Aggregate improvements (quick wins + per-section improvements)
  const allImprovements: ImprovementItem[] = [
    ...(deep.quick_wins ?? [])
      .filter((wi): wi is { action?: string; benefit?: string } => typeof wi === "object" && wi !== null)
      .map((wi) => ({
        priority: "quick_win" as const,
        section: "General",
        action: wi.action ?? "",
        benefit: wi.benefit ?? "",
      })),
    ...deep.sections.flatMap((sec) =>
      (sec.improvements ?? []).map((imp) => ({
        priority: "improvement" as const,
        section: sec.name,
        action: imp,
        benefit: "",
      }))
    ),
  ];

  // 5. Criteria stats
  const allCriteria = deep.sections.flatMap((s) => s.checklist ?? []);
  const criteriaPassed = allCriteria.filter((c) => c.passed).length;
  const criteriaTotal = allCriteria.length;

  // 6. Promote missing customer requirements + coverage topics into critical issues
  const extraCriticals: CriticalIssue[] = [];
  if (coverage) {
    for (const item of coverage.items) {
      if (item.status === "missing") {
        extraCriticals.push({
          issue: `Customer requirement not addressed: ${item.requirement_title}`,
          impact:
            "This requirement was explicitly raised by the customer in the requirement docs / meeting notes. Leaving it out weakens the bid.",
          fix: item.gap || "Add a section in the proposal that directly answers this requirement.",
        });
      }
    }
    for (const topic of coverage.missing_topics.slice(0, 5)) {
      extraCriticals.push({
        issue: `Topic missing from proposal: ${topic}`,
        impact: "Customer asked about this but the proposal does not mention it.",
        fix: `Add explicit coverage of '${topic}'.`,
      });
    }
  }

  // 6d. Numerical discrepancies → critical issues + Pricing section errors
  const numExtraCriticals: CriticalIssue[] = [];
  for (const disc of numericalCheck.discrepancies) {
    numExtraCriticals.push({
      issue: `Numerical inconsistency: ${disc.label || disc.kind}`,
      impact: `The proposal states ${disc.stated} but the components add up to ${disc.expected} (off by ${disc.diff}). Evaluators run these calculations themselves — a mismatch undermines credibility of pricing or effort.`,
      fix: `Reconcile '${disc.label}' — verify the components in ${disc.context || "the relevant table"} match the stated total.`,
    });
  }

  let criticalIssues = deep.critical_issues ?? [];
  if (extraCriticals.length || numExtraCriticals.length) {
    criticalIssues = [...criticalIssues, ...extraCriticals, ...numExtraCriticals];
  }

  // Mirror numerical discrepancies as Pricing & Commercial section errors
  if (numExtraCriticals.length) {
    for (const sec of deep.sections) {
      const lower = sec.name.toLowerCase();
      if (lower.includes("pricing") || lower.includes("commercial")) {
        for (const disc of numericalCheck.discrepancies) {
          sec.errors = [...(sec.errors ?? []), `Numerical: ${disc.message}`];
        }
        break;
      }
    }
  }

  // 5b. Aggregate errors (numerical errors are always severity="error")
  const NUMERIC_PREFIX = "numerical:";
  const allErrors: ErrorItem[] = [];
  for (const sec of deep.sections) {
    const sectionFound = sec.found ?? true;
    for (const err of sec.errors ?? []) {
      const isNumeric = typeof err === "string" && err.toLowerCase().startsWith(NUMERIC_PREFIX);
      allErrors.push({
        section: sec.name,
        error: err,
        severity: isNumeric || !sectionFound ? "error" : "warning",
      });
    }
  }

  // 7. Penalise score for outstanding issues
  const baseScore = Number(deep.score ?? 0);
  const failedRules = ruleResults.failed_rules;
  const numDiscCount = numericalCheck.discrepancies.length;
  const aiCriticalCount = Math.max(
    0,
    criticalIssues.length - extraCriticals.length - numExtraCriticals.length
  );
  const sectionErrorCount = allErrors.filter(
    (e) =>
      e.severity === "error" &&
      !(typeof e.error === "string" && e.error.toLowerCase().startsWith("numerical:"))
  ).length;
  const sectionWarningCount = allErrors.filter((e) => e.severity === "warning").length;

  let penalty = failedRules * 5 + aiCriticalCount * 5 + sectionErrorCount * 3 + sectionWarningCount * 1;
  if (coverage) {
    penalty += coverage.missing_count * 4 + coverage.partial_count * 2;
    const profileTopicExtras = Math.max(
      0,
      extraCriticals.length - coverage.missing_count - Math.min(5, coverage.missing_topics.length)
    );
    penalty += profileTopicExtras * 3;
  } else {
    penalty += extraCriticals.length * 3;
  }
  penalty += numDiscCount * 4;
  penalty = Math.min(penalty, 50);

  const overallScore = Math.max(0, Math.min(100, baseScore - penalty));
  let overallVerdict = penalty > 0 ? applyVerdict(overallScore, strictness) : deep.verdict ?? "Unknown";

  // CRITICAL escalation: any unreconciled arithmetic makes the proposal non-sendable.
  if (numDiscCount > 0) overallVerdict = "Critical";

  return {
    id: crypto.randomUUID(),
    proposalId: options.proposalId,
    file_name: options.fileName,
    word_count: wordCount,
    analyzed_at: analyzedAt,
    ai_powered: deep.ai_powered ?? false,
    strictness,
    overall_score: overallScore,
    verdict: overallVerdict as DeepReview["verdict"],
    summary: deep.summary ?? "",
    strengths: deep.strengths ?? [],
    sections: deep.sections,
    criteria_total: criteriaTotal,
    criteria_passed: criteriaPassed,
    criteria_failed: criteriaTotal - criteriaPassed,
    critical_issues: criticalIssues,
    all_errors: allErrors,
    all_improvements: allImprovements,
    rule_check: ruleResults,
    requirement_coverage: coverage,
    numerical_check: numericalCheck,
    modelUsed: getActiveProviderLabel(),
  };
}
