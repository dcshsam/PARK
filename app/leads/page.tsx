"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { deleteLead, getLeads, seedSampleLeads } from "@/lib/db";
import { useProfile } from "@/components/profile-provider";
import { RequireAccess } from "@/components/require-access";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { leadStatusLabels, type Lead, type LeadStatus } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { Plus, Trash2, FileText, Eye, Pencil, Database, Loader2 } from "lucide-react";

const statusBadge: Record<LeadStatus, string> = {
  new: "bg-status-info-bg text-status-info-text",
  qualified: "bg-status-success-bg text-status-success-text",
  proposal: "bg-primary-100 text-primary-700",
  converted: "bg-status-success-bg text-status-success-text",
  on_hold: "bg-status-warning-bg text-status-warning-text",
  dropped: "bg-status-danger-bg text-status-danger-text",
};

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
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);

  const load = async () => {
    const all = await getLeads();
    setLeads(all);
    setLoading(false);
  };

  useEffect(() => {
    let cancelled = false;
    getLeads().then((all) => {
      if (!cancelled) {
        setLeads(all);
        setLoading(false);
      }
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
                    <Badge className={statusBadge[lead.status]}>
                      {leadStatusLabels[lead.status]}
                    </Badge>
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
                    <dt className="text-xs font-medium uppercase text-text-tertiary">GTM Name</dt>
                    <dd className="text-text-primary">{lead.gtmName || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase text-text-tertiary">Date</dt>
                    <dd className="text-text-primary">{lead.date ? formatDate(lead.date) : "—"}</dd>
                  </div>
                </dl>
                {lead.requirementSummary && (
                  <div className="mt-3 border-t border-border-subtle pt-3">
                    <p className="text-xs font-medium uppercase text-text-tertiary">Requirement Summary</p>
                    <p className="mt-1 line-clamp-2 text-sm text-text-secondary">{lead.requirementSummary}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
