"use client";

import type { DeepReview } from "@/lib/deep-review/types";
import type { Lead } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * The AI Enabled Review score for a lead's linked proposal, shown next to the
 * lead status everywhere leads are listed. A lead with no proposal yet has no
 * score to show; one whose proposal hasn't been reviewed says so rather than
 * rendering nothing, so a missing score can't be mistaken for a broken badge.
 */
export function ProposalScoreBadge({
  lead,
  reviews,
}: {
  lead: Pick<Lead, "proposalId">;
  reviews: Map<string, DeepReview>;
}) {
  if (!lead.proposalId) return null;
  const score = reviews.get(lead.proposalId)?.overall_score;

  if (score === undefined) {
    return (
      <span className="rounded-full bg-surface-muted px-2.5 py-0.5 text-xs font-medium text-text-tertiary">
        Not reviewed
      </span>
    );
  }

  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-0.5 text-xs font-semibold",
        score >= 80
          ? "bg-green-100 text-green-700"
          : score >= 60
            ? "bg-yellow-100 text-yellow-700"
            : "bg-red-100 text-red-700"
      )}
      title="AI Enabled Review score"
    >
      {score}/100
    </span>
  );
}
