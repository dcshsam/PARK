"use client";

import { useCallback, useRef, useState } from "react";
import { Upload, X, FileText, File as FileIcon, Loader2 } from "lucide-react";
import { cn, formatBytes } from "@/lib/utils";
import type { DocumentCategory, UploadedFile } from "@/lib/types";
import { categoryLabels } from "@/lib/types";
import { Button } from "./ui/button";

interface FileUploadProps {
  category: DocumentCategory;
  files: Omit<UploadedFile, "id" | "proposalId" | "uploadedAt">[];
  onChange: (files: Omit<UploadedFile, "id" | "proposalId" | "uploadedAt">[]) => void;
  required?: boolean;
}

const categoryStyles: Record<
  DocumentCategory,
  { label: string; border: string; bg: string; iconColor: string; badge: string }
> = {
  rfp: {
    label: "RFP Document",
    border: "border-rfp-200 hover:border-rfp-500 dark:border-rfp-200/30 dark:hover:border-rfp-500/70",
    bg: "bg-rfp-50",
    iconColor: "text-rfp-600",
    badge: "bg-rfp-100 text-rfp-700",
  },
  transcript: {
    label: "Meeting Transcript",
    border: "border-transcript-200 hover:border-transcript-500 dark:border-transcript-200/30 dark:hover:border-transcript-500/70",
    bg: "bg-transcript-50",
    iconColor: "text-transcript-600",
    badge: "bg-transcript-100 text-transcript-700",
  },
  customer_doc: {
    label: "Customer Document",
    border: "border-customer-200 hover:border-customer-500 dark:border-customer-200/30 dark:hover:border-customer-500/70",
    bg: "bg-customer-50",
    iconColor: "text-customer-600",
    badge: "bg-customer-100 text-customer-700",
  },
  final_proposal: {
    label: "Customer Final Proposal",
    border: "border-final-proposal-200 hover:border-final-proposal-500 dark:border-final-proposal-200/30 dark:hover:border-final-proposal-500/70",
    bg: "bg-final-proposal-50",
    iconColor: "text-final-proposal-600",
    badge: "bg-final-proposal-100 text-final-proposal-700",
  },
  lead_mail: {
    label: "Mail",
    border: "border-status-info-text hover:border-status-info-text dark:border-status-info-text/30 dark:hover:border-status-info-text/70",
    bg: "bg-status-info-bg",
    iconColor: "text-status-info-text",
    badge: "bg-status-info-bg text-status-info-text",
  },
  lead_mom: {
    label: "Minutes of Meeting",
    border: "border-status-warning-text hover:border-status-warning-text dark:border-status-warning-text/30 dark:hover:border-status-warning-text/70",
    bg: "bg-status-warning-bg",
    iconColor: "text-status-warning-text",
    badge: "bg-status-warning-bg text-status-warning-text",
  },
  lead_discussion: {
    label: "Discussion Notes",
    border: "border-status-danger-text hover:border-status-danger-text dark:border-status-danger-text/30 dark:hover:border-status-danger-text/70",
    bg: "bg-status-danger-bg",
    iconColor: "text-status-danger-text",
    badge: "bg-status-danger-bg text-status-danger-text",
  },
  lead_pre_qual_form: {
    label: "Pre-Qualification Form",
    border: "border-status-info-text hover:border-status-info-text dark:border-status-info-text/30 dark:hover:border-status-info-text/70",
    bg: "bg-status-info-bg",
    iconColor: "text-status-info-text",
    badge: "bg-status-info-bg text-status-info-text",
  },
  lead_due_diligence: {
    label: "Due Diligence Document",
    border: "border-primary-500 hover:border-primary-500 dark:border-primary-500/30 dark:hover:border-primary-500/70",
    bg: "bg-primary-50",
    iconColor: "text-primary-600",
    badge: "bg-primary-100 text-primary-700",
  },
  lead_proposal: {
    label: "Proposal Document",
    border: "border-status-success-text hover:border-status-success-text dark:border-status-success-text/30 dark:hover:border-status-success-text/70",
    bg: "bg-status-success-bg",
    iconColor: "text-status-success-text",
    badge: "bg-status-success-bg text-status-success-text",
  },
  lead_customer_doc: {
    label: "Customer Document (RFP / Requirement Summary)",
    border: "border-customer-200 hover:border-customer-500 dark:border-customer-200/30 dark:hover:border-customer-500/70",
    bg: "bg-customer-50",
    iconColor: "text-customer-600",
    badge: "bg-customer-100 text-customer-700",
  },
  lead_final_deck: {
    label: "Final Pitch Deck",
    border: "border-final-proposal-200 hover:border-final-proposal-500 dark:border-final-proposal-200/30 dark:hover:border-final-proposal-500/70",
    bg: "bg-final-proposal-50",
    iconColor: "text-final-proposal-600",
    badge: "bg-final-proposal-100 text-final-proposal-700",
  },
};

