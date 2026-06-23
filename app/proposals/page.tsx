"use client";

import { Suspense } from "react";
import { ProposalsPageInner } from "./proposals-page-inner";

export default function ProposalsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div className="h-8 w-1/3 animate-pulse rounded-lg bg-surface-muted" />
          <div className="h-10 animate-pulse rounded-lg bg-surface-muted" />
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-xl bg-surface-muted" />
            ))}
          </div>
        </div>
      }
    >
      <ProposalsPageInner />
    </Suspense>
  );
}
