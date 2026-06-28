// Section definitions, criteria keywords and strictness config.
// Ported from deep_review_service.py.

import type { Strictness, Verdict } from "./types";

export interface StrictnessConfig {
  label: string;
  ai_instruction: string;
  score_adjustment: number;
  min_word_count: number;
  verdict_thresholds: { Excellent: number; Good: number; "Needs Improvement": number };
}

export const STRICTNESS_CONFIG: Record<Strictness, StrictnessConfig> = {
  low: {
    label: "Low",
    ai_instruction:
      "Apply a LENIENT standard. If a section partially addresses a criterion, mark it PASSED. " +
      "Only flag truly missing sections or critically incomplete content. " +
      "Be generous in scoring — reflect the positive aspects of the proposal. " +
      "Avoid penalising for minor omissions or lack of detail.",
    score_adjustment: 8,
    min_word_count: 100,
    verdict_thresholds: { Excellent: 75, Good: 55, "Needs Improvement": 35 },
  },
  medium: {
    label: "Medium",
    ai_instruction:
      "Apply a BALANCED, practical standard. Mark a criterion as passed if the proposal " +
      "adequately addresses it, even without perfect detail. Flag genuinely missing content " +
      "and incomplete sections. Score should be fair and representative.",
    score_adjustment: 0,
    min_word_count: 200,
    verdict_thresholds: { Excellent: 85, Good: 70, "Needs Improvement": 50 },
  },
  high: {
    label: "High",
    ai_instruction:
      "Apply a RIGOROUS professional standard. Only mark a criterion as PASSED if it is " +
      "fully, explicitly, and specifically addressed with evidence from the document. " +
      "Vague claims, implied content, or missing quantification must be marked FAILED. " +
      "Be thorough and demanding. Scores should reflect a high bar for quality.",
    score_adjustment: -8,
    min_word_count: 500,
    verdict_thresholds: { Excellent: 90, Good: 75, "Needs Improvement": 55 },
  },
};

export const DEFAULT_STRICTNESS: Strictness = "medium";

export function getStrictnessConfig(strictness: string): StrictnessConfig {
  return STRICTNESS_CONFIG[strictness as Strictness] ?? STRICTNESS_CONFIG[DEFAULT_STRICTNESS];
}

export function applyVerdict(score: number, strictness: string): Verdict {
  const t = getStrictnessConfig(strictness).verdict_thresholds;
  if (score >= t.Excellent) return "Excellent";
  if (score >= t.Good) return "Good";
  if (score >= t["Needs Improvement"]) return "Needs Improvement";
  return "Poor";
}

export interface SectionDef {
  name: string;
  keywords: string[];
  criteria: string[];
}

export const SECTIONS: SectionDef[] = [
  {
    name: "Executive Summary",
    keywords: ["executive summary", "overview", "introduction"],
    criteria: [
      "Clear problem or challenge statement",
      "Value proposition articulated",
      "Key benefits quantified (numbers/metrics)",
      "Expected outcomes or goals defined",
      "Appropriate executive-level tone and length",
    ],
  },
  {
    name: "Scope & Deliverables",
    keywords: ["scope", "deliverable", "in-scope", "out-of-scope"],
    criteria: [
      "Clear scope boundaries defined",
      "Specific deliverables listed",
      "Acceptance criteria or DoD stated",
      "Out-of-scope items explicitly mentioned",
      "Dependencies and assumptions identified",
    ],
  },
  {
    name: "Technical Approach",
    keywords: ["technical", "architecture", "methodology", "solution", "approach"],
    criteria: [
      "Methodology or framework explained",
      "Technology stack or tools specified",
      "System architecture or design described",
      "Differentiation or innovation highlighted",
      "Scalability and feasibility addressed",
    ],
  },
  {
    name: "Timeline & Milestones",
    keywords: ["timeline", "milestone", "schedule", "phase", "week", "month"],
    criteria: [
      "Project phases clearly defined",
      "Specific durations or target dates provided",
      "Milestone criteria and exit conditions clear",
      "Inter-phase dependencies addressed",
      "Buffer or contingency time included",
    ],
  },
  {
    name: "Team & Expertise",
    keywords: ["team", "expert", "experience", "personnel", "resource", "consultant"],
    criteria: [
      "Team structure and roles presented",
      "Relevant domain experience demonstrated",
      "Key personnel identified by name or title",
      "Skills aligned with project requirements",
      "Organizational chart or RACI referenced",
    ],
  },
  {
    name: "Pricing & Commercial",
    keywords: ["pricing", "cost", "investment", "commercial", "budget", "price", "fee"],
    criteria: [
      "Detailed cost or pricing breakdown provided",
      "Pricing model explained (fixed/T&M/hybrid)",
    ],
  },
  {
    name: "Presentation Quality",
    keywords: [],
    criteria: [
      "Professional and consistent formatting throughout",
      "Clear, concise, and jargon-free language",
      "No spelling or grammatical errors",
      "Logical document flow and structure",
      "No incomplete placeholders or draft content",
    ],
  },
];

