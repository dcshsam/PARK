// Rule engine — ported from review_service.py.
//
// The 7 factory-default rules are evaluated with pure string checks (no LLM
// needed), giving the "Rule Checks" tab. Custom rules can be added by the user;
// `custom_prompt` rules are evaluated with a single LLM call.

import type { RuleCheck, RuleResult } from "./types";
import { invokeLlm } from "./llm";

export interface DeepRule {
  id: string;
  name: string;
  description: string;
  rule_type: "section_required" | "keyword_presence" | "keyword_absence" | "min_word_count" | "custom_prompt";
  severity: "error" | "warning";
  config: Record<string, unknown>;
  is_active: boolean;
  is_builtin: boolean;
}

export const BUILTIN_RULE_DEFAULTS: DeepRule[] = [
  {
    id: "builtin_exec_summary",
    name: "Executive Summary",
    description: "Document must contain an executive summary section",
    rule_type: "section_required",
    severity: "error",
    config: { keywords: ["executive summary"] },
    is_active: true,
    is_builtin: true,
  },
  {
    id: "builtin_scope",
    name: "Scope & Deliverables",
    description: "Document must describe the project scope and deliverables",
    rule_type: "keyword_presence",
    severity: "warning",
    config: { keywords: ["scope", "deliverable", "objective"], match_any: true },
    is_active: true,
    is_builtin: true,
  },
  {
    id: "builtin_technical",
    name: "Technical Approach",
    description: "Document must cover the technical approach or architecture",
    rule_type: "keyword_presence",
    severity: "warning",
    config: { keywords: ["technical", "architecture", "solution", "approach", "methodology"], match_any: true },
    is_active: true,
    is_builtin: true,
  },
  {
    id: "builtin_pricing",
    name: "Pricing & Commercial Terms",
    description: "Document must include pricing or cost information",
    rule_type: "keyword_presence",
    severity: "warning",
    config: { keywords: ["pricing", "cost", "investment", "commercial", "budget", "price", "fee"], match_any: true },
    is_active: true,
    is_builtin: true,
  },
  {
    id: "builtin_timeline",
    name: "Timeline & Milestones",
    description: "Document must include a project timeline or milestones",
    rule_type: "keyword_presence",
    severity: "warning",
    config: { keywords: ["timeline", "milestone", "phase", "schedule", "week", "month"], match_any: true },
    is_active: true,
    is_builtin: true,
  },
  {
    id: "builtin_no_placeholder",
    name: "No Placeholder Text",
    description: "Document must not contain unfinished placeholder content",
    rule_type: "keyword_absence",
    severity: "error",
    config: { keywords: ["tbd", "todo", "lorem ipsum", "[placeholder]", "[add content", "[your company]"] },
    is_active: true,
    is_builtin: true,
  },
  {
    id: "builtin_word_count",
    name: "Minimum Word Count",
    description: "Document must have at least 200 words",
    rule_type: "min_word_count",
    severity: "error",
    config: { min_words: 200 },
    is_active: true,
    is_builtin: true,
  },
];

function keywordPresence(text: string, keywords: string[], matchAny = true): [boolean, string[]] {
  const lower = text.toLowerCase();
  const found = keywords.filter((kw) => lower.includes(kw.toLowerCase()));
  const passed = matchAny ? found.length > 0 : found.length === keywords.length;
  return [passed, found];
}

function keywordAbsence(text: string, keywords: string[]): [boolean, string[]] {
  const lower = text.toLowerCase();
  const found = keywords.filter((kw) => lower.includes(kw.toLowerCase()));
  return [found.length === 0, found];
}

function wordCount(text: string, minWords: number): [boolean, number] {
  const count = text.split(/\s+/).filter(Boolean).length;
  return [count >= minWords, count];
}

