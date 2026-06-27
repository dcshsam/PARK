import type {
  Ruleset,
  RulesetSection,
  RulesetSubsection,
  RulesetCriterion,
  ReviewRating,
} from "./types";

export function createEmptyRuleset(): Omit<Ruleset, "id" | "createdAt" | "updatedAt"> {
  return {
    name: "New Ruleset",
    description: "",
    isDefault: false,
    isSystem: false,
    sections: [],
  };
}

export function createEmptySection(): RulesetSection {
  return {
    id: crypto.randomUUID(),
    title: "New Section",
    description: "",
    weight: 0,
    subsections: [],
  };
}

export function createEmptySubsection(): RulesetSubsection {
  return {
    id: crypto.randomUUID(),
    title: "New Subsection",
    description: "",
    weight: 0,
    criteria: [],
  };
}

export function createEmptyCriterion(): RulesetCriterion {
  return {
    id: crypto.randomUUID(),
    title: "New Criterion",
    description: "",
    type: "error",
    weight: 1,
    prompt: "",
  };
}

export function normalizeWeights<T extends { weight: number }>(items: T[]): T[] {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  if (total === 0) {
    const equal = 1 / items.length;
    return items.map((item) => ({ ...item, weight: equal }));
  }
  return items.map((item) => ({ ...item, weight: item.weight / total }));
}

export function cloneRuleset(ruleset: Ruleset): Omit<Ruleset, "id" | "createdAt" | "updatedAt"> {
  return {
    name: `${ruleset.name} (Copy)`,
    description: ruleset.description,
    isDefault: false,
    isSystem: false,
    sections: ruleset.sections.map((section) => ({
      ...section,
      id: crypto.randomUUID(),
      subsections: section.subsections.map((subsection) => ({
        ...subsection,
        id: crypto.randomUUID(),
        criteria: subsection.criteria.map((criterion) => ({
          ...criterion,
          id: crypto.randomUUID(),
        })),
      })),
    })),
  };
}

export function findCriterion(ruleset: Ruleset, criterionId: string): RulesetCriterion | undefined {
  for (const section of ruleset.sections) {
    for (const subsection of section.subsections) {
      const criterion = subsection.criteria.find((c) => c.id === criterionId);
      if (criterion) return criterion;
    }
  }
  return undefined;
}

export function findSectionAndSubsection(
  ruleset: Ruleset,
  criterionId: string
): { section: RulesetSection; subsection: RulesetSubsection } | undefined {
  for (const section of ruleset.sections) {
    for (const subsection of section.subsections) {
      if (subsection.criteria.some((c) => c.id === criterionId)) {
        return { section, subsection };
      }
    }
  }
  return undefined;
}

export function calculateOverallScore(ratings: ReviewRating[], ruleset: Ruleset): number {
  if (ratings.length === 0 || ruleset.sections.length === 0) return 0;

  let weightedSum = 0;
  for (const section of ruleset.sections) {
    for (const subsection of section.subsections) {
      for (const criterion of subsection.criteria) {
        const rating = ratings.find((r) => r.criterionId === criterion.id);
        if (rating) {
          weightedSum +=
            rating.score * section.weight * subsection.weight * criterion.weight;
        }
      }
    }
  }

  return Math.round(weightedSum * 10) / 10;
}

export function getSectionScore(
  section: RulesetSection,
  ratings: ReviewRating[]
): number {
  let weightedSum = 0;
  let weightSum = 0;
  for (const subsection of section.subsections) {
    for (const criterion of subsection.criteria) {
      const rating = ratings.find((r) => r.criterionId === criterion.id);
      if (rating) {
        weightedSum += rating.score * subsection.weight * criterion.weight;
        weightSum += subsection.weight * criterion.weight;
      }
    }
  }
  if (weightSum === 0) return 0;
  return Math.round((weightedSum / weightSum) * 10) / 10;
}

