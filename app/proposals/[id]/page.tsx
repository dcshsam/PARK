"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getProposal, updateProposal } from "@/lib/db";
import type { Proposal, ProposalStatus } from "@/lib/types";
import { formatDate, formatDateTime, formatBytes } from "@/lib/utils";
import { statusLabels, categoryLabels } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { ArrowLeft, FileText, MessageSquare, Eye, Pencil, ClipboardList, Route } from "lucide-react";
import { stageLabels } from "@/lib/workflow-config";
import { AiReviewScoreCard } from "@/components/ai-review-score-card";

export default function ProposalDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    getProposal(id).then((data) => {
      setProposal(data || null);
      setLoading(false);
    });
  }, [id]);

  const changeStatus = async (status: ProposalStatus) => {
    if (!proposal) return;
    const updated = await updateProposal(proposal.id, { status });
    if (updated) setProposal(updated);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-1/3 animate-pulse rounded-lg bg-surface-muted" />
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <div className="h-64 animate-pulse rounded-xl bg-surface-muted" />
            <div className="h-48 animate-pulse rounded-xl bg-surface-muted" />
          </div>
          <div className="space-y-6">
            <div className="h-40 animate-pulse rounded-xl bg-surface-muted" />
            <div className="h-56 animate-pulse rounded-xl bg-surface-muted" />
          </div>
        </div>
      </div>
    );
  }

  if (!proposal) return <p className="text-text-secondary">Proposal not found.</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => router.push("/proposals")}>
            <ArrowLeft size={16} className="mr-1" /> Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-text-primary sm:text-3xl">{proposal.title}</h1>
            <p className="text-text-secondary">{proposal.clientName}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Select
            value={proposal.status}
            onChange={(e) => changeStatus(e.target.value as ProposalStatus)}
            className="w-44"
          >
            {(["draft", "submitted", "under_review", "approved", "rejected"] as ProposalStatus[]).map((s) => (
              <option key={s} value={s}>
                {statusLabels[s]}
              </option>
            ))}
          </Select>
          <Link href={`/proposals/${proposal.id}/roadmap`}>
            <Button variant="outline">
              <Route size={18} className="mr-2" /> Roadmap
            </Button>
          </Link>
          <Link href={`/proposals/${proposal.id}/review`}>
            <Button>
              <ClipboardList size={18} className="mr-2" /> Review
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Overview</CardTitle>
              <CardDescription>Core information about this proposal.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Info label="Status">
                  <Badge variant={proposal.status}>{statusLabels[proposal.status]}</Badge>
                </Info>
                <Info label="Workflow Stage">
                  <p className="text-sm font-medium text-text-primary">
                    {proposal.workflowStage ? stageLabels[proposal.workflowStage] : "Not started"}
                  </p>
                </Info>
                <Info label="Due Date">
                  <p className="text-sm text-text-primary">{proposal.dueDate ? formatDate(proposal.dueDate) : "Not set"}</p>
                </Info>
                <Info label="Technology">
                  <p className="text-sm text-text-primary">{proposal.technology || "Not set"}</p>
                </Info>
                <Info label="Project Type">
                  <p className="text-sm text-text-primary">{proposal.projectType || "Not set"}</p>
                </Info>
                <Info label="Sparc Owner">
                  <p className="text-sm text-text-primary">{proposal.sparcOwner || "Not set"}</p>
                </Info>
                <Info label="Sparc Mentor">
                  <p className="text-sm text-text-primary">{proposal.sparcMentor || "Not set"}</p>
                </Info>
                <Info label="GTM Owner">
                  <p className="text-sm text-text-primary">{proposal.gtmOwner || "Not set"}</p>
                </Info>
                <Info label="Proposal Reviewer">
                  <p className="text-sm text-text-primary">{proposal.proposalReviewer || "Not set"}</p>
                </Info>
                <Info label="Proposal Region">
                  <p className="text-sm text-text-primary">{proposal.proposalRegion || "Not set"}</p>
                </Info>
                <Info label="Created">
                  <p className="text-sm text-text-primary">{formatDateTime(proposal.createdAt)}</p>
                </Info>
                <Info label="Last Updated">
                  <p className="text-sm text-text-primary">{formatDateTime(proposal.updatedAt)}</p>
                </Info>
              </div>
              {proposal.description && (
                <div className="rounded-xl bg-surface-muted/50 p-4">
                  <p className="text-xs font-medium uppercase text-text-tertiary">Description</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-text-primary">{proposal.description}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Documents</CardTitle>
                <CardDescription>Files attached to this review.</CardDescription>
              </div>
              <Link href={`/proposals/${proposal.id}/documents`}>
                <Button variant="outline" size="sm">
                  <Eye size={16} className="mr-1" /> View all
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {proposal.documents.length === 0 ? (
                <p className="text-sm text-text-secondary">No documents uploaded.</p>
              ) : (
                <ul className="divide-y divide-border-subtle rounded-xl border border-border">
                  {proposal.documents.map((doc) => (
                    <li key={doc.id} className="flex items-center justify-between px-4 py-3 transition-colors hover:bg-surface-muted/30">
                      <div className="flex items-center gap-3 min-w-0">
                        <FileText size={18} className="shrink-0 text-text-muted" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-text-primary">{doc.name}</p>
                          <p className="text-xs text-text-tertiary">
                            {categoryLabels[doc.category]} • {formatBytes(doc.size)}
                          </p>
                        </div>
                      </div>
                      <Badge variant={doc.category}>{categoryLabels[doc.category]}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Review Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-xs font-medium uppercase text-text-tertiary">AI / Reviewer Summary</p>
                <p className="mt-1 text-sm text-text-secondary">
                  {proposal.summary || "No summary yet. Open the review workspace to add one."}
                </p>
              </div>
              {proposal.aiReview && (
                <AiReviewScoreCard
                  aiReview={proposal.aiReview}
                  ratings={proposal.aiReview.ratings}
                  rulesetName={undefined}
                  finalProposalCount={proposal.documents.filter((d) => d.category === "final_proposal").length}
                  contextDocCount={proposal.documents.filter((d) => d.category !== "final_proposal").length}
                  compact
                />
              )}
              {!proposal.aiReview && proposal.score?.overall && (
                <div className="rounded-xl bg-accent-bg p-4">
                  <p className="text-xs font-medium uppercase text-accent-text">Legacy Overall Score</p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-3xl font-bold text-text-primary">{proposal.score.overall}</span>
                    <span className="text-sm text-text-secondary">/ 5</span>
                  </div>
                </div>
              )}
              <Link href={`/proposals/${proposal.id}/review`}>
                <Button variant="outline" className="w-full">
                  <Pencil size={16} className="mr-2" /> Edit Review
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Activity</CardTitle>
            </CardHeader>
            <CardContent>
              {proposal.comments.length === 0 ? (
                <p className="text-sm text-text-secondary">No comments yet.</p>
              ) : (
                <ul className="space-y-4">
                  {proposal.comments.slice(-3).map((comment) => (
                    <li key={comment.id} className="flex gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-muted text-xs font-bold text-text-secondary">
                        {comment.author.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-text-primary">{comment.author}</p>
                        <p className="text-sm text-text-secondary">{comment.text}</p>
                        <p className="text-xs text-text-muted">{formatDateTime(comment.createdAt)}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-4 flex items-center gap-2 border-t border-border-subtle pt-3 text-sm text-text-tertiary">
                <MessageSquare size={16} />
                <span>{proposal.comments.length} comment(s)</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase text-text-tertiary">{label}</p>
      <div className="mt-1">{children}</div>
    </div>
  );
}