async function evaluateRule(text: string, rule: DeepRule): Promise<RuleResult> {
  const ruleType = rule.rule_type;
  const config = rule.config || {};
  let passed = false;
  let details = "";
  const suggestions: string[] = [];

  if (ruleType === "keyword_presence") {
    const keywords = (config.keywords as string[]) ?? [];
    const matchAny = (config.match_any as boolean) ?? true;
    const [p, found] = keywordPresence(text, keywords, matchAny);
    passed = p;
    if (passed) details = `Found: ${found.slice(0, 4).join(", ")}`;
    else {
      details = `Expected keywords not found: ${keywords.join(", ")}`;
      suggestions.push(`Add content covering: ${keywords.join(", ")}`);
    }
  } else if (ruleType === "keyword_absence") {
    const keywords = (config.keywords as string[]) ?? [];
    const [p, found] = keywordAbsence(text, keywords);
    passed = p;
    if (passed) details = "No disallowed content detected";
    else {
      details = `Disallowed content found: ${found.join(", ")}`;
      suggestions.push(`Remove or replace: ${found.join(", ")}`);
    }
  } else if (ruleType === "section_required") {
    const keywords = (config.keywords as string[]) ?? [(config.section_name as string) ?? ""];
    const [p, found] = keywordPresence(text, keywords, true);
    passed = p;
    const sectionName = (config.section_name as string) || keywords[0] || "required section";
    if (passed) details = `Required section found: ${found.join(", ")}`;
    else {
      details = `Required section '${sectionName}' not found`;
      suggestions.push(`Add a '${sectionName}' section to the document`);
    }
  } else if (ruleType === "min_word_count") {
    const minWords = (config.min_words as number) ?? 200;
    const [p, count] = wordCount(text, minWords);
    passed = p;
    details = `Word count: ${count.toLocaleString()} (minimum: ${minWords.toLocaleString()})`;
    if (!passed) suggestions.push(`Expand the document to at least ${minWords.toLocaleString()} words`);
  } else if (ruleType === "custom_prompt") {
    const promptText = (config.prompt as string) || "";
    if (promptText) {
      try {
        const truncated = text.length > 3000 ? text.slice(0, 3000) : text;
        const aiPrompt =
          `You are a proposal quality reviewer.\n\n` +
          `Document excerpt:\n${truncated}\n\n` +
          `Evaluate this rule: ${promptText}\n\n` +
          `Reply with:\nRESULT: PASS or FAIL\nDETAILS: one sentence explanation`;
        const response = await invokeLlm(aiPrompt, 300, 0.1);
        const lines = response.trim().split(/\r?\n/);
        const resultLine = lines.find((l) => l.toUpperCase().startsWith("RESULT:")) ?? "RESULT: PASS";
        const detailLine = lines.find((l) => l.toUpperCase().startsWith("DETAILS:")) ?? "DETAILS: AI evaluation completed";
        passed = resultLine.toUpperCase().includes("PASS");
        details = detailLine.split(":").slice(1).join(":").trim();
        if (!passed) suggestions.push("Review the document against this custom requirement");
      } catch {
        passed = true;
        details = "AI evaluation unavailable — manual review recommended";
        suggestions.push("Manually verify this custom rule");
      }
    } else {
      passed = true;
      details = "No prompt configured for this rule";
    }
  } else {
    passed = true;
    details = `Unknown rule type: ${ruleType}`;
  }

  const severity = rule.severity ?? "warning";
  const status = passed ? "✓ Passed" : severity === "error" ? "✗ Failed" : "⚠ Review Required";

  return {
    rule_id: rule.id,
    rule_name: rule.name,
    description: rule.description ?? "",
    rule_type: ruleType,
    severity,
    passed,
    status,
    details,
    suggestions,
    is_builtin: Boolean(rule.is_builtin),
  };
}

/** Run the rule engine against the proposal text. */
export async function runRuleReview(text: string, rules: DeepRule[]): Promise<RuleCheck> {
  const activeRules = rules.filter((r) => r.is_active);
  const builtinResults: RuleResult[] = [];
  const customResults: RuleResult[] = [];

  for (const rule of activeRules) {
    const res = await evaluateRule(text, rule);
    (rule.is_builtin ? builtinResults : customResults).push(res);
  }

  const allResults = [...builtinResults, ...customResults];
  const total = allResults.length;
  const passedCount = allResults.filter((r) => r.passed).length;

  return {
    total_rules: total,
    passed_rules: passedCount,
    failed_rules: total - passedCount,
    builtin_rules_count: builtinResults.length,
    custom_rules_count: customResults.length,
    results: allResults,
  };
}
