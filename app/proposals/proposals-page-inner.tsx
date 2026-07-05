"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { getProposals, deleteProposal, getDeepReviewMap } from "@/lib/db";
import type { Proposal, ProposalStatus } from "@/lib/types";
import type { DeepReview } from "@/lib/deep-review/types";
import { statusLabels } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate, cn } from "@/lib/utils";
import {
  Search,
  Plus,
  Trash2,
  LayoutGrid,
  List,
  FileText,
  Calendar,
  CheckCircle2,
  BarChart3,
  FolderOpen,
  Clock,
  CheckSquare,
} from "lucide-react";
import { ProposalActionModal } from "@/components/proposal-action-modal";
import { useProfile } from "@/components/profile-provider";

const statusOptions: ProposalStatus[] = ["draft", "submitted", "under_review", "approved", "rejected"];

export function ProposalsPageInner() {
  const searchParams = useSearchParams();
  const initialSearch = searchParams.get("search") || "";
  const { can } = useProfile();

  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [reviews, setReviews] = useState<Map<string, DeepReview>>(new Map());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(initialSearch);
  const [statusFilter, setStatusFilter] = useState<ProposalStatus | "all">("all");
  const [view, setView] = useState<"grid" | "list">("list");
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);

  const load = () => {
    setLoading(true);
    getProposals().then((data) => {
      setProposals(data);
      setLoading(false);
    });
    getDeepReviewMap().then(setReviews);
  };

  useEffect(() => {
    let cancelled = false;
    getProposals().then((data) => {
      if (!cancelled) {
        setProposals(data);
        setLoading(false);
      }
    });
    getDeepReviewMap().then((m) => {
      if (!cancelled) setReviews(m);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    return proposals.filter((p) => {
      const matchesSearch =
        p.title.toLowerCase().includes(search.toLowerCase()) ||
        p.clientName.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === "all" || p.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [proposals, search, statusFilter]);

  const stats = useMemo(() => {
    const total = proposals.length;
    const underReview = proposals.filter((p) => p.status === "under_review").length;
    const approved = proposals.filter((p) => p.status === "approved").length;
    const scored = proposals.filter((p) => reviews.has(p.id));
    const avgScore =
      scored.length > 0
        ? Math.round(
            scored.reduce((sum, p) => sum + reviews.get(p.id)!.overall_score, 0) / scored.length
          )
        : null;
    return { total, underReview, approved, avgScore };
  }, [proposals, reviews]);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this proposal?")) return;
    await deleteProposal(id);
    load();
  };

  const openActionModal = (proposal: Proposal) => {
    setSelectedProposal(proposal);
  };

  const closeActionModal = () => {
    setSelectedProposal(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-text-primary sm:text-3xl">Proposals</h1>
          <p className="text-text-secondary">Search, filter, and manage all proposal reviews.</p>
        </div>
        {can("create_proposal") && (
          <Link href="/proposals/new">
            <Button className="bg-gradient-to-r from-primary-600 to-accent-600 text-white shadow-md hover:shadow-lg transition-all">
              <Plus size={18} className="mr-2" /> New Review
            </Button>
          </Link>
        )}
      </motion.div>

      {/* Stats */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="grid grid-cols-2 gap-3 sm:grid-cols-4"
      >
        <StatCard icon={FolderOpen} label="Total" value={stats.total} gradient="from-primary-500 to-accent-500" />
        <StatCard icon={Clock} label="Under Review" value={stats.underReview} gradient="from-amber-500 to-orange-500" />
        <StatCard icon={CheckSquare} label="Approved" value={stats.approved} gradient="from-emerald-500 to-teal-500" />
        <StatCard icon={BarChart3} label="Avg Score" value={stats.avgScore ?? "—"} gradient="from-violet-500 to-purple-500" />
      </motion.div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="flex flex-col gap-3 sm:flex-row"
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <Input
            placeholder="Search by title or client..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as ProposalStatus | "all")}
          className="w-full sm:w-52"
        >
          <option value="all">All statuses</option>
          {statusOptions.map((s) => (
            <option key={s} value={s}>
              {statusLabels[s]}
            </option>
          ))}
        </Select>
        <div className="flex rounded-lg border border-border bg-surface p-1 shadow-sm">
          <button
            onClick={() => setView("list")}
            className={cn(
              "rounded-md px-3 py-1.5 transition-all",
              view === "list"
                ? "bg-surface-muted text-text-primary shadow-sm"
                : "text-text-tertiary hover:text-text-primary"
            )}
            aria-label="List view"
            aria-pressed={view === "list"}
          >
            <List size={18} />
          </button>
          <button
            onClick={() => setView("grid")}
            className={cn(
              "rounded-md px-3 py-1.5 transition-all",
              view === "grid"
                ? "bg-surface-muted text-text-primary shadow-sm"
                : "text-text-tertiary hover:text-text-primary"
            )}
            aria-label="Grid view"
            aria-pressed={view === "grid"}
          >
            <LayoutGrid size={18} />
          </button>
        </div>
      </motion.div>

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-surface-muted" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}>
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-14 text-center">
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-surface-muted">
                <Search className="h-6 w-6 text-text-muted" />
              </div>
              <p className="text-text-secondary">No proposals match your filters.</p>
              {(search || statusFilter !== "all") && (
                <button
                  onClick={() => {
                    setSearch("");
                    setStatusFilter("all");
                  }}
                  className="mt-3 text-sm font-medium text-primary-600 hover:text-primary-700"
                >
                  Clear filters
                </button>
              )}
            </CardContent>
          </Card>
        </motion.div>
      ) : view === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {filtered.map((proposal, i) => (
              <motion.div
                key={proposal.id}
                layout="position"
                initial={{ opacity: 0, y: 16, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.25, delay: i * 0.04 }}
              >
                <Card className="group flex h-full flex-col overflow-hidden border border-border bg-surface/95 backdrop-blur-sm transition-all hover:border-primary-200 hover:shadow-lg">
                  <CardContent className="flex flex-1 flex-col p-5">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <Badge variant={proposal.status}>{statusLabels[proposal.status]}</Badge>
                      {can("delete_proposal") && (
                        <button
                          onClick={() => handleDelete(proposal.id)}
                          className="rounded-md p-1 text-text-muted transition-colors hover:bg-red-50 hover:text-red-600"
                          aria-label="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                    <button onClick={() => openActionModal(proposal)} className="flex-1 text-left">
                      <h3 className="text-base font-semibold text-text-primary transition-colors group-hover:text-primary-600">
                        {proposal.title}
                      </h3>
                    </button>
                    <p className="mt-0.5 text-sm text-text-secondary">{proposal.clientName}</p>
                    {(proposal.sparcOwner || proposal.technology || proposal.gtmOwner || proposal.proposalRegion) && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {proposal.sparcOwner && <MetaChip label="Owner" value={proposal.sparcOwner} />}
                        {proposal.technology && <MetaChip label="Tech" value={proposal.technology} />}
                        {proposal.gtmOwner && <MetaChip label="GTM" value={proposal.gtmOwner} />}
                        {proposal.proposalRegion && <MetaChip label="Region" value={proposal.proposalRegion} />}
                      </div>
                    )}
                    <div className="mt-4 flex items-center justify-between border-t border-border-subtle pt-3 text-xs text-text-tertiary">
                      <div className="flex items-center gap-1">
                        <FileText size={12} />
                        <span>{proposal.documents.length} doc(s)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {reviews.get(proposal.id) && (
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-xs font-semibold",
                              reviews.get(proposal.id)!.overall_score >= 60
                                ? "bg-green-100 text-green-700"
                                : "bg-red-100 text-red-700"
                            )}
                          >
                            {reviews.get(proposal.id)!.overall_score}/100
                          </span>
                        )}
                        <div className="flex items-center gap-1">
                          <Calendar size={12} />
                          <span>{proposal.dueDate ? formatDate(proposal.dueDate) : "No due date"}</span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4">
                      <StatusPipeline status={proposal.status} />
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {filtered.map((proposal, i) => (
              <motion.div
                key={proposal.id}
                layout="position"
                initial={{ opacity: 0, y: 16, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.25, delay: i * 0.04 }}
              >
                <Card className="group overflow-hidden border border-border bg-surface/95 backdrop-blur-sm transition-all hover:border-primary-200 hover:shadow-lg">
                  <CardContent className="p-4 sm:p-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <button onClick={() => openActionModal(proposal)} className="text-left">
                          <h3 className="truncate text-base font-semibold text-text-primary transition-colors group-hover:text-primary-600">
                            {proposal.title}
                          </h3>
                        </button>
                        <p className="mt-0.5 text-sm text-text-secondary">{proposal.clientName}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          {proposal.sparcOwner && <MetaChip label="Owner" value={proposal.sparcOwner} />}
                          {proposal.technology && <MetaChip label="Tech" value={proposal.technology} />}
                          {proposal.gtmOwner && <MetaChip label="GTM" value={proposal.gtmOwner} />}
                          {proposal.proposalRegion && <MetaChip label="Region" value={proposal.proposalRegion} />}
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-2 sm:flex-nowrap">
                        {reviews.get(proposal.id) && (
                          <span
                            className={cn(
                              "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                              reviews.get(proposal.id)!.overall_score >= 60
                                ? "bg-green-100 text-green-700"
                                : "bg-red-100 text-red-700"
                            )}
                          >
                            {reviews.get(proposal.id)!.overall_score}/100
                          </span>
                        )}
                        <div className="flex items-center gap-1 text-xs text-text-tertiary">
                          <Calendar size={12} />
                          <span>{proposal.dueDate ? formatDate(proposal.dueDate) : "No due date"}</span>
                        </div>
                        <Badge variant={proposal.status}>{statusLabels[proposal.status]}</Badge>
                        {can("delete_proposal") && (
                          <button
                            onClick={() => handleDelete(proposal.id)}
                            className="rounded-md p-1.5 text-text-muted transition-colors hover:bg-red-50 hover:text-red-600"
                            aria-label="Delete"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="mt-4">
                      <StatusPipeline status={proposal.status} />
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <ProposalActionModal proposal={selectedProposal} open={!!selectedProposal} onClose={closeActionModal} />
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  gradient,
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  gradient: string;
}) {
  return (
    <Card className="relative overflow-hidden border border-border bg-surface/95 transition-all hover:shadow-md">
      <div className={cn("absolute left-0 top-0 h-full w-1 bg-gradient-to-b", gradient)} />
      <CardContent className="flex items-center justify-between p-4">
        <div>
          <p className="text-xs font-medium text-text-tertiary">{label}</p>
          <p className="mt-0.5 text-2xl font-bold text-text-primary">{value}</p>
        </div>
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br text-white shadow-sm", gradient)}>
          <Icon size={18} />
        </div>
      </CardContent>
    </Card>
  );
}

const PIPELINE_STAGES: { status: ProposalStatus; label: string }[] = [
  { status: "draft", label: "Draft" },
  { status: "submitted", label: "Submitted" },
  { status: "under_review", label: "Under Review" },
  { status: "approved", label: "Approved" },
];

function StatusPipeline({ status }: { status: ProposalStatus }) {
  const isRejected = status === "rejected";
  const currentIndex = PIPELINE_STAGES.findIndex((s) => s.status === status);
  const progress = isRejected ? 100 : ((currentIndex + 1) / PIPELINE_STAGES.length) * 100;

  return (
    <div className="w-full">
      <div className="relative flex items-center py-1">
        <div className="absolute left-0 right-0 h-1.5 rounded-full bg-surface-muted" />
        <motion.div
          className={cn("absolute left-0 h-1.5 rounded-full", isRejected ? "bg-red-500" : "bg-primary-500")}
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
        <div className="relative flex w-full justify-between">
          {PIPELINE_STAGES.map((stage, i) => {
            const isPast = isRejected ? i < PIPELINE_STAGES.length - 1 : i < currentIndex;
            const isCurrent = !isRejected && i === currentIndex;
            const isTerminal = isRejected && i === PIPELINE_STAGES.length - 1;

            return (
              <div key={stage.status} className="flex flex-col items-center gap-1.5">
                <div
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full border-2 text-[10px] font-bold transition-all",
                    isCurrent
                      ? "border-amber-500 bg-amber-500 text-white shadow-md shadow-amber-200"
                      : isPast
                      ? "border-primary-500 bg-primary-500 text-white"
                      : isTerminal
                      ? "border-red-500 bg-red-500 text-white"
                      : "border-border-strong bg-surface text-text-muted"
                  )}
                >
                  {isPast ? <CheckCircle2 size={12} /> : isTerminal ? "✕" : i + 1}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-1 flex w-full justify-between">
        {PIPELINE_STAGES.map((stage, i) => {
          const isPast = isRejected ? i < PIPELINE_STAGES.length - 1 : i < currentIndex;
          const isCurrent = !isRejected && i === currentIndex;
          const isTerminal = isRejected && i === PIPELINE_STAGES.length - 1;
          const label = isTerminal ? "Rejected" : stage.label;
          return (
            <span
              key={`label-${stage.status}`}
              className={cn(
                "text-[10px] font-medium",
                isCurrent ? "text-amber-600" : isTerminal ? "text-red-500" : isPast ? "text-text-secondary" : "text-text-muted"
              )}
            >
              {label}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function MetaChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-border bg-surface-muted px-2 py-0.5 text-xs text-text-tertiary">
      <span className="font-medium text-text-muted">{label}</span>
      <span className="max-w-[80px] truncate">{value}</span>
    </span>
  );
}
