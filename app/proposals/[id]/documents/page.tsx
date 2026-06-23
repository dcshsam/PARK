"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getProposal } from "@/lib/db";
import type { Proposal, UploadedFile } from "@/lib/types";
import { categoryLabels } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatBytes } from "@/lib/utils";
import { ArrowLeft, FileText, Download, Eye, FileIcon } from "lucide-react";
import { cn } from "@/lib/utils";

function dataUrl(doc: UploadedFile): string {
  if (!doc.content) return "";
  return `data:${doc.mimeType};base64,${doc.content}`;
}

export default function DocumentsPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string>("");

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
                        <p className="text-xs text-text-tertiary">{formatBytes(doc.size)}</p>
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
    </div>
  );
}
