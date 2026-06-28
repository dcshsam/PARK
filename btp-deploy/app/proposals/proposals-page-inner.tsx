"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
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
import { Search, Plus, Trash2, LayoutGrid, List } from "lucide-react";
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary sm:text-3xl">Proposals</h1>
          <p className="text-text-secondary">Search, filter, and manage all proposal reviews.</p>
        </div>
        {can("create_proposal") && (
          <Link href="/proposals/new">
            <Button>
              <Plus size={18} className="mr-2" /> New Review
            </Button>
          </Link>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
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
          className="w-full sm:w-48"
        >
          <option value="all">All statuses</option>
          {statusOptions.map((s) => (
            <option key={s} value={s}>
              {statusLabels[s]}
            </option>
          ))}
        </Select>
        <div className="flex rounded-lg border border-border bg-surface p-1">
          <button
            onClick={() => setView("list")}
            className={`rounded-md px-3 py-1.5 transition-colors ${view === "list" ? "bg-surface-muted text-text-primary" : "text-text-tertiary hover:text-text-primary"}`}
            aria-label="List view"
            aria-pressed={view === "list"}
          >
            <List size={18} />
          </button>
          <button
            onClick={() => setView("grid")}
            className={`rounded-md px-3 py-1.5 transition-colors ${view === "grid" ? "bg-surface-muted text-text-primary" : "text-text-tertiary hover:text-text-primary"}`}
            aria-label="Grid view"
            aria-pressed={view === "grid"}
          >
            <LayoutGrid size={18} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-surface-muted" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-text-secondary">No proposals match your filters.</p>
          </CardContent>
        </Card>
      ) : view === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((proposal) => (
            <Card key={proposal.id} className="group flex flex-col">
              <CardContent className="flex flex-1 flex-col p-5">
                <div className="mb-3 flex items-start justify-between">
                  <Badge variant={proposal.status}>{statusLabels[proposal.status]}</Badge>
                  {can("delete_proposal") && (
                    <button
                      onClick={() => handleDelete(proposal.id)}
                      className="text-text-muted transition-colors hover:text-red-600"
                      aria-label="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
                <button
                  onClick={() => openActionModal(proposal)}
                  className="flex-1 text-left"
                >
                  <h3 className="text-base font-semibold text-text-primary group-hover:text-primary-600">
                    {proposal.title}
                  </h3>
                </button>
                <p className="text-sm text-text-secondary">{proposal.clientName}</p>
                {(proposal.technology || proposal.projectType) && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {proposal.technology && (
                      <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs text-text-secondary">
                        {proposal.technology}
                      </span>
                    )}
                    {proposal.projectType && (
                      <span className="rounded-full bg-accent-bg px-2 py-0.5 text-xs text-accent-text">
                        {proposal.projectType}
                      </span>
                    )}
                  </div>
                )}
                <div className="mt-4 flex items-center justify-between border-t border-border-subtle pt-3 text-xs text-text-tertiary">
                  <span>{proposal.documents.length} document(s)</span>
                  <div className="flex items-center gap-2">
                    {reviews.get(proposal.id) && (
                      <span className={cn(
                        "rounded-md px-1.5 py-0.5 font-semibold",
                        reviews.get(proposal.id)!.overall_score >= 60 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                      )}>
                        {reviews.get(proposal.id)!.overall_score}/100
                      </span>
                    )}
                    <span>{proposal.dueDate ? formatDate(proposal.dueDate) : "No due date"}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <div className="divide-y divide-border-subtle">
            {filtered.map((proposal) => (
              <div
                key={proposal.id}
                className="group flex flex-col gap-3 p-4 transition-colors hover:bg-surface-muted/50 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <button
                    onClick={() => openActionModal(proposal)}
                    className="text-left"
                  >
                    <h3 className="truncate text-sm font-semibold text-text-primary group-hover:text-primary-600">
                      {proposal.title}
                    </h3>
                  </button>
                  <p className="text-xs text-text-tertiary">{proposal.clientName}</p>
                  {(proposal.technology || proposal.projectType) && (
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {proposal.technology && (
                        <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs text-text-secondary">
                          {proposal.technology}
                        </span>
                      )}
                      {proposal.projectType && (
                        <span className="rounded-full bg-accent-bg px-2 py-0.5 text-xs text-accent-text">
                          {proposal.projectType}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  {reviews.get(proposal.id) && (
                    <span className={cn(
                      "rounded-md px-2 py-0.5 text-xs font-semibold",
                      reviews.get(proposal.id)!.overall_score >= 60 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                    )}>
                      {reviews.get(proposal.id)!.overall_score}/100
                    </span>
                  )}
                  <span className="text-xs text-text-tertiary">
                    {proposal.dueDate ? formatDate(proposal.dueDate) : "No due date"}
                  </span>
                  <Badge variant={proposal.status}>{statusLabels[proposal.status]}</Badge>
                  {can("delete_proposal") && (
                    <button
                      onClick={() => handleDelete(proposal.id)}
                      className="text-text-muted transition-colors hover:text-red-600"
                      aria-label="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <ProposalActionModal
        proposal={selectedProposal}
        open={!!selectedProposal}
        onClose={closeActionModal}
      />
    </div>
  );
}
