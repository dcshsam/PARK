"use client";

// Owns the single useJarvis() instance and the global Ctrl+J / Cmd+J shortcut.
// Mounted once in the app shell; button and panel consume the context.

import { createContext, useContext, useEffect } from "react";
import { useJarvis, type UseJarvisResult } from "@/lib/jarvis/use-jarvis";

const JarvisContext = createContext<UseJarvisResult | null>(null);

export function useJarvisContext(): UseJarvisResult {
  const ctx = useContext(JarvisContext);
  if (!ctx) throw new Error("useJarvisContext must be used within <JarvisProvider>");
  return ctx;
}

export function JarvisProvider({ children }: { children: React.ReactNode }) {
  const jarvis = useJarvis();
  const { panelOpen, setPanelOpen } = jarvis;

  // Ctrl+J / Cmd+J toggles the text assistant from anywhere in the app.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setPanelOpen(!panelOpen);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panelOpen, setPanelOpen]);

  return <JarvisContext.Provider value={jarvis}>{children}</JarvisContext.Provider>;
}
