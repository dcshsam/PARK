"use client";

// Jarvis slide-up panel: conversation history, live transcript, confirmation
// card, and the always-available text input fallback. Non-modal — the page
// underneath stays fully usable.

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Check, Loader2, Send, Settings2, Sparkles, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useJarvisContext } from "./jarvis-provider";
import type { ModelState } from "@/lib/jarvis/use-jarvis";

function EngineRow({
  label,
  value,
  options,
  modelState,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string; hint: string }[];
  modelState?: ModelState;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-text-secondary">{label}</span>
        <div className="flex gap-1">
          {options.map((option) => (
            <button
              key={option.value}
              onClick={() => onChange(option.value)}
              title={option.hint}
              className={cn(
                "rounded-md border px-2 py-1 text-xs transition-colors",
                value === option.value
                  ? "border-primary-500 bg-accent-bg font-medium text-accent-text"
                  : "border-border text-text-secondary hover:bg-surface-muted"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      {modelState?.status === "loading" && (
        <p className="mt-1 flex items-center gap-1.5 text-[10px] text-text-tertiary">
          <Loader2 size={10} className="animate-spin" />
          Downloading model… {modelState.progress > 0 ? `${modelState.progress}%` : ""}
        </p>
      )}
      {modelState?.status === "error" && (
        <p className="mt-1 text-[10px] text-status-danger-text">
          Model failed to load — check your network and try again.
        </p>
      )}
    </div>
  );
}

/** Page-aware suggested prompts (Agentforce-style per-page quick actions). */
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
  if (pathname.startsWith("/leads")) {
    return ["Any new leads this week?", "Create a lead draft"];
  }
  if (pathname.startsWith("/analytics")) {
    return ["What's our approval rate?", "What's the average review cycle time?"];
  }
  if (pathname.startsWith("/team-activity")) {
    return ["What is the team working on right now?"];
  }
  return ["How many proposals are pending review?", "What's our approval rate?", "Any new leads this week?"];
}

export function JarvisPanel() {
  const {
    status,
    panelOpen,
    setPanelOpen,
    messages,
    interim,
    pending,
    error,
    speechSupported,
    submitText,
    confirmPending,
    clearConversation,
    voiceSettings,
    updateVoiceSettings,
    whisperState,
    kokoroState,
    handsFreeActive,
  } = useJarvisContext();

  const [input, setInput] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const pathname = usePathname();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, interim, pending, status, panelOpen]);

  if (!panelOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || status === "thinking") return;
    setInput("");
    submitText(text);
  };

  return (
    <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+4.75rem)] right-4 z-40 flex max-h-[70vh] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-xl sm:bottom-24 sm:right-6 sm:w-[min(24rem,calc(100vw-3rem))]">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-600 text-white">
          <Sparkles size={14} />
        </span>
        <span className="text-sm font-semibold text-text-primary">Jarvis</span>
        <span className="text-xs text-text-tertiary">
          {status === "listening"
            ? "Listening…"
            : status === "thinking"
              ? "Thinking…"
              : status === "speaking"
                ? "Speaking…"
                : status === "confirming"
                  ? "Awaiting confirmation"
                  : ""}
        </span>
        <div className="ml-auto flex items-center gap-1">
          {handsFreeActive && (
            <span
              title="Hands-free listening is on"
              className="flex items-center gap-1 rounded-full bg-status-success-bg px-2 py-0.5 text-[10px] font-medium text-status-success-text"
            >
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-status-success-text" />
              hands-free
            </span>
          )}
          <button
            onClick={() => setSettingsOpen((o) => !o)}
            aria-label="Voice settings"
            title="Voice settings"
            className={cn(
              "rounded-md p-1.5 text-text-tertiary transition-colors hover:bg-surface-muted hover:text-text-primary",
              settingsOpen && "bg-surface-muted text-text-primary"
            )}
          >
            <Settings2 size={15} />
          </button>
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

      {/* Voice settings — all engines are free; on-device ones download once */}
      {settingsOpen && (
        <div className="space-y-3 border-b border-border/60 bg-surface-muted/40 px-4 py-3 text-sm">
          <EngineRow
            label="Voice input"
            value={voiceSettings.sttEngine}
            options={[
              { value: "browser", label: "Browser", hint: speechSupported ? "online" : "unavailable here" },
              { value: "whisper", label: "Whisper", hint: "on-device" },
            ]}
            modelState={voiceSettings.sttEngine === "whisper" ? whisperState : undefined}
            onChange={(value) => updateVoiceSettings({ sttEngine: value as "browser" | "whisper" })}
          />
          <EngineRow
            label="Voice output"
            value={voiceSettings.ttsEngine}
            options={[
              { value: "browser", label: "Browser", hint: "instant" },
              { value: "kokoro", label: "Kokoro", hint: "neural, on-device" },
            ]}
            modelState={voiceSettings.ttsEngine === "kokoro" ? kokoroState : undefined}
            onChange={(value) => updateVoiceSettings({ ttsEngine: value as "browser" | "kokoro" })}
          />
          <label className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-text-secondary">
              Hands-free mode
              <span className="block text-[10px] font-normal text-text-tertiary">
                Mic stays open; speak anytime (uses Whisper)
              </span>
            </span>
            <input
              type="checkbox"
              checked={voiceSettings.handsFree}
              onChange={(e) => updateVoiceSettings({ handsFree: e.target.checked })}
              className="h-4 w-4 accent-primary-600"
            />
          </label>
          <p className="text-[10px] leading-snug text-text-tertiary">
            On-device engines are free and private: a one-time model download (~80–90 MB) is cached by
            the browser, then they work offline.
          </p>
        </div>
      )}

      {/* Conversation */}
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {messages.length === 0 && !interim && (
          <p className="py-6 text-center text-sm text-text-tertiary">
            Ask about proposals or leads, or say things like
            <br />
            <span className="text-text-secondary">“How many proposals are pending review?”</span>
            {!speechSupported && (
              <span className="mt-2 block text-xs text-text-muted">
                Voice input isn&apos;t available in this browser — type below instead.
              </span>
            )}
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={m.id ?? `mem-${i}`}
            className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
          >
            <div
              className={cn(
                "max-w-[85%] whitespace-pre-wrap rounded-xl px-3 py-2 text-sm",
                m.role === "user"
                  ? "bg-primary-600 text-white"
                  : "bg-surface-muted text-text-primary"
              )}
            >
              {m.content}
            </div>
          </div>
        ))}
        {interim && (
          <div className="flex justify-end">
            <div className="max-w-[85%] rounded-xl bg-primary-600/50 px-3 py-2 text-sm italic text-white">
              {interim}
            </div>
          </div>
        )}
        {status === "thinking" && (
          <div className="flex items-center gap-2 text-xs text-text-tertiary">
            <Loader2 size={13} className="animate-spin" /> Working on it…
          </div>
        )}
        {error && (
          <div className="rounded-lg border border-status-danger-text/30 bg-status-danger-bg px-3 py-2 text-xs text-status-danger-text">
            {error}
          </div>
        )}
      </div>

      {/* Confirmation card — mutating actions never run without this */}
      {pending && (
        <div className="border-t border-amber-500/40 bg-status-warning-bg px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-status-warning-text">
            Confirm action
          </p>
          <p className="mt-1 text-sm text-text-primary">{pending.description}</p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={() => confirmPending(true)} className="gap-1.5">
              <Check size={14} /> Confirm
            </Button>
            <Button size="sm" variant="outline" onClick={() => confirmPending(false)} className="gap-1.5">
              <X size={14} /> Cancel
            </Button>
          </div>
          {speechSupported && (
            <p className="mt-2 text-xs text-text-tertiary">…or press the mic and say “yes” / “no”.</p>
          )}
        </div>
      )}

      {/* Page-aware quick actions */}
      {!pending && status !== "thinking" && (
        <div className="flex flex-wrap gap-1.5 border-t border-border/60 px-3 pt-2.5">
          {suggestionsFor(pathname).map((s) => (
            <button
              key={s}
              onClick={() => submitText(s)}
              className="rounded-full border border-border bg-surface-muted/60 px-2.5 py-1 text-xs text-text-secondary transition-colors hover:bg-surface-muted hover:text-text-primary"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Text fallback — always visible so typing works even when speech does */}
      <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t border-border/60 px-3 py-2.5">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a request…"
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
