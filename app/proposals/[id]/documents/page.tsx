"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getProposal, addDocument, getNextDocumentVersion, addWorkflowEvent } from "@/lib/db";
import type { Proposal, UploadedFile, DocumentCategory } from "@/lib/types";
import { categoryLabels } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatBytes } from "@/lib/utils";
import { ArrowLeft, FileText, Download, Eye, FileIcon, Upload, Plus, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { FileUpload } from "@/components/file-upload";
import { ManualTextInput } from "@/components/manual-text-input";

function dataUrl(doc: UploadedFile): string {
  if (!doc.content) return "";
  return `data:${doc.mimeType};base64,${doc.content}`;
}

const uploadCategories: DocumentCategory[] = ["rfp", "transcript", "customer_doc", "final_proposal"];

export default function DocumentsPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [pendingDocs, setPendingDocs] = useState<Record<DocumentCategory, Omit<UploadedFile, "id" | "proposalId" | "uploadedAt">[]>>({
    rfp: [],
    transcript: [],
    customer_doc: [],
    final_proposal: [],
  });

  useEffect(() => {
    if (!id) return;
    getProposal(id).then((data) => {
      if (data) {
        setProposal(data);
        setSelectedId(data.documents[0]?.id || "");
      }
      setLoading(false);
    });
  }, [id]);

  const selected = useMemo(
    () => proposal?.documents.find((d) => d.id === selectedId),
    [proposal, selectedId]
  );

  const hasPendingDocs = uploadCategories.some((cat) => pendingDocs[cat].length > 0);

  const updatePending = (category: DocumentCategory, files: Omit<UploadedFile, "id" | "proposalId" | "uploadedAt">[]) => {
    setPendingDocs((prev) => ({ ...prev, [category]: files }));
  };

  const handleUpload = async () => {
    if (!proposal) return;
    setUploading(true);
    try {
      const currentCycle = proposal.workflowCycles.find((c) => c.id === proposal.currentCycleId);
      const cycleId = currentCycle?.id;
      const allNew = uploadCategories.flatMap((cat) => pendingDocs[cat]);

      for (const doc of allNew) {
        const version = await getNextDocumentVersion(proposal.id, doc.category, cycleId);
        await addDocument(proposal.id, doc, { cycleId, version });
      }

      if (allNew.length > 0 && cycleId) {
        await addWorkflowEvent({
          proposalId: proposal.id,
          cycleId,
          type: "document_uploaded",
          actor: "John Doe",
          note: `${allNew.length} new document version(s) uploaded`,
          createdAt: new Date(),
        });
      }

      const updated = await getProposal(proposal.id);
      if (updated) {
        setProposal(updated);
        setSelectedId(updated.documents[updated.documents.length - 1]?.id || "");
      }
      setPendingDocs({ rfp: [], transcript: [], customer_doc: [], final_proposal: [] });
    } finally {
      setUploading(false);
    }
  };

  if (loading) return <p className="text-text-secondary">Loading documents...</p>;
  if (!proposal) return <p className="text-text-secondary">Proposal not found.</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => router.push(`/proposals/${id}`)}>
          <ArrowLeft size={16} className="mr-1" /> Back to proposal
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-text-primary sm:text-3xl">Documents</h1>
          <p className="text-text-secondary">{proposal.title}</p>
        </div>
      </div>

      <Card className="border-primary-200 bg-primary-50 dark:border-primary-500/30 dark:bg-primary-500/10">
        <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 shrink-0 text-primary-600" size={18} />
            <div>
              <p className="text-sm font-medium text-text-primary">Need a full new review cycle?</p>
              <p className="text-xs text-text-secondary">
                Upload a new version and restart the end-to-end review with a fresh AI review.
              </p>
            </div>
          </div>
          <Button variant="primary" size="sm" onClick={() => router.push(`/proposals/${id}/new-version`)}>
            <Upload size={16} className="mr-1" /> Upload New Version
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-4">
        <Card className="lg:col-span-1">
          <div className="max-h-[70vh] overflow-y-auto p-2">
            {proposal.documents.length === 0 ? (
              <p className="p-4 text-sm text-text-secondary">No documents uploaded.</p>
            ) : (
              <ul className="space-y-1">
                {proposal.documents.map((doc) => (
                  <li key={doc.id}>
                    <button
                      onClick={() => setSelectedId(doc.id)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors",
                        selectedId === doc.id
                          ? "bg-accent-bg text-accent-text"
                          : "text-text-secondary hover:bg-surface-muted"
                      )}
                    >
                      <FileText size={18} className="shrink-0" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{doc.name}</p>
                        <p className="text-xs text-text-tertiary">
                          {categoryLabels[doc.category]}
                          {doc.version ? ` • v${doc.version}` : ""}
                          {doc.size ? ` • ${formatBytes(doc.size)}` : ""}
                        </p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        <Card className="lg:col-span-3">
          <CardContent className="p-6">
            {!selected ? (
              <div className="flex flex-col items-center justify-center py-20 text-text-secondary">
                <Eye size={48} className="mb-4 text-text-muted" />
                <p>Select a document to preview</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-text-primary">{selected.name}</h2>
                    <div className="flex items-center gap-2 text-sm text-text-secondary">
                      <Badge variant={selected.category}>{categoryLabels[selected.category]}</Badge>
                      {selected.version && <Badge variant="secondary">v{selected.version}</Badge>}
                      <span>{formatBytes(selected.size)}</span>
                    </div>
                  </div>
                  <a href={dataUrl(selected)} download={selected.name}>
                    <Button variant="outline" size="sm">
                      <Download size={16} className="mr-1" /> Download
                    </Button>
                  </a>
                </div>

                <div className="rounded-xl border border-border bg-surface-muted/50 p-4">
                  {selected.mimeType.startsWith("image/") ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={dataUrl(selected)} alt={selected.name} className="max-h-[60vh] rounded-md object-contain" />
                  ) : selected.extractedText ? (
                    <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap text-sm text-text-primary">
                      {selected.extractedText}
                    </pre>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-16 text-text-secondary">
                      <FileIcon size={48} className="mb-3 text-text-muted" />
                      <p>Preview not available for this file type.</p>
                      <a href={dataUrl(selected)} download={selected.name} className="mt-2 text-primary-600 hover:underline">
                        Download file
                      </a>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Upload new version */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Upload size={18} />
            Upload New Version
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-text-secondary">
            Add updated documents for the current review cycle. Each upload is tracked as a new version and will be used in future AI reviews.
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
          {hasPendingDocs && (
            <div className="flex items-center justify-end gap-3 border-t border-border-subtle pt-4">
              <Button variant="outline" onClick={() => setPendingDocs({ rfp: [], transcript: [], customer_doc: [], final_proposal: [] })} disabled={uploading}>
                Clear
              </Button>
              <Button onClick={handleUpload} disabled={uploading}>
                <Plus size={16} className="mr-1" />
                {uploading ? "Uploading..." : "Upload new version(s)"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
