"use client";

// Text-only Jarvis orchestration with no audio subsystems.

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { addJarvisMessage, clearJarvisMessages, getJarvisMessages } from "@/lib/db";
import { runAgentTurn } from "./agent";
import type { JarvisMessageRecord, JarvisStatus, ToolContext, TurnOutcome } from "./types";

export interface PendingConfirmation {
  toolName: string;
  description: string;
}

export interface UseJarvisResult {
  status: JarvisStatus;
  panelOpen: boolean;
  setPanelOpen: (open: boolean) => void;
  messages: JarvisMessageRecord[];
  pending: PendingConfirmation | null;
  error: string | null;
  submitText: (text: string) => void;
  confirmPending: (approved: boolean) => void;
  clearConversation: () => void;
}

export function useJarvis(): UseJarvisResult {
  const router = useRouter();
  const pathname = usePathname();
  const [status, setStatus] = useState<JarvisStatus>("idle");
  const [panelOpen, setPanelOpen] = useState(false);
  const [messages, setMessages] = useState<JarvisMessageRecord[]>([]);
  const [pending, setPending] = useState<PendingConfirmation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const messagesRef = useRef<JarvisMessageRecord[]>([]);
  const statusRef = useRef<JarvisStatus>("idle");
  const pathnameRef = useRef(pathname);
  const resumeRef = useRef<((approved: boolean) => Promise<TurnOutcome>) | null>(null);

  useEffect(() => { statusRef.current = status; }, [status]);
  useEffect(() => { pathnameRef.current = pathname; }, [pathname]);
  useEffect(() => {
    getJarvisMessages().then((history) => {
      messagesRef.current = history;
      setMessages(history);
    }).catch(() => {});
  }, []);

  const persistMessage = useCallback(async (message: Omit<JarvisMessageRecord, "id">) => {
    let record: JarvisMessageRecord = message;
    try { record = await addJarvisMessage(message); } catch {}
    messagesRef.current = [...messagesRef.current, record];
    setMessages(messagesRef.current);
  }, []);

  const buildCtx = useCallback((): ToolContext => ({
    pathname: pathnameRef.current,
    navigate: (path: string) => router.push(path),
  }), [router]);

  const handleOutcome = useCallback(async (outcome: TurnOutcome) => {
    if (outcome.kind === "confirm") {
      resumeRef.current = outcome.resume;
      setPending({ toolName: outcome.toolCall.tool, description: outcome.description });
      setStatus("confirming");
      return;
    }
    await persistMessage({ role: "assistant", content: outcome.content, createdAt: new Date() });
    setStatus("idle");
  }, [persistMessage]);

  const confirmPendingInternal = useCallback(async (approved: boolean) => {
    const resume = resumeRef.current;
    resumeRef.current = null;
    setPending(null);
    if (!resume) { setStatus("idle"); return; }
    setStatus("thinking");
    try { await handleOutcome(await resume(approved)); }
    catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong");
      setStatus("idle");
    }
  }, [handleOutcome]);

  const handleRequest = useCallback(async (text: string) => {
    const request = text.trim();
    if (!request || statusRef.current === "thinking") return;
    setError(null);
    setPanelOpen(true);
    const history = messagesRef.current;
    await persistMessage({ role: "user", content: request, createdAt: new Date() });
    setStatus("thinking");
    try { await handleOutcome(await runAgentTurn(request, history, buildCtx())); }
    catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong");
      setStatus("idle");
    }
  }, [buildCtx, handleOutcome, persistMessage]);

  const clearConversation = useCallback(() => {
    messagesRef.current = [];
    setMessages([]);
    clearJarvisMessages().catch(() => {});
  }, []);

  return {
    status,
    panelOpen,
    setPanelOpen,
    messages,
    pending,
    error,
    submitText: (text) => void handleRequest(text),
    confirmPending: (approved) => void confirmPendingInternal(approved),
    clearConversation,
  };
}
