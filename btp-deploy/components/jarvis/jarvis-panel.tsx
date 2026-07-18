"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Check, Loader2, Send, Sparkles, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useJarvisContext } from "./jarvis-provider";

function suggestionsFor(pathname: string): string[] {
  if (/^\/proposals\/(?!new)[^/]+/.test(pathname)) {
    return ["Summarize this proposal", "Run the AI review on it", "What do its documents say about timelines?"];
  }
  if (pathname.startsWith("/proposals")) {
    return ["Show proposals due this month", "How many proposals are pending review?"];
  }
  if (/^\/leads\/(?!new)[^/]+/.test(pathname)) {
    return ["Summarize this lead", "Draft a follow-up email for this lead"];
  }
  if (pathname.startsWith("/leads")) return ["Any new leads this week?", "Create a lead draft"];
  if (pathname.startsWith("/analytics")) return ["What's our approval rate?", "What's the average review cycle time?"];
  if (pathname.startsWith("/team-activity")) return ["What is the team working on right now?"];
  return ["How many proposals are pending review?", "What's our approval rate?", "Any new leads this week?"];
}

export function JarvisPanel() {
  const {
    status,
    panelOpen,
    setPanelOpen,
    messages,
    pending,
    error,
    submitText,
    confirmPending,
    clearConversation,
  } = useJarvisContext();
  const [input, setInput] = useState("");
  const pathname = usePathname();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, pending, status, panelOpen]);

  if (!panelOpen) return null;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const text = input.trim();
    if (!text || status === "thinking") return;
    setInput("");
    submitText(text);
  };

  return (
    <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+4.75rem)] right-4 z-40 flex max-h-[70vh] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-xl sm:bottom-24 sm:right-6 sm:w-[min(24rem,calc(100vw-3rem))]">
      <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-600 text-white">
          <Sparkles size={14} />
        </span>
        <span className="text-sm font-semibold text-text-primary">Jarvis</span>
        <span className="text-xs text-text-tertiary">
          {status === "thinking" ? "Thinking..." : status === "confirming" ? "Awaiting confirmation" : ""}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={clearConversation}
            aria-label="Clear conversation"
            title="Clear conversation"
            className="rounded-md p-1.5 text-text-tertiary transition-colors hover:bg-surface-muted hover:text-text-primary"
          >
            <Trash2 size={15} />
          </button>
          <button
            onClick={() => setPanelOpen(false)}
            aria-label="Close Jarvis"
            className="rounded-md p-1.5 text-text-tertiary transition-colors hover:bg-surface-muted hover:text-text-primary"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {messages.length === 0 && (
          <p className="py-6 text-center text-sm text-text-tertiary">
            Ask about proposals or leads, for example:
            <br />
            <span className="text-text-secondary">&ldquo;How many proposals are pending review?&rdquo;</span>
          </p>
        )}
        {messages.map((message, index) => (
          <div
            key={message.id ?? `mem-${index}`}
            className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}
          >
            <div
              className={cn(
                "max-w-[85%] whitespace-pre-wrap rounded-xl px-3 py-2 text-sm",
                message.role === "user" ? "bg-primary-600 text-white" : "bg-surface-muted text-text-primary"
              )}
            >
              {message.content}
            </div>
          </div>
        ))}
        {status === "thinking" && (
          <div className="flex items-center gap-2 text-xs text-text-tertiary">
            <Loader2 size={13} className="animate-spin" /> Working on it...
          </div>
        )}
        {error && (
          <div className="rounded-lg border border-status-danger-text/30 bg-status-danger-bg px-3 py-2 text-xs text-status-danger-text">
            {error}
          </div>
        )}
      </div>

      {pending && (
        <div className="border-t border-amber-500/40 bg-status-warning-bg px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-status-warning-text">Confirm action</p>
          <p className="mt-1 text-sm text-text-primary">{pending.description}</p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={() => confirmPending(true)} className="gap-1.5">
              <Check size={14} /> Confirm
            </Button>
            <Button size="sm" variant="outline" onClick={() => confirmPending(false)} className="gap-1.5">
              <X size={14} /> Cancel
            </Button>
          </div>
        </div>
      )}

      {!pending && status !== "thinking" && (
        <div className="flex flex-wrap gap-1.5 border-t border-border/60 px-3 pt-2.5">
          {suggestionsFor(pathname).map((suggestion) => (
            <button
              key={suggestion}
              onClick={() => submitText(suggestion)}
              className="rounded-full border border-border bg-surface-muted/60 px-2.5 py-1 text-xs text-text-secondary transition-colors hover:bg-surface-muted hover:text-text-primary"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t border-border/60 px-3 py-2.5">
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Type a request..."
          className="h-9 flex-1 rounded-lg border border-border-strong bg-surface px-3 text-sm text-text-primary placeholder:text-text-muted focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
        />
        <Button
          type="submit"
          size="sm"
          disabled={!input.trim() || status === "thinking"}
          aria-label="Send"
          className="h-9 w-9 p-0"
        >
          <Send size={15} />
        </Button>
      </form>
    </div>
  );
}
