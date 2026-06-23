"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getProposal, updateProposal, addComment, saveAiReview, getRuleset } from "@/lib/db";
import type { Proposal, Ruleset, AiReviewResult } from "@/lib/types";
import { statusLabels, validationTypeLabels } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";
import {
  ArrowLeft,
  Save,
  CheckCircle2,
  XCircle,
  MessageCircle,
  Send,
  RotateCcw,
  Sparkles,
  Loader2,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  Lightbulb,
} from "lucide-react";
import {
  applyWorkflowAction,
  getActionLabel,
  getAvailableActions,
  type WorkflowAction,
} from "@/lib/workflow-engine";
import { stageLabels } from "@/lib/workflow-config";
import { cn } from "@/lib/utils";
import {
  calculateOverallScore,
  getSectionScore,
  getSubsectionScore,
} from "@/lib/ruleset-utils";
import { runAiReview, extractDocumentText } from "@/lib/ai-review-service";
import { AiReviewScoreCard } from "@/components/ai-review-score-card";

function scoreColor(score: number): string {
  if (score >= 8) return "text-green-600";
  if (score >= 6) return "text-amber-600";
  return "text-red-600";
}

function scoreBg(score: number): string {
  if (score >= 8) return "bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400";
  if (score >= 6) return "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400";
  return "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400";
}

function typeBadgeClass(type: string): string {
  switch (type) {
    case "error":
      return "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400";
    case "warning":
      return "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400";
    case "suggestion":
      return "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400";
    default:
      return "bg-surface-muted text-text-secondary";
  }
}

