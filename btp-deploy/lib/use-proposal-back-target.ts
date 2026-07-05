"use client";

import { useEffect, useState } from "react";
import { getLeadByProposalId } from "@/lib/db";

/**
 * Where a proposal page's header "Back" action should go: to the lead it was
 * created from (if any), otherwise to the top-level proposals list.
 */
export function useProposalBackTarget(proposalId: string | undefined) {
  const [target, setTarget] = useState({ label: "Back to Proposals", href: "/proposals" });

  useEffect(() => {
    if (!proposalId) return;
    let cancelled = false;
    getLeadByProposalId(proposalId).then((lead) => {
      if (!cancelled && lead) {
        setTarget({ label: "Back to Proposal Master", href: `/leads/${lead.id}` });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [proposalId]);

  return target;
}
