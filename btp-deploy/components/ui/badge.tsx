import * as React from "react";
import { cn } from "@/lib/utils";
import type { ProposalStatus, DocumentCategory } from "@/lib/types";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?:
    | "default"
    | "primary"
    | "secondary"
    | "success"
    | "warning"
    | "danger"
    | "info"
    | ProposalStatus
    | DocumentCategory;
}

const statusVariant: Record<ProposalStatus, BadgeProps["variant"]> = {
  draft: "secondary",
  submitted: "info",
  under_review: "warning",
  approved: "success",
  rejected: "danger",
};

const categoryVariant: Record<DocumentCategory, BadgeProps["variant"]> = {
  rfp: "primary",
  transcript: "secondary",
  customer_doc: "success",
  final_proposal: "warning",
  lead_mail: "info",
  lead_mom: "warning",
  lead_discussion: "danger",
  lead_pre_qual_form: "info",
  lead_due_diligence: "primary",
  lead_proposal: "success",
  lead_customer_doc: "success",
  lead_final_deck: "warning",
};

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = "default", ...props }, ref) => {
    let resolved = variant;
    if (["draft", "submitted", "under_review", "approved", "rejected"].includes(variant as string)) {
      resolved = statusVariant[variant as ProposalStatus]!;
    }
    if (["rfp", "transcript", "customer_doc", "final_proposal", "lead_mail", "lead_mom", "lead_discussion", "lead_pre_qual_form", "lead_due_diligence", "lead_proposal", "lead_customer_doc", "lead_final_deck"].includes(variant as string)) {
      resolved = categoryVariant[variant as DocumentCategory]!;
    }

    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset transition-colors",
          {
            "bg-surface-muted text-text-secondary ring-border": resolved === "default" || resolved === "secondary",
            "bg-accent-bg text-accent-text ring-accent-border": resolved === "primary",
            "bg-status-success-bg text-status-success-text ring-status-success-bg": resolved === "success",
            "bg-status-warning-bg text-status-warning-text ring-status-warning-bg": resolved === "warning",
            "bg-status-danger-bg text-status-danger-text ring-status-danger-bg": resolved === "danger",
            "bg-status-info-bg text-status-info-text ring-status-info-bg": resolved === "info",
          },
          className
        )}
        {...props}
      />
    );
  }
);
Badge.displayName = "Badge";

export { Badge };
