"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X } from "lucide-react";

interface ConfigListEditorProps {
  title: string;
  description?: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
  addLabel?: string;
}

export function ConfigListEditor({
  title,
  description,
  items,
  onChange,
  placeholder = "Add new item...",
  addLabel = "Add",
}: ConfigListEditorProps) {
  const [value, setValue] = useState("");

  const handleAdd = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    if (items.includes(trimmed)) {
      setValue("");
      return;
    }
    onChange([...items, trimmed]);
    setValue("");
  };

  const handleRemove = (item: string) => {
    onChange(items.filter((i) => i !== item));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium text-text-primary">{title}</p>
        {description && <p className="text-xs text-text-tertiary">{description}</p>}
      </div>

      <div className="flex flex-wrap gap-2">
        {items.length === 0 && (
          <span className="text-xs italic text-text-muted">No items configured.</span>
        )}
        {items.map((item) => (
          <span
            key={item}
            className="inline-flex items-center gap-1 rounded-full bg-surface-muted px-2.5 py-1 text-xs font-medium text-text-secondary ring-1 ring-border"
          >
            {item}
            <button
              type="button"
              onClick={() => handleRemove(item)}
              className="rounded-full p-0.5 transition-colors hover:bg-border"
              aria-label={`Remove ${item}`}
            >
              <X size={12} />
            </button>
          </span>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="flex-1"
        />
        <Button type="button" onClick={handleAdd} size="sm" variant="secondary">
          {addLabel}
        </Button>
      </div>
    </div>
  );
}
