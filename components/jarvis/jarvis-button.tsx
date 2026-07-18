"use client";

import { AlertTriangle, Loader2, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useJarvisContext } from "./jarvis-provider";

export function JarvisButton({ placement = "floating" }: { placement?: "floating" | "inline" }) {
  const { status, panelOpen, setPanelOpen } = useJarvisContext();
  const label = panelOpen ? "Close Jarvis" : "Open Jarvis (Ctrl+J)";
  const icon =
    status === "thinking" ? (
      <Loader2 size={22} className="animate-spin" />
    ) : status === "confirming" ? (
      <AlertTriangle size={22} />
    ) : (
      <MessageCircle size={22} />
    );

  return (
    <button
      onClick={() => setPanelOpen(!panelOpen)}
      aria-label={label}
      title={label}
      className={cn(
        "items-center justify-center bg-primary-600 text-white shadow-lg transition-all hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 active:scale-95",
        placement === "floating"
          ? "fixed bottom-6 right-6 z-40 hidden h-14 w-14 rounded-full sm:flex"
          : "relative flex h-9 w-9 rounded-lg shadow-none sm:hidden",
        status === "confirming" && "bg-amber-500 hover:bg-amber-600"
      )}
    >
      {icon}
    </button>
  );
}