export default function ReviewPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [ruleset, setRuleset] = useState<Ruleset | null>(null);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState("");
  const [commentText, setCommentText] = useState("");
  const [saving, setSaving] = useState(false);
  const [workflowLoading, setWorkflowLoading] = useState<WorkflowAction["type"] | null>(null);
  const [aiReviewLoading, setAiReviewLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [expandedSubsections, setExpandedSubsections] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const data = await getProposal(id);
      if (cancelled) return;
      if (data) {
        setProposal(data);
        setSummary(data.summary || "");
        if (data.rulesetId) {
          const rs = await getRuleset(data.rulesetId);
          setRuleset(rs ?? null);
          if (rs) {
            setExpandedSections(new Set(rs.sections.map((s) => s.id)));
            setExpandedSubsections(
              new Set(rs.sections.flatMap((s) => s.subsections.map((ss) => ss.id)))
            );
          }
        }
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const aiReview = proposal?.aiReview;
  const ratings = useMemo(() => aiReview?.ratings ?? [], [aiReview]);

  const handleWorkflowAction = async (actionType: WorkflowAction["type"]) => {
    if (!proposal) return;
    setWorkflowLoading(actionType);
    try {
      const updated = await applyWorkflowAction(proposal.id, { type: actionType });
      setProposal(updated);
    } finally {
      setWorkflowLoading(null);
    }
  };

  const saveReview = async () => {
    if (!proposal) return;
    setSaving(true);
    const updated = await updateProposal(proposal.id, { summary });
    if (updated) setProposal(updated);
    setSaving(false);
  };

  const submitComment = async () => {
    if (!proposal || !commentText.trim()) return;
    await addComment(proposal.id, "John Doe", commentText);
    const updated = await getProposal(proposal.id);
    if (updated) setProposal(updated);
    setCommentText("");
  };

  const runAiReviewAction = async () => {
    if (!proposal || !ruleset) return;
    setAiReviewLoading(true);
    setAiError(null);
    try {
      const documentText = await extractDocumentText(proposal);
      const result = await runAiReview({ proposal, ruleset, documentText });
      await saveAiReview(result);
      const updated = await getProposal(proposal.id);
      if (updated) setProposal(updated);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "AI review failed");
    } finally {
      setAiReviewLoading(false);
    }
  };

  const updateRating = (criterionId: string, score: number) => {
    if (!proposal || !ruleset) return;
    const existing = proposal.aiReview ?? {
      id: crypto.randomUUID(),
      proposalId: proposal.id,
      rulesetId: ruleset.id,
      ratings: [],
      overallScore: 0,
      summary: summary,
      strengths: [],
      weaknesses: [],
      recommendations: [],
      generatedAt: new Date(),
    };

    const previous = existing.ratings.find((r) => r.criterionId === criterionId);
    const newRatings = existing.ratings.filter((r) => r.criterionId !== criterionId);
    for (const section of ruleset.sections) {
      for (const subsection of section.subsections) {
        const criterion = subsection.criteria.find((c) => c.id === criterionId);
        if (criterion) {
          newRatings.push({
            criterionId,
            subsectionId: subsection.id,
            sectionId: section.id,
            score,
            type: criterion.type,
            feedback: previous?.feedback || "",
            evidence: previous?.evidence || "",
            issue: previous?.issue || "",
            recommendation: previous?.recommendation || "",
          });
        }
      }
    }

    const updatedReview: AiReviewResult = {
      ...existing,
      ratings: newRatings,
      overallScore: calculateOverallScore(newRatings, ruleset),
      summary,
      generatedAt: new Date(),
    };

    saveAiReview(updatedReview).then(async () => {
      const refreshed = await getProposal(proposal.id);
      if (refreshed) setProposal(refreshed);
    });
  };

  const toggleSection = (sectionId: string) => {
    setExpandedSections((set) => {
      const next = new Set(set);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  };

  const toggleSubsection = (subsectionId: string) => {
    setExpandedSubsections((set) => {
      const next = new Set(set);
      if (next.has(subsectionId)) next.delete(subsectionId);
      else next.add(subsectionId);
      return next;
    });
  };

  if (loading) return <p className="text-text-secondary">Loading review workspace...</p>;
  if (!proposal) return <p className="text-text-secondary">Proposal not found.</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => router.push(`/proposals/${id}`)}>
            <ArrowLeft size={16} className="mr-1" /> Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-text-primary sm:text-3xl">Review Workspace</h1>
            <p className="text-text-secondary">{proposal.title}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant={proposal.status}>{statusLabels[proposal.status]}</Badge>
          <Badge variant="secondary">
            {proposal.workflowStage ? stageLabels[proposal.workflowStage] : "No stage"}
          </Badge>
          <Button onClick={saveReview} disabled={saving}>
            <Save size={16} className="mr-2" /> {saving ? "Saving..." : "Save Review"}
          </Button>
        </div>
      </div>

      {!ruleset && (
        <div className="rounded-xl bg-status-danger-bg p-3 text-sm text-status-danger-text">
          <AlertCircle size={16} className="mr-2 inline" />
          No ruleset assigned to this proposal. Configure one in Settings &gt; Rulesets.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-text-primary">AI Review</h2>
                <p className="text-sm text-text-secondary">
                  Run Claude against the final proposal using the &quot;{ruleset?.name ?? "selected ruleset"}&quot; ruleset.
                </p>
              </div>
              <Button
                onClick={runAiReviewAction}
                disabled={aiReviewLoading || !ruleset || proposal.documents.length === 0}
                variant="secondary"
              >
                {aiReviewLoading ? (
                  <Loader2 size={16} className="mr-2 animate-spin" />
                ) : (
                  <Sparkles size={16} className="mr-2" />
                )}
                {aiReviewLoading ? "Reviewing..." : "Run AI Review"}
              </Button>
            </div>

            {aiError && (
              <div className="rounded-xl bg-status-danger-bg p-3 text-sm text-status-danger-text">
                <AlertCircle size={16} className="mr-2 inline" />
                {aiError}
              </div>
            )}
            {proposal.documents.length === 0 && (
              <p className="text-sm text-text-secondary">
                Upload documents before running AI review.
              </p>
            )}

            {aiReview && (
              <>
                <AiReviewScoreCard
                  aiReview={aiReview}
                  ratings={ratings}
                  rulesetName={ruleset?.name}
                  finalProposalCount={proposal.documents.filter((d) => d.category === "final_proposal").length}
                  contextDocCount={proposal.documents.filter((d) => d.category !== "final_proposal").length}
                />

                <div className="grid gap-6 md:grid-cols-3">
                  {aiReview.strengths.length > 0 && (
                    <div className="rounded-xl border border-green-200 bg-green-50 p-4 dark:border-green-500/30 dark:bg-green-500/10">
                      <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-green-800 dark:text-green-300">
                        <CheckCircle2 size={16} /> Strengths
                      </h4>
                      <ul className="list-inside list-disc space-y-1 text-sm text-green-700 dark:text-green-400">
                        {aiReview.strengths.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {aiReview.weaknesses.length > 0 && (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-500/30 dark:bg-red-500/10">
                      <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-red-800 dark:text-red-300">
                        <XCircle size={16} /> Weaknesses
                      </h4>
                      <ul className="list-inside list-disc space-y-1 text-sm text-red-700 dark:text-red-400">
                        {aiReview.weaknesses.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {aiReview.recommendations.length > 0 && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
                      <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-300">
                        <Lightbulb size={16} /> Recommendations
                      </h4>
                      <ul className="list-inside list-disc space-y-1 text-sm text-amber-700 dark:text-amber-400">
                        {aiReview.recommendations.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Reviewer Summary</CardTitle>
              <CardDescription>Summarize the opportunity, risks, and recommendations.</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="Write a summary..."
                rows={6}
              />
            </CardContent>
          </Card>

          {ruleset && (
            <Card>
              <CardHeader>
                <CardTitle>Scorecard</CardTitle>
                <CardDescription>
                  Section and subsection ratings out of 10. Override AI scores manually if needed.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {ruleset.sections.map((section) => {
                  const sectionScore = getSectionScore(section, ratings);
                  const sectionExpanded = expandedSections.has(section.id);
                  return (
                    <div key={section.id} className="rounded-xl border border-border bg-surface p-4">
                      <button
                        type="button"
                        onClick={() => toggleSection(section.id)}
                        className="flex w-full items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          {sectionExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                          <div className="text-left">
                            <p className="font-medium text-text-primary">{section.title}</p>
                            <p className="text-xs text-text-tertiary">Weight {section.weight.toFixed(2)}</p>
                          </div>
                        </div>
                        <div className={cn("rounded-lg px-2 py-1 text-sm font-semibold", scoreBg(sectionScore))}>
                          {sectionScore} / 10
                        </div>
                      </button>

                      {sectionExpanded && (
                        <div className="mt-3 space-y-3 pl-6">
                          {section.subsections.map((subsection) => {
                            const subsectionScore = getSubsectionScore(subsection, ratings);
                            const subsectionExpanded = expandedSubsections.has(subsection.id);
                            return (
                              <div
                                key={subsection.id}
                                className="rounded-lg border border-border bg-surface-muted/50 p-3"
                              >
                                <button
                                  type="button"
                                  onClick={() => toggleSubsection(subsection.id)}
                                  className="flex w-full items-center justify-between"
                                >
                                  <div className="flex items-center gap-3">
                                    {subsectionExpanded ? (
                                      <ChevronDown size={16} />
                                    ) : (
                                      <ChevronRight size={16} />
                                    )}
                                    <div className="text-left">
                                      <p className="text-sm font-medium text-text-primary">{subsection.title}</p>
                                      <p className="text-xs text-text-tertiary">
                                        Weight {subsection.weight.toFixed(2)}
                                      </p>
                                    </div>
                                  </div>
                                  <div className={cn("rounded-md px-2 py-0.5 text-sm font-semibold", scoreBg(subsectionScore))}>
                                    {subsectionScore} / 10
                                  </div>
                                </button>

                                {subsectionExpanded && (
                                  <div className="mt-3 space-y-4 pl-6">
                                    {subsection.criteria.map((criterion) => {
                                      const rating = ratings.find((r) => r.criterionId === criterion.id);
                                      const score = rating?.score ?? 0;
                                      return (
                                        <div key={criterion.id} className="space-y-2">
                                          <div className="flex items-center justify-between gap-3">
                                            <div>
                                              <div className="flex items-center gap-2">
                                                <p className="text-sm font-medium text-text-primary">
                                                  {criterion.title}
                                                </p>
                                                <span className={cn("rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase", typeBadgeClass(criterion.type))}>
                                                  {validationTypeLabels[criterion.type]}
                                                </span>
                                              </div>
                                              <p className="text-xs text-text-tertiary">
                                                {criterion.description}
                                              </p>
                                            </div>
                                            <span className={cn("text-sm font-semibold", scoreColor(score))}>
                                              {score} / 10
                                            </span>
                                          </div>
                                          <input
                                            type="range"
                                            min={0}
                                            max={10}
                                            step={1}
                                            value={score}
                                            onChange={(e) =>
                                              updateRating(criterion.id, Number(e.target.value))
                                            }
                                            className="w-full accent-primary-600"
                                          />
                                          <div className="flex justify-between text-xs text-text-muted">
                                            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                                              <span key={n}>{n}</span>
                                            ))}
                                          </div>
                                          {rating?.feedback && (
                                            <div className="rounded-lg bg-surface-muted/50 p-2">
                                              <p className="text-[10px] font-semibold uppercase text-text-tertiary">AI Feedback</p>
                                              <p className="text-xs text-text-secondary">{rating.feedback}</p>
                                            </div>
                                          )}
                                          {rating?.evidence && (
                                            <div className="rounded-lg bg-surface-muted/50 p-2">
                                              <p className="text-[10px] font-semibold uppercase text-text-tertiary">Evidence</p>
                                              <p className="text-xs text-text-secondary">{rating.evidence}</p>
                                            </div>
                                          )}
                                          {rating?.issue && (
                                            <div className="rounded-lg border border-red-200 bg-red-50 p-2 dark:border-red-500/30 dark:bg-red-500/10">
                                              <p className="text-[10px] font-semibold uppercase text-red-700 dark:text-red-400">What is wrong</p>
                                              <p className="text-xs text-red-800 dark:text-red-300">{rating.issue}</p>
                                            </div>
                                          )}
                                          {rating?.recommendation && (
                                            <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 dark:border-amber-500/30 dark:bg-amber-500/10">
                                              <p className="text-[10px] font-semibold uppercase text-amber-700 dark:text-amber-400">What should change</p>
                                              <p className="text-xs text-amber-800 dark:text-amber-300">{rating.recommendation}</p>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Decision</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {getAvailableActions(proposal.workflowStage).map((action) => (
                <Button
                  key={action}
                  variant="outline"
                  className={cn(
                    "w-full justify-start transition-colors",
                    action === "approve"
                      ? "border-green-200 text-green-700 hover:bg-green-50 dark:border-green-500/30 dark:text-green-400 dark:hover:bg-green-500/10"
                      : action === "reject"
                        ? "border-red-200 text-red-700 hover:bg-red-50 dark:border-red-500/30 dark:text-red-400 dark:hover:bg-red-500/10"
                        : action === "add_feedback" || action === "request_changes"
                          ? "border-amber-200 text-amber-700 hover:bg-amber-50 dark:border-amber-500/30 dark:text-amber-400 dark:hover:bg-amber-500/10"
                          : "border-border text-text-secondary hover:bg-surface-muted"
                  )}
                  onClick={() => handleWorkflowAction(action)}
                  disabled={workflowLoading === action}
                >
                  {action === "approve" ? (
                    <CheckCircle2 size={18} className="mr-2" />
                  ) : action === "reject" ? (
                    <XCircle size={18} className="mr-2" />
                  ) : action === "add_feedback" ? (
                    <MessageCircle size={18} className="mr-2" />
                  ) : (
                    <RotateCcw size={18} className="mr-2" />
                  )}
                  {workflowLoading === action ? "Processing..." : getActionLabel(action)}
                </Button>
              ))}
              {(proposal.workflowStage === "approved" || proposal.workflowStage === "rejected") && (
                <p className="text-sm text-text-secondary">Proposal is finalized.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Team Comments</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="max-h-80 space-y-3 overflow-y-auto">
                {proposal.comments.length === 0 ? (
                  <p className="text-sm text-text-secondary">No comments yet.</p>
                ) : (
                  proposal.comments.map((comment) => (
                    <div key={comment.id} className="flex gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-muted text-xs font-bold text-text-secondary">
                        {comment.author.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-text-primary">{comment.author}</p>
                          <p className="text-xs text-text-muted">{formatDateTime(comment.createdAt)}</p>
                        </div>
                        <p className="text-sm text-text-secondary">{comment.text}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Add a comment..."
                  className="flex-1 rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  onKeyDown={(e) => e.key === "Enter" && submitComment()}
                />
                <Button size="sm" onClick={submitComment} disabled={!commentText.trim()}>
                  <Send size={16} />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
