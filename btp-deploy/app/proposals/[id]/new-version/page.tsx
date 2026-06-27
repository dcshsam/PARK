"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  getProposal,
  addDocument,
  addWorkflowEvent,
  saveAiReview,
  getRuleset,
} from "@/lib/db";
import { startNewVersionCycle } from "@/lib/workflow-engine";
import { extractDocumentText, runAiReview } from "@/lib/ai-review-service";
import type { Proposal, UploadedFile, DocumentCategory } from "@/lib/types";
import { categoryLabels, statusLabels } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, ArrowLeft, Loader2, Sparkles, Upload, CheckCircle2 } from "lucide-react";
import { FileUpload } from "@/components/file-upload";
import { ManualTextInput } from "@/components/manual-text-input";

const uploadCategories: DocumentCategory[] = ["rfp", "transcript", "customer_doc", "final_proposal"];

type Step = "upload" | "processing" | "reviewing" | "done" | "error";

export default function NewVersionPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<Step>("upload");
  const [error, setError] = useState<string | null>(null);
  const [pendingDocs, setPendingDocs] = useState<
    Record<DocumentCategory, Omit<UploadedFile, "id" | "proposalId" | "uploadedAt">[]>
  >({
    rfp: [],
    transcript: [],
    customer_doc: [],
    final_proposal: [],
  });
  const [progressText, setProgressText] = useState("");

  useEffect(() => {
    if (!id) return;
    getProposal(id).then((data) => {
      setProposal(data || null);
      setLoading(false);
    });
  }, [id]);

  const updatePending = (
    category: DocumentCategory,
    files: Omit<UploadedFile, "id" | "proposalId" | "uploadedAt">[]
  ) => {
    setPendingDocs((prev) => ({ ...prev, [category]: files }));
  };

  const hasPendingDocs = uploadCategories.some((cat) => pendingDocs[cat].length > 0);

  const handleStartNewVersionCycle = async () => {
    if (!proposal) return;
    setStep("processing");
    setError(null);
    setProgressText("Preparing new review cycle...");

    try {
      const { cycle } = await startNewVersionCycle(proposal.id, "New document version uploaded");

      setProgressText("Uploading new documents...");
      const allNew = uploadCategories.flatMap((cat) => pendingDocs[cat]);
      for (const doc of allNew) {
        await addDocument(proposal.id, doc, { cycleId: cycle.id, version: 1 });
      }

      if (allNew.length > 0) {
        await addWorkflowEvent({
          proposalId: proposal.id,
          cycleId: cycle.id,
          type: "document_uploaded",
          actor: "John Doe",
          note: `${allNew.length} new document(s) uploaded as version 1 of ${cycle.cycleType} cycle iteration ${cycle.iteration}`,
          createdAt: new Date(),
        });
      }

      setProgressText("Refreshing proposal...");
      const refreshed = await getProposal(proposal.id);
      if (!refreshed) throw new Error("Failed to refresh proposal after upload");
      setProposal(refreshed);

      const ruleset = refreshed.rulesetId ? await getRuleset(refreshed.rulesetId) : null;
      if (ruleset) {
        setStep("reviewing");
        setProgressText("Running AI review on the new version...");
        const documentText = await extractDocumentText(refreshed);
        const result = await runAiReview({ proposal: refreshed, ruleset, documentText });
        await saveAiReview(result);
        setProgressText("AI review complete.");
      } else {
        setProgressText("No ruleset configured; skipping AI review.");
      }

      setStep("done");
    } catch (err) {
      setStep("error");
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    }
  };

  if (loading) return <p className="text-text-secondary">Loading proposal...</p>;
  if (!proposal) return <p className="text-text-secondary">Proposal not found.</p>;

  if (step === "processing" || step === "reviewing") {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Loader2 size={48} className="mb-4 animate-spin text-primary-600" />
        <h2 className="text-xl font-semibold text-text-primary">
          {step === "reviewing" ? "Running AI Review" : "Processing New Version"}
        </h2>
        <p className="mt-2 text-sm text-text-secondary">{progressText}</p>
      </div>
    );
  }

  if (step === "done") {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-50 text-green-600">
          <CheckCircle2 size={32} />
        </div>
        <h2 className="text-xl font-semibold text-text-primary">New Version Cycle Complete</h2>
        <p className="mt-2 max-w-md text-sm text-text-secondary">
          The new documents have been uploaded, a fresh review cycle has started, and the AI review
          has been updated.
        </p>
        <div className="mt-6 flex gap-3">
          <Button variant="outline" onClick={() => router.push(`/proposals/${id}`)}>
            View Proposal
          </Button>
          <Button onClick={() => router.push(`/proposals/${id}/review`)}>
            Open Review Workspace
          </Button>
        </div>
      </div>
    );
  }

  if (step === "error") {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red-600">
          <AlertCircle size={32} />
        </div>
        <h2 className="text-xl font-semibold text-text-primary">New Version Cycle Failed</h2>
        <p className="mt-2 max-w-md text-sm text-text-secondary">{error}</p>
        <div className="mt-6 flex gap-3">
          <Button variant="outline" onClick={() => router.push(`/proposals/${id}`)}>
            Back to Proposal
          </Button>
          <Button onClick={() => setStep("upload")}>Try Again</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => router.push(`/proposals/${id}`)}>
            <ArrowLeft size={16} className="mr-1" /> Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-text-primary sm:text-3xl">Upload New Version</h1>
            <p className="text-text-secondary">{proposal.title}</p>
          </div>
        </div>
        <Badge variant={proposal.status}>{statusLabels[proposal.status]}</Badge>
      </div>

      <Card className="border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10">
        <CardContent className="flex items-start gap-3 py-4">
          <Sparkles className="mt-0.5 shrink-0 text-amber-600" size={18} />
          <p className="text-sm text-amber-800 dark:text-amber-300">
            Uploading a new version will start a fresh end-to-end review cycle. The current review
            cycle will be completed, a new iteration will begin, and the AI review will be re-run
            against the latest documents.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Upload size={18} />
            Upload Revised Documents
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-text-secondary">
            Add the updated documents below. Each upload becomes version 1 of the new review cycle
            and will replace the previous version in future AI reviews.
          </p>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {uploadCategories.map((category) => (
              <div key={category} className="space-y-2">
                <p className="text-xs font-medium text-text-secondary">{categoryLabels[category]}</p>
                <FileUpload
                  category={category}
                  files={pendingDocs[category]}
                  onChange={(files) => updatePending(category, files)}
                />
                <ManualTextInput
                  category={category}
                  onAdd={(text) => {
                    const blob = new Blob([text]);
                    const encoded = btoa(unescape(encodeURIComponent(text)));
                    const manualDoc: Omit<UploadedFile, "id" | "proposalId" | "uploadedAt"> = {
                      category,
                      name: `${categoryLabels[category]} (manual) ${new Date().toLocaleString()}`,
                      size: blob.size,
                      mimeType: "text/plain",
                      content: encoded,
                      extractedText: text,
                    };
                    updatePending(category, [...pendingDocs[category], manualDoc]);
                  }}
                />
              </div>
            ))}
          </div>

          {error && (
            <div className="rounded-xl bg-status-danger-bg p-3 text-sm text-status-danger-text">
              <AlertCircle size={16} className="mr-2 inline" />
              {error}
            </div>
          )}

          {hasPendingDocs && (
            <div className="flex items-center justify-end gap-3 border-t border-border-subtle pt-4">
              <Button
                variant="outline"
                onClick={() =>
                  setPendingDocs({ rfp: [], transcript: [], customer_doc: [], final_proposal: [] })
                }
              >
                Clear
              </Button>
              <Button onClick={handleStartNewVersionCycle}>
                <Sparkles size={16} className="mr-2" />
                Start New Review Cycle
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
