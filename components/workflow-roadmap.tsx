"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  applyWorkflowAction,
  getActionLabel,
  getAvailableActions,
  type WorkflowAction,
} from "@/lib/workflow-engine";
import {
  cycleTheme,
  stageLabels,
  stageShortLabels,
  cycleTypeLabels,
  isReworkStage,
  isFeedbackStage,
  isFinalReviewStage,
  isCompletedStage,
  getCycleType,
} from "@/lib/workflow-config";
import {
  formatDurationShort,
  getCycleSummary,
  getStageDurations,
  getStageStatus,
  getTotalProposalDuration,
  groupStagesByCycle,
} from "@/lib/workflow-utils";
import type { Proposal, WorkflowStage, ReviewCycleType } from "@/lib/types";
import {
  Check,
  Clock,
  Loader2,
  RotateCcw,
  MessageSquare,
  XCircle,
  ArrowRight,
  FileText,
  Truck,
  Users,
  AlertCircle,
  ThumbsUp,
  Send,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface WorkflowRoadmapProps {
  proposal: Proposal;
  onChange: (proposal: Proposal) => void;
}

function getStageIcon(stage: WorkflowStage): React.ElementType {
  if (stage === "intake") return FileText;
  if (stage === "approved") return Check;
  if (stage === "rejected") return XCircle;
  if (isReworkStage(stage)) return RefreshCw;
  if (isFeedbackStage(stage)) return MessageSquare;
  if (isFinalReviewStage(stage)) return ThumbsUp;
  if (isCompletedStage(stage)) return Check;
  return FileText;
}

function getStageTheme(stage: WorkflowStage, cycleType: ReviewCycleType | null) {
  if (stage === "approved") {
    return {
      color: "text-green-700 dark:text-green-400",
      bg: "bg-green-600",
      border: "border-green-200 dark:border-green-500/30",
      lightBg: "bg-green-50 dark:bg-green-500/10",
      iconColor: "text-green-600 dark:text-green-400",
    };
  }
  if (stage === "rejected") {
    return {
      color: "text-red-700 dark:text-red-400",
      bg: "bg-red-600",
      border: "border-red-200 dark:border-red-500/30",
      lightBg: "bg-red-50 dark:bg-red-500/10",
      iconColor: "text-red-600 dark:text-red-400",
    };
  }
  if (stage === "intake") {
    return {
      color: "text-text-secondary",
      bg: "bg-text-secondary",
      border: "border-border",
      lightBg: "bg-surface-muted",
      iconColor: "text-text-secondary",
    };
  }
  return cycleType ? cycleTheme[cycleType] : cycleTheme.proposal;
}

export function WorkflowRoadmap({ proposal, onChange }: WorkflowRoadmapProps) {
  const [loading, setLoading] = useState<WorkflowAction["type"] | null>(null);
  const [note, setNote] = useState("");

  const currentStage = proposal.workflowStage;
  const currentCycleType = currentStage ? getCycleType(currentStage) : null;
  const currentTheme = getStageTheme(currentStage ?? "intake", currentCycleType);
  const events = proposal.workflowEvents;
  const cycles = proposal.workflowCycles;
  const availableActions = getAvailableActions(currentStage);

  const stageDurations = useMemo(() => getStageDurations(events), [events]);
  const currentStageDuration = stageDurations[stageDurations.length - 1]?.durationMs ?? 0;
  const totalDuration = useMemo(() => getTotalProposalDuration(proposal), [proposal]);

  const handleAction = async (actionType: WorkflowAction["type"]) => {
    setLoading(actionType);
    try {
      const action: WorkflowAction =
        actionType === "request_changes"
          ? { type: actionType, note, feedbackSummary: note }
          : { type: actionType, note };
      const updated = await applyWorkflowAction(proposal.id, action);
      onChange(updated);
      setNote("");
    } finally {
      setLoading(null);
    }
  };

  const cycleGroups = groupStagesByCycle();

  return (
    <div className="space-y-6">
      {/* Current Status Hero */}
      <Card className={cn("overflow-hidden border-l-4", currentTheme.border)}>
        <div className={cn("h-2 w-full", currentTheme.bg)} />
        <CardContent className="p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium text-text-tertiary">Current Stage</p>
              <h2 className={cn("text-2xl font-bold", currentTheme.color)}>
                {currentStage ? stageLabels[currentStage] : "Not started"}
              </h2>
              {currentCycleType && (
                <Badge variant="secondary" className={cn("font-medium", currentTheme.lightBg, currentTheme.color)}>
                  {cycleTypeLabels[currentCycleType]} Cycle
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap gap-4 text-sm">
              <Metric label="Time in stage" value={formatDurationShort(currentStageDuration)} />
              <Metric label="Total time" value={formatDurationShort(totalDuration)} />
              <Metric
                label="Iterations"
                value={String(cycles.find((c) => c.id === proposal.currentCycleId)?.iteration ?? 1)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action Panel */}
      {currentStage && currentStage !== "approved" && currentStage !== "rejected" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Take Action</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3">
              {availableActions.map((action) => (
                <Button
                  key={action}
                  onClick={() => handleAction(action)}
                  disabled={loading !== null}
                  variant={
                    action === "approve"
                      ? "primary"
                      : action === "reject" || action === "reject_to_sparc"
                        ? "danger"
                        : "outline"
                  }
                  size="sm"
                >
                  {loading === action ? (
                    <Loader2 size={16} className="mr-2 animate-spin" />
                  ) : action === "approve" ? (
                    <Check size={16} className="mr-2" />
                  ) : action === "reject" || action === "reject_to_sparc" ? (
                    <XCircle size={16} className="mr-2" />
                  ) : action === "add_feedback" ? (
                    <MessageSquare size={16} className="mr-2" />
                  ) : action === "submit_changes" ? (
                    <Send size={16} className="mr-2" />
                  ) : (
                    <RotateCcw size={16} className="mr-2" />
                  )}
                  {getActionLabel(action)}
                </Button>
              ))}
            </div>

            {(availableActions.includes("add_feedback") ||
              availableActions.includes("request_changes") ||
              availableActions.includes("reject_to_sparc")) && (
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add a note or feedback context for this action..."
                rows={3}
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* Roadmap Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Workflow Roadmap</CardTitle>
          <CardDescription>Visual timeline across all review cycles.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          {cycleGroups.map((group) => {
            const theme = cycleTheme[group.cycleType];
            const cycle = cycles
              .filter((c) => c.cycleType === group.cycleType)
              .sort((a, b) => b.iteration - a.iteration)[0];
            const summary = cycle ? getCycleSummary(cycle, events) : null;

            return (
              <div key={group.cycleType} className="relative">
                {/* Cycle header */}
                <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", theme.lightBg)}>
                      {group.cycleType === "proposal" && <FileText size={20} className={theme.iconColor} />}
                      {group.cycleType === "delivery" && <Truck size={20} className={theme.iconColor} />}
                      {group.cycleType === "customer" && <Users size={20} className={theme.iconColor} />}
                    </div>
                    <div>
                      <h3 className={cn("text-base font-semibold", theme.color)}>{theme.label}</h3>
                      <p className="text-xs text-text-tertiary">
                        {summary ? `${summary.iterations} iteration(s)` : "Not started"}
                      </p>
                    </div>
                  </div>
                  {summary && (
                    <div className="flex items-center gap-1 text-xs font-medium text-text-tertiary">
                      <Clock size={14} />
                      {formatDurationShort(summary.durationMs)}
                    </div>
                  )}
                </div>

                {/* Connected stages */}
                <div className="relative">
                  {/* Horizontal connector line (desktop) */}
                  <div className="absolute left-0 right-0 top-6 hidden h-0.5 bg-border md:block" />

                  <div className="grid gap-4 md:grid-cols-5">
                    {group.stages.map((stage) => {
                      const status = getStageStatus(stage, currentStage, events);
                      const duration = stageDurations.find((d) => d.stage === stage);
                      const Icon = getStageIcon(stage);

                      return (
                        <div key={stage} className="relative flex flex-col items-center text-center">
                          {/* Node */}
                          <div
                            className={cn(
                              "relative z-10 flex h-12 w-12 items-center justify-center rounded-full border-2 transition-all",
                              status === "completed"
                                ? cn("text-white", theme.bg, "border-transparent")
                                : status === "active"
                                  ? cn("bg-surface", theme.border, theme.iconColor)
                                  : "border-border bg-surface text-text-muted"
                            )}
                          >
                            <Icon size={20} />
                          </div>

                          {/* Label */}
                          <div className="mt-3 space-y-1">
                            <p
                              className={cn(
                                "text-xs font-semibold",
                                status === "pending" ? "text-text-muted" : "text-text-primary"
                              )}
                            >
                              {stageShortLabels[stage]}
                            </p>
                            {duration && status !== "pending" && (
                              <p className={cn("text-xs font-medium", theme.iconColor)}>
                                {formatDurationShort(duration.durationMs)}
                              </p>
                            )}
                            {duration && status !== "pending" && (
                              <p className="text-[10px] text-text-muted">
                                {duration.enteredAt.toLocaleDateString()}
                              </p>
                            )}
                          </div>

                          {/* Iteration badge on rework */}
                          {isReworkStage(stage) && status !== "pending" && cycle && cycle.iteration > 1 && (
                            <span
                              className={cn(
                                "absolute -right-1 -top-1 z-20 flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-[10px] font-bold text-white",
                                theme.bg
                              )}
                            >
                              {cycle.iteration}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Feedback summary */}
                {cycle?.feedbackSummary && (
                  <div className={cn("mt-4 rounded-xl border p-3 text-sm", theme.border, theme.lightBg)}>
                    <div className="flex items-center gap-2">
                      <AlertCircle size={14} className={theme.iconColor} />
                      <span className={cn("font-medium", theme.color)}>Latest feedback</span>
                    </div>
                    <p className="mt-1 text-text-secondary">{cycle.feedbackSummary}</p>
                  </div>
                )}
              </div>
            );
          })}

          {/* Final outcome */}
          <div className="flex items-center justify-center">
            <div
              className={cn(
                "flex items-center gap-3 rounded-2xl border px-6 py-4",
                currentStage === "approved"
                  ? "border-green-200 bg-green-50 dark:border-green-500/30 dark:bg-green-500/10"
                  : currentStage === "rejected"
                    ? "border-red-200 bg-red-50 dark:border-red-500/30 dark:bg-red-500/10"
                    : "border-border bg-surface-muted"
              )}
            >
              {currentStage === "approved" ? (
                <Check size={24} className="text-green-600 dark:text-green-400" />
              ) : currentStage === "rejected" ? (
                <XCircle size={24} className="text-red-600 dark:text-red-400" />
              ) : (
                <ArrowRight size={24} className="text-text-muted" />
              )}
              <div>
                <p className="font-semibold text-text-primary">
                  {currentStage === "approved"
                    ? "Approved & Ready"
                    : currentStage === "rejected"
                      ? "Rejected"
                      : "Awaiting Final Approval"}
                </p>
                <p className="text-xs text-text-tertiary">
                  Total lead time: {formatDurationShort(totalDuration)}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Activity History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Activity History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative space-y-0">
            <div className="absolute bottom-2 left-2 top-2 w-0.5 bg-border" />
            {events
              .slice()
              .reverse()
              .map((event) => {
                const cycleType = event.toStage ? getCycleType(event.toStage) : null;
                const theme = cycleType ? cycleTheme[cycleType] : cycleTheme.proposal;

                return (
                  <div key={event.id} className="relative flex gap-4 py-3 pl-1">
                    <div
                      className={cn(
                        "relative z-10 mt-1.5 h-3 w-3 rounded-full border-2 border-surface",
                        theme.bg
                      )}
                    />
                    <div className="flex-1">
                      <p className="text-sm text-text-primary">
                        <span className="font-medium">{event.actor}</span>{" "}
                        {event.type === "cycle_started" && "started"}
                        {event.type === "cycle_completed" && "completed"}
                        {event.type === "stage_changed" && "moved to"}
                        {event.type === "feedback_added" && "added feedback on"}
                        {event.type === "changes_submitted" && "submitted changes for"}
                        {event.type === "rejected" && "rejected proposal"}
                        {event.type === "document_uploaded" && "uploaded document version"}
                        {event.toStage && (
                          <span className="font-medium text-text-primary">
                            {" "}
                            {stageLabels[event.toStage]}
                          </span>
                        )}
                      </p>
                      {event.note && <p className="text-xs text-text-tertiary">{event.note}</p>}
                      <p className="text-xs text-text-muted">{event.createdAt.toLocaleString()}</p>
                    </div>
                  </div>
                );
              })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface-muted/70 px-4 py-2">
      <p className="text-xs text-text-tertiary">{label}</p>
      <p className="font-semibold text-text-primary">{value}</p>
    </div>
  );
}
