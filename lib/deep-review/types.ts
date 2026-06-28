// Deep AI Review ("AI Enabled Review") result types.
//
// Ported faithfully from the SAP SPR (PROJECT NEXT) backend deep-review engine
// (deep_review_service.py / review_service.py / numerical_check_service.py /
// context_service.py). The output shape matches the original 1:1 so the review
// UI can render the same Overview / Checklist / Errors / Warnings / Improvements
// / Rule Checks / Requirement Coverage / Numerical Check tabs.

export type Strictness = "low" | "medium" | "high";

export type Verdict = "Excellent" | "Good" | "Needs Improvement" | "Poor" | "Critical" | "Unknown";

export interface ChecklistItem {
  criterion: string;
  passed: boolean;
  note: string;
}

export interface ReviewSection {
  name: string;
  score: number; // 0-100
  found: boolean;
  checklist: ChecklistItem[];
  errors: string[];
  improvements: string[];
}

export interface CriticalIssue {
  issue: string;
  impact: string;
  fix: string;
}

export interface ErrorItem {
  section: string;
  error: string;
  severity: "error" | "warning";
}

export interface ImprovementItem {
  priority: "quick_win" | "improvement";
  section: string;
  action: string;
  benefit: string;
}

export interface RuleResult {
  rule_id: string | null;
  rule_name: string;
  description: string;
  rule_type: string;
  severity: "error" | "warning";
  passed: boolean;
  status: string;
  details: string;
  suggestions: string[];
  is_builtin: boolean;
}

export interface RuleCheck {
  total_rules: number;
  passed_rules: number;
  failed_rules: number;
  builtin_rules_count: number;
  custom_rules_count: number;
  results: RuleResult[];
}

export interface CoverageItem {
  requirement_id: string | null;
  requirement_title: string;
  status: "addressed" | "partial" | "missing" | string;
  evidence: string;
  gap: string;
}

export interface RequirementCoverage {
  coverage_score: number;
  addressed_count: number;
  partial_count: number;
  missing_count: number;
  items: CoverageItem[];
  missing_topics: string[];
  summary: string;
}

export interface NumericalComponent {
  name?: string;
  value?: number | string;
}

export interface NumericalDiscrepancy {
  id: string;
  kind: string;
  label: string;
  context: string;
  unit: string;
  expected: number;
  stated: number;
  diff: number;
  components: NumericalComponent[];
  message: string;
}

export interface NumericalCheck {
  claims_extracted: number;
  checked: number;
  ok: number;
  discrepancies: NumericalDiscrepancy[];
  skipped_low_confidence?: number;
}

export interface DeepReview {
  id: string;
  proposalId: string;
  file_name: string;
  word_count: number;
  analyzed_at: string;
  ai_powered: boolean;
  strictness: Strictness;
  overall_score: number;
  verdict: Verdict;
  summary: string;
  strengths: string[];
  sections: ReviewSection[];
  criteria_total: number;
  criteria_passed: number;
  criteria_failed: number;
  critical_issues: CriticalIssue[];
  all_errors: ErrorItem[];
  all_improvements: ImprovementItem[];
  rule_check: RuleCheck;
  requirement_coverage?: RequirementCoverage | null;
  numerical_check?: NumericalCheck | null;
  modelUsed?: string;
}

// A customer requirement extracted from the supporting documents and used to
// drive the requirement-coverage analysis.
export interface ExtractedRequirement {
  id: string;
  title: string;
  description: string;
  priority: "must_have" | "should_have" | "nice_to_have";
  source_file: string;
}