export function getSubsectionScore(
  subsection: RulesetSubsection,
  ratings: ReviewRating[]
): number {
  let weightedSum = 0;
  let weightSum = 0;
  for (const criterion of subsection.criteria) {
    const rating = ratings.find((r) => r.criterionId === criterion.id);
    if (rating) {
      weightedSum += rating.score * criterion.weight;
      weightSum += criterion.weight;
    }
  }
  if (weightSum === 0) return 0;
  return Math.round((weightedSum / weightSum) * 10) / 10;
}

export interface ScoreVerdict {
  label: string;
  shortLabel: string;
  color: string;
  bg: string;
  ring: string;
  description: string;
}

export function getVerdict(score: number): ScoreVerdict {
  if (score >= 9) {
    return {
      label: "Excellent",
      shortLabel: "Excellent",
      color: "text-green-700 dark:text-green-400",
      bg: "bg-green-50 dark:bg-green-500/10",
      ring: "stroke-green-500 dark:stroke-green-400",
      description: "Ready to submit. The proposal strongly meets the requirements.",
    };
  }
  if (score >= 8) {
    return {
      label: "Very Good",
      shortLabel: "Very Good",
      color: "text-emerald-700 dark:text-emerald-400",
      bg: "bg-emerald-50 dark:bg-emerald-500/10",
      ring: "stroke-emerald-500 dark:stroke-emerald-400",
      description: "Minor improvements suggested before submission.",
    };
  }
  if (score >= 6) {
    return {
      label: "Average",
      shortLabel: "Average",
      color: "text-amber-700 dark:text-amber-400",
      bg: "bg-amber-50 dark:bg-amber-500/10",
      ring: "stroke-amber-500 dark:stroke-amber-400",
      description: "Acceptable with notable gaps to address.",
    };
  }
  if (score >= 4) {
    return {
      label: "Poor",
      shortLabel: "Poor",
      color: "text-orange-700 dark:text-orange-400",
      bg: "bg-orange-50 dark:bg-orange-500/10",
      ring: "stroke-orange-500 dark:stroke-orange-400",
      description: "Significant rework required before submission.",
    };
  }
  return {
    label: "Not Fit to Submit",
    shortLabel: "Do Not Submit",
    color: "text-red-700 dark:text-red-400",
    bg: "bg-red-50 dark:bg-red-500/10",
    ring: "stroke-red-500 dark:stroke-red-400",
    description: "Critical gaps. Major revision or replacement needed.",
  };
}

export interface ScoreStats {
  total: number;
  error: { count: number; avg: number };
  warning: { count: number; avg: number };
  suggestion: { count: number; avg: number };
  belowThreshold: number;
}

export function getScoreStats(ratings: ReviewRating[]): ScoreStats {
  const byType: Record<"error" | "warning" | "suggestion", number[]> = {
    error: [],
    warning: [],
    suggestion: [],
  };
  let belowThreshold = 0;
  for (const r of ratings) {
    const type = r.type && ["error", "warning", "suggestion"].includes(r.type) ? r.type : "suggestion";
    byType[type].push(r.score);
    if (r.score < 6) belowThreshold++;
  }
  const avg = (arr: number[]) => (arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : 0);
  return {
    total: ratings.length,
    error: { count: byType.error.length, avg: avg(byType.error) },
    warning: { count: byType.warning.length, avg: avg(byType.warning) },
    suggestion: { count: byType.suggestion.length, avg: avg(byType.suggestion) },
    belowThreshold,
  };
}

export function validateRuleset(ruleset: Ruleset): string[] {
  const errors: string[] = [];
  if (!ruleset.name.trim()) errors.push("Ruleset name is required");
  if (ruleset.sections.length === 0) errors.push("Ruleset must have at least one section");

  for (const section of ruleset.sections) {
    if (!section.title.trim()) errors.push(`Section title is required`);
    if (section.subsections.length === 0)
      errors.push(`Section "${section.title}" must have at least one subsection`);
    for (const subsection of section.subsections) {
      if (!subsection.title.trim()) errors.push(`Subsection title is required`);
      if (subsection.criteria.length === 0)
        errors.push(`Subsection "${subsection.title}" must have at least one criterion`);
      for (const criterion of subsection.criteria) {
        if (!criterion.title.trim()) errors.push(`Criterion title is required`);
      }
    }
  }

  return errors;
}