async function extractTextFromBase64(base64: string, file: File): Promise<string> {
  try {
    const response = await fetch("/api/documents/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        base64,
        mimeType: file.type,
        name: file.name,
      }),
    });
    const body = (await response.json()) as { text?: string; error?: string };
    if (!response.ok) {
      return `Extraction failed: ${body.error || response.statusText}`;
    }
    return body.text || "";
  } catch (err) {
    return `Extraction failed: ${err instanceof Error ? err.message : "Unknown error"}`;
  }
}

async function readFile(file: File): Promise<{ content?: string; extractedText?: string }> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = async () => {
      const result = reader.result as string;
      if (file.type.startsWith("text/") || file.name.endsWith(".txt") || file.name.endsWith(".md")) {
        resolve({ content: btoa(unescape(encodeURIComponent(result))), extractedText: result });
      } else if (file.type.startsWith("image/")) {
        resolve({ content: result.split(",")[1], extractedText: "Image preview available." });
      } else {
        const base64 = result.split(",")[1];
        const extractedText = await extractTextFromBase64(base64, file);
        resolve({ content: base64, extractedText });
      }
    };
    reader.onerror = () => resolve({});
    if (file.type.startsWith("text/") || file.name.endsWith(".txt") || file.name.endsWith(".md")) {
      reader.readAsText(file);
    } else {
      reader.readAsDataURL(file);
    }
  });
}

export function FileUpload({ category, files, onChange, required = false }: FileUploadProps) {
  const style = categoryStyles[category];
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [processing, setProcessing] = useState<string[]>([]);

  const handleFiles = useCallback(
    async (incoming: FileList | null) => {
      if (!incoming) return;
      const fileList = Array.from(incoming);
      setProcessing(fileList.map((f) => f.name));
      const results: Omit<UploadedFile, "id" | "proposalId" | "uploadedAt">[] = [];
      for (const file of fileList) {
        const { content, extractedText } = await readFile(file);
        results.push({
          category,
          name: file.name,
          size: file.size,
          mimeType: file.type || "application/octet-stream",
          content,
          extractedText,
        });
      }
      setProcessing([]);
      onChange([...files, ...results]);
    },
    [category, files, onChange]
  );

  const remove = (name: string) => {
    onChange(files.filter((f) => f.name !== name));
  };

  return (
    <div className="space-y-3">
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          "cursor-pointer rounded-xl border-2 border-dashed p-6 transition-all",
          style.border,
          dragOver ? `${style.bg} scale-[1.02]` : "bg-surface hover:bg-surface-muted",
          "flex flex-col items-center gap-2 text-center"
        )}
      >
        <div className={cn("rounded-full p-3", style.bg)}>
          <Upload className={cn("h-6 w-6", style.iconColor)} />
        </div>
        <div>
          <p className="text-sm font-medium text-text-primary">
            Drop {categoryLabels[category]} here
          </p>
          <p className="text-xs text-text-tertiary">
            or click to browse {required ? "(required)" : "(optional)"}
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          required={required}
          aria-required={required}
          accept=".txt,.md,.pdf,.docx,.png,.jpg,.jpeg"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {files.length > 0 && (
        <ul className="space-y-2">
          {files.map((file) => (
            <li
              key={file.name}
              className="flex items-center justify-between rounded-lg border border-border bg-surface p-3 shadow-sm"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", style.bg)}>
                  {file.mimeType.startsWith("text/") ? (
                    <FileText className={cn("h-5 w-5", style.iconColor)} />
                  ) : (
                    <FileIcon className={cn("h-5 w-5", style.iconColor)} />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-text-primary">{file.name}</p>
                  <p className="text-xs text-text-tertiary">{formatBytes(file.size)}</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => remove(file.name)}
                className="shrink-0"
                aria-label={`Remove ${file.name}`}
              >
                <X size={16} />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {processing.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-text-tertiary">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Processing {processing.length} file(s)...
        </div>
      )}
    </div>
  );
}
