"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { deleteLead, getLeads, seedSampleLeads, getDeepReviewMap } from "@/lib/db";
import type { DeepReview } from "@/lib/deep-review/types";
import { useProfile } from "@/components/profile-provider";
import { RequireAccess } from "@/components/require-access";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProposalScoreBadge } from "@/components/proposal-score-badge";
import { leadStatusLabels, type Lead } from "@/lib/types";
import { LEAD_EVENT_LABELS, LEAD_STATUS_BADGE } from "@/lib/lead-events";
import { cn, formatDate } from "@/lib/utils";
import { Plus, Trash2, FileText, Eye, Pencil, Database, Loader2 } from "lucide-react";

// The lead's 8-event roadmap. currentEvent is 1-based and points at the event
// still being worked, so everything before it is done. on_hold / dropped leaves
// the track where it is and greys the active dot.
function LeadStageTrack({ lead }: { lead: Lead }) {
  const current = Math.min(Math.max(lead.currentEvent, 1), LEAD_EVENT_LABELS.length);
  const completed = current - 1;
  const paused = lead.status === "on_hold" || lead.status === "dropped";
  // Dots sit at the centre of each equal-width column.
  const trackInset = 50 / LEAD_EVENT_LABELS.length;

  return (
    <div className="mt-3 border-t border-border-subtle pt-4">
      <div className="relative flex items-start">
        <div
          className="absolute top-1.5 h-0.5 bg-border"
          style={{ left: `${trackInset}%`, right: `${trackInset}%` }}
        />
        {completed > 0 && (
          <div
            className="absolute top-1.5 h-0.5 bg-primary-600"
            style={{
              left: `${trackInset}%`,
              width: `${(completed / (LEAD_EVENT_LABELS.length - 1)) * (100 - 2 * trackInset)}%`,
            }}
          />
        )}
        {LEAD_EVENT_LABELS.map((label, i) => {
          const done = i < completed;
          const active = !paused && i === completed;
          return (
            <div key={label} className="relative z-10 flex flex-1 flex-col items-center gap-1.5 px-1">
              <span
                className={cn(
                  "h-3 w-3 shrink-0 rounded-full border-2",
                  done
                    ? "border-primary-600 bg-primary-600"
                    : active
                      ? "border-primary-600 bg-surface ring-4 ring-primary-100"
                      : "border-border bg-surface"
                )}
              />
              <span
                className={cn(
                  "text-center text-[10px] font-medium leading-tight",
                  active ? "text-primary-700" : done ? "text-text-secondary" : "text-text-muted"
                )}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>
      {paused && (
        <p className="mt-2 text-center text-[11px] font-medium text-text-tertiary">
          {leadStatusLabels[lead.status]} — progress paused
        </p>
      )}
    </div>
  );
}

export default function LeadsPage() {
  return (
    <RequireAccess action="view">
      <LeadsPageContent />
    </RequireAccess>
  );
}

function LeadsPageContent() {
  const router = useRouter();
  const { can } = useProfile();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [reviews, setReviews] = useState<Map<string, DeepReview>>(new Map());
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);

  const load = async () => {
    const all = await getLeads();
    setLeads(all);
    setLoading(false);
    setReviews(await getDeepReviewMap());
  };

  useEffect(() => {
    let cancelled = false;
    getLeads().then((all) => {
      if (!cancelled) {
        setLeads(all);
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

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this lead?")) return;
    await deleteLead(id);
    await load();
  };

  const handleLoadSamples = async () => {
    setSeeding(true);
    try {
      await seedSampleLeads();
      await load();
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary sm:text-3xl">Proposal Master</h1>
          <p className="text-text-secondary">View and manage all ongoing SPARC proposals.</p>
        </div>
        {can("create_lead") && (
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" onClick={handleLoadSamples} disabled={seeding}>
              {seeding ? (
                <Loader2 size={16} className="mr-2 animate-spin" />
              ) : (
                <Database size={16} className="mr-2" />
              )}
              Load sample data
            </Button>
            <Button onClick={() => router.push("/leads/new")}>
              <Plus size={16} className="mr-2" /> New Proposal
            </Button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-surface-muted" />
          ))}
        </div>
      ) : leads.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-muted text-text-muted">
              <FileText size={24} />
            </div>
            <p className="font-semibold text-text-primary">No leads yet</p>
            <p className="max-w-md text-sm text-text-secondary">
              Create your first lead to start tracking opportunities through the SPARC roadmap.
            </p>
            {can("create_lead") && (
              <Button onClick={() => router.push("/leads/new")}>
                <Plus size={16} className="mr-2" /> New Lead
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {leads.map((lead) => (
            <Card
              key={lead.id}
              className="cursor-pointer transition-shadow hover:shadow-md"
              onClick={() => router.push(`/leads/${lead.id}`)}
            >
              <CardHeader className="pb-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-base">{lead.leadName || lead.kytesId}</CardTitle>
                    <Badge className={LEAD_STATUS_BADGE[lead.status]}>
                      {leadStatusLabels[lead.status]}
                    </Badge>
                    <ProposalScoreBadge lead={lead} reviews={reviews} />
                  </div>
                  <div
                    className="flex items-center gap-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => router.push(`/leads/${lead.id}`)}
                      aria-label={`View lead ${lead.kytesId}`}
                    >
                      <Eye size={16} />
                    </Button>
                    {can("edit_lead") && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push(`/leads/${lead.id}`)}
                        aria-label={`Edit lead ${lead.kytesId}`}
                      >
                        <Pencil size={16} />
                      </Button>
                    )}
                    {can("delete_lead") && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(lead.id)}
                        aria-label={`Delete lead ${lead.kytesId}`}
                      >
                        <Trash2 size={16} className="text-red-500" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <dt className="text-xs font-medium uppercase text-text-tertiary">Kytes ID</dt>
                    <dd className="text-text-primary">{lead.kytesId || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase text-text-tertiary">Lead Type</dt>
                    <dd className="text-text-primary">{lead.leadType || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase text-text-tertiary">Vertical</dt>
                    <dd className="text-text-primary">{lead.vertical || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase text-text-tertiary">GTM Owner</dt>
                    <dd className="text-text-primary">{lead.gtmName || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase text-text-tertiary">SPARC Owner</dt>
                    <dd className="text-text-primary">{lead.sparcOwner || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase text-text-tertiary">Date</dt>
                    <dd className="text-text-primary">{lead.date ? formatDate(lead.date) : "—"}</dd>
                  </div>
                </dl>
                <LeadStageTrack lead={lead} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
