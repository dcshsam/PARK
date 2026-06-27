"use client";

import { useRouter } from "next/navigation";
import type { Proposal } from "@/lib/types";
import { statusLabels } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Eye, Upload, FileText } from "lucide-react";

interface ProposalActionModalProps {
  proposal: Proposal | null;
  open: boolean;
  onClose: () => void;
}

export function ProposalActionModal({ proposal, open, onClose }: ProposalActionModalProps) {
  const router = useRouter();

  if (!proposal) return null;

  const viewProposal = () => {
    onClose();
    router.push(`/proposals/${proposal.id}`);
  };

  const uploadNewVersion = () => {
    onClose();
    router.push(`/proposals/${proposal.id}/new-version`);
  };

  return (
    <Dialog open={open} onClose={onClose} className="max-w-md">
      <div className="mb-5">
        <DialogTitle className="flex items-center gap-2">
          <FileText size={20} className="text-primary-600" />
          Open Proposal
        </DialogTitle>
        <DialogDescription className="mt-1">
          Choose how you want to work with <span className="font-medium text-text-primary">{proposal.title}</span>.
        </DialogDescription>
      </div>

      <div className="mb-5 rounded-xl border border-border bg-surface-muted/50 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-text-primary">{proposal.title}</p>
            <p className="text-xs text-text-secondary">{proposal.clientName}</p>
          </div>
          <Badge variant={proposal.status}>{statusLabels[proposal.status]}</Badge>
        </div>
        <p className="mt-2 text-xs text-text-tertiary">
          {proposal.documents.length} document(s) •{" "}
          {proposal.workflowStage ? proposal.workflowStage.replace(/_/g, " ") : "Not started"}
        </p>
      </div>

      <div className="grid gap-3">
        <Button
          variant="outline"
          className="h-auto justify-start px-4 py-4 text-left"
          onClick={viewProposal}
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
            <Eye size={20} />
          </div>
          <div className="ml-3">
            <p className="text-sm font-semibold text-text-primary">View / Edit Proposal</p>
            <p className="text-xs text-text-secondary">Review details, documents, and workflow decisions.</p>
          </div>
        </Button>

        <Button
          variant="outline"
          className="h-auto justify-start px-4 py-4 text-left"
          onClick={uploadNewVersion}
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
            <Upload size={20} />
          </div>
          <div className="ml-3">
            <p className="text-sm font-semibold text-text-primary">Upload New Version</p>
            <p className="text-xs text-text-secondary">
              Upload revised documents and run a fresh end-to-end review cycle.
            </p>
          </div>
        </Button>
      </div>

      <div className="mt-5 flex justify-end">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </Dialog>
  );
}
