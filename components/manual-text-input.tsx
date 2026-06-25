"use client";

import { useState } from "react";
import { Plus, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { categoryLabels, type DocumentCategory } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ManualTextInputProps {
  category: DocumentCategory;
  onAdd: (text: string) => void;
  className?: string;
}

export function ManualTextInput({ category, onAdd, className }: ManualTextInputProps) {
  const [text, setText] = useState("");
  const [expanded, setExpanded] = useState(false);

  const handleAdd = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setText("");
    setExpanded(false);
  };

  return (
    <div className={cn("rounded-xl border border-dashed border-border bg-surface p-3", className)}>
      {!expanded ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="flex w-full items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-muted hover:text-text-primary"
        >
          <FileText className="h-4 w-4" />
          Or paste / type {categoryLabels[category]} text
        </button>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-text-secondary">
              Paste or type {categoryLabels[category]} text
            </span>
            <button
              type="button"
              onClick={() => {
                setText("");
                setExpanded(false);
              }}
              className="text-xs text-text-tertiary hover:text-text-primary"
            >
              Cancel
            </button>
          </div>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste meeting notes, RFP excerpts, customer requirements, etc."
            rows={5}
            className="resize-y"
          />
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="w-full"
            disabled={!text.trim()}
            onClick={handleAdd}
          >
            <Plus className="mr-1 h-4 w-4" />
            Add as document
          </Button>
        </div>
      )}
    </div>
  );
}