export const CRITERIA_KEYWORDS: Record<string, string[]> = {
  "Clear problem or challenge statement": ["problem", "challenge", "issue", "need", "requirement", "pain point"],
  "Value proposition articulated": ["value", "benefit", "roi", "return on investment", "saving", "advantage"],
  "Key benefits quantified (numbers/metrics)": ["%", "million", "thousand", "percent", "hours", "days", "reduction", "increase"],
  "Expected outcomes or goals defined": ["outcome", "result", "achieve", "goal", "objective", "target"],
  "Appropriate executive-level tone and length": ["executive", "strategic", "vision", "leadership"],
  "Clear scope boundaries defined": ["in scope", "in-scope", "scope includes", "boundary"],
  "Specific deliverables listed": ["deliverable", "deliver", "produce", "artifact", "output"],
  "Acceptance criteria or DoD stated": ["acceptance", "done", "criteria", "sign-off", "sign off"],
  "Out-of-scope items explicitly mentioned": ["out of scope", "out-of-scope", "excluded", "not included"],
  "Dependencies and assumptions identified": ["dependency", "assumption", "dependent", "prerequisite"],
  "Methodology or framework explained": ["methodology", "framework", "agile", "waterfall", "scrum", "prince2"],
  "Technology stack or tools specified": ["sap", "azure", "aws", "cloud", "platform", "technology", "tool", "stack"],
  "System architecture or design described": ["architecture", "design", "system", "component", "integration", "interface"],
  "Differentiation or innovation highlighted": ["innovative", "unique", "differentiat", "advantage", "leading"],
  "Scalability and feasibility addressed": ["scalab", "feasib", "extensib", "future-proof", "growth"],
  "Project phases clearly defined": ["phase", "stage", "step", "sprint", "iteration"],
  "Specific durations or target dates provided": ["week", "month", "day", "q1", "q2", "q3", "q4", "2024", "2025", "2026"],
  "Milestone criteria and exit conditions clear": ["milestone", "gate", "checkpoint", "review"],
  "Inter-phase dependencies addressed": ["dependency", "parallel", "sequential", "prerequisite"],
  "Buffer or contingency time included": ["buffer", "contingency", "slack", "reserve"],
  "Team structure and roles presented": ["team", "role", "structure", "member", "lead", "manager"],
  "Relevant domain experience demonstrated": ["experience", "year", "expert", "speciali", "certified"],
  "Key personnel identified by name or title": ["architect", "consultant", "manager", "lead", "analyst"],
  "Skills aligned with project requirements": ["skill", "competenc", "qualification", "proficien"],
  "Organizational chart or RACI referenced": ["raci", "org chart", "organization", "responsibility"],
  "Detailed cost or pricing breakdown provided": ["cost breakdown", "pricing", "rate", "fee", "charge", "cost"],
  "Pricing model explained (fixed/T&M/hybrid)": ["fixed price", "time and material", "t&m", "hybrid", "model"],
  "Professional and consistent formatting throughout": [],
  "Clear, concise, and jargon-free language": [],
  "No spelling or grammatical errors": [],
  "Logical document flow and structure": [],
  "No incomplete placeholders or draft content": ["tbd", "todo", "lorem ipsum", "[placeholder]"],
};
