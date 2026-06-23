"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getProposal } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { WorkflowRoadmap } from "@/components/workflow-roadmap";
import type { Proposal } from "@/lib/types";
import { ArrowLeft, Loader2 } from "lucide-react";

export default function RoadmapPage() {
  const params = useParams();
  const id = params.id as string;
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getProposal(id).then((data) => {
      if (!cancelled) {
        setProposal(data ?? null);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 size={24} className="animate-spin text-text-muted" />
      </div>
    );
  }

  if (!proposal) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-text-primary">Proposal not found</h1>
        <Link href="/proposals">
          <Button variant="outline">Back to proposals</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/proposals/${proposal.id}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft size={16} className="mr-2" /> Back to Proposal
          </Button>
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-text-primary sm:text-3xl">{proposal.title}</h1>
        <p className="text-text-secondary">Workflow roadmap and review history</p>
      </div>

      <WorkflowRoadmap proposal={proposal} onChange={setProposal} />
    </div>
  );
}
