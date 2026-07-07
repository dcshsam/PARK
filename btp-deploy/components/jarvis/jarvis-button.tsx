"use client";

// Floating push-to-talk mic button, bottom-right, state-aware.

import { Loader2, Mic, MicOff, Square, Volume2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useJarvisContext } from "./jarvis-provider";

export function JarvisButton() {
  const { status, panelOpen, setPanelOpen, toggleListening, speechSupported, voiceSettings } =
    useJarvisContext();

  // Whisper works everywhere; the Web Speech engine is Chromium-only.
  const voiceAvailable = speechSupported || voiceSettings.sttEngine === "whisper";

  const handleClick = () => {
    if (status === "idle" && !panelOpen) {
      // First interaction opens the panel; mic starts from there or on 2nd click.
      setPanelOpen(true);
      if (voiceAvailable) toggleListening();
      return;
    }
    if (voiceAvailable) toggleListening();
    else setPanelOpen(!panelOpen);
  };

  const icon =
    status === "listening" ? (
      <Square size={20} fill="currentColor" />
    ) : status === "thinking" ? (
      <Loader2 size={22} className="animate-spin" />
    ) : status === "speaking" ? (
      <Volume2 size={22} />
    ) : status === "confirming" ? (
      <AlertTriangle size={22} />
    ) : voiceAvailable ? (
      <Mic size={22} />
    ) : (
      <MicOff size={22} />
    );

  const label =
    status === "listening"
      ? "Stop listening"
      : status === "confirming"
        ? "Awaiting confirmation"
        : "Talk to Jarvis (Ctrl+J)";

  return (
    <button
      onClick={handleClick}
      aria-label={label}
      title={label}
      className={cn(
        "fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 active:scale-95",
        status === "listening" && "jarvis-pulse bg-red-500 hover:bg-red-600",
        status === "confirming" && "bg-amber-500 hover:bg-amber-600",
        status === "speaking" && "bg-primary-600",
        (status === "idle" || status === "thinking") && "bg-primary-600 hover:bg-primary-700"
      )}
    >
      {icon}
      {status === "listening" && (
        <span className="jarvis-ring absolute inset-0 rounded-full border-2 border-red-400" aria-hidden />
      )}
    </button>
  );
}
