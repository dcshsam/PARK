"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getLead } from "@/lib/db";
import { LeadForm } from "@/components/lead-form";
import { RequireAccess } from "@/components/require-access";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import type { Lead } from "@/lib/types";

export default function LeadDetailPage() {
  return (
    <RequireAccess action="view">
      <LeadDetailContent />
    </RequireAccess>
  );
}

function LeadDetailContent() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    getLead(id).then((data) => {
      setLead(data ?? null);
      setLoading(false);
    });
  }, [id]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-1/3 animate-pulse rounded-lg bg-surface-muted" />
        <div className="h-10 w-full animate-pulse rounded-lg bg-surface-muted" />
        <div className="h-64 animate-pulse rounded-xl bg-surface-muted" />
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="space-y-6">
        <Button variant="outline" size="sm" onClick={() => router.push("/leads")}>
          <ArrowLeft size={16} className="mr-1" /> Back to Proposal Master
        </Button>
        <div className="rounded-xl border border-border bg-surface p-8 text-center">
          <p className="text-lg font-semibold text-text-primary">Lead not found</p>
          <p className="text-text-secondary">The lead you are looking for does not exist.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Button variant="outline" size="sm" onClick={() => router.push("/leads")}>
        <ArrowLeft size={16} className="mr-1" /> Back to Proposal Master
      </Button>
      <LeadForm lead={lead} />
    </div>
  );
}
