"use client";

// Jarvis orchestration hook — owns the state machine:
// idle → listening → thinking → (confirming) → speaking → idle
// One instance lives in <JarvisProvider>; the button and panel consume it.
//
// Two interchangeable voice stacks (user-selectable, both free):
// - "browser": Web Speech API (Chromium STT, robotic TTS, zero download)
// - "whisper"/"kokoro": fully on-device models via web workers (one-time
//   cached download; offline + private). Hands-free mode = Silero VAD
//   segmenting speech → Whisper transcription, no button presses.

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { addJarvisMessage, clearJarvisMessages, getJarvisMessages } from "@/lib/db";
import { runAgentTurn } from "./agent";
import {
  createRecognizer,
  isSpeechRecognitionSupported,
  isTtsSupported,
  speak,
  stopSpeaking,
  type Recognizer,
} from "./speech";
import {
  DEFAULT_VOICE_SETTINGS,
  getVoiceSettings,
  saveVoiceSettings,
  type JarvisVoiceSettings,
} from "./voice-settings";
import { preloadWhisper, transcribeAudio, type ModelStatus } from "./whisper";
import { preloadKokoro, speakKokoro, stopKokoro } from "./kokoro-tts";
import { createVad, type VadHandle } from "./vad";
import type { JarvisMessageRecord, JarvisStatus, ToolContext, TurnOutcome } from "./types";

export interface PendingConfirmation {
  toolName: string;
  description: string;
}

export interface ModelState {
  status: ModelStatus;
  /** Download progress 0-100 while status is "loading". */
  progress: number;
}

export interface UseJarvisResult {
  status: JarvisStatus;
  panelOpen: boolean;
  setPanelOpen: (open: boolean) => void;
  messages: JarvisMessageRecord[];
  /** Live interim transcript while listening. */
  interim: string;
  pending: PendingConfirmation | null;
  error: string | null;
  speechSupported: boolean;
  ttsSupported: boolean;
  voiceSettings: JarvisVoiceSettings;
  updateVoiceSettings: (changes: Partial<JarvisVoiceSettings>) => void;
  whisperState: ModelState;
  kokoroState: ModelState;
  /** True while the hands-free VAD loop is live. */
  handsFreeActive: boolean;
  /** Push-to-talk: start listening, or stop if already listening. */
  toggleListening: () => void;
  /** Text-input fallback — always available. */
  submitText: (text: string) => void;
  confirmPending: (approved: boolean) => void;
  clearConversation: () => void;
}

const CONFIRM_WORDS = /\b(yes|yeah|yep|confirm|approve|go ahead|do it|sure|ok|okay)\b/i;
const CANCEL_WORDS = /\b(no|nope|cancel|stop|don't|abort|never mind)\b/i;

export function useJarvis(): UseJarvisResult {
  const router = useRouter();
  const pathname = usePathname();

  const [status, setStatus] = useState<JarvisStatus>("idle");
  const [panelOpen, setPanelOpen] = useState(false);
  const [messages, setMessages] = useState<JarvisMessageRecord[]>([]);
  const [interim, setInterim] = useState("");
  const [pending, setPending] = useState<PendingConfirmation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [speechSupported, setSpeechSupported] = useState(false);
  // Start from the deterministic defaults so the first client render matches
  // the server HTML; the persisted localStorage settings load after mount.
  const [voiceSettings, setVoiceSettings] = useState<JarvisVoiceSettings>(DEFAULT_VOICE_SETTINGS);
  const [whisperState, setWhisperState] = useState<ModelState>({ status: "idle", progress: 0 });
  const [kokoroState, setKokoroState] = useState<ModelState>({ status: "idle", progress: 0 });
  const [handsFreeActive, setHandsFreeActive] = useState(false);

  // Refs so async agent turns and voice callbacks always see fresh state.
  const messagesRef = useRef<JarvisMessageRecord[]>([]);
  const statusRef = useRef<JarvisStatus>("idle");
  const pathnameRef = useRef(pathname);
  const settingsRef = useRef(voiceSettings);
  const recognizerRef = useRef<Recognizer | null>(null);
  const pttVadRef = useRef<VadHandle | null>(null);
  const handsFreeVadRef = useRef<VadHandle | null>(null);
  const resumeRef = useRef<((approved: boolean) => Promise<TurnOutcome>) | null>(null);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    settingsRef.current = voiceSettings;
  }, [voiceSettings]);

  useEffect(() => {
    Promise.resolve().then(() => {
      setSpeechSupported(isSpeechRecognitionSupported());
      const persisted = getVoiceSettings();
      settingsRef.current = persisted;
      setVoiceSettings(persisted);
    });
    getJarvisMessages()
      .then((history) => {
        messagesRef.current = history;
        setMessages(history);
      })
      .catch(() => {});
    const pttVad = pttVadRef;
    const handsFreeVad = handsFreeVadRef;
    const recognizer = recognizerRef;
    return () => {
      recognizer.current?.abort();
      pttVad.current?.destroy();
      handsFreeVad.current?.destroy();
      stopSpeaking();
      stopKokoro();
    };
  }, []);

  const persistMessage = useCallback(async (message: Omit<JarvisMessageRecord, "id">) => {
    let record: JarvisMessageRecord = message;
    try {
      record = await addJarvisMessage(message);
    } catch {
      // IndexedDB hiccups shouldn't kill the conversation — keep it in memory.
    }
    messagesRef.current = [...messagesRef.current, record];
    setMessages(messagesRef.current);
  }, []);

  const buildCtx = useCallback(
    (): ToolContext => ({
      pathname: pathnameRef.current,
      navigate: (path: string) => router.push(path),
    }),
    [router]
  );

  const ensureWhisper = useCallback(async () => {
    setWhisperState((s) => (s.status === "ready" ? s : { status: "loading", progress: s.progress }));
    try {
      await preloadWhisper((progress) => setWhisperState({ status: "loading", progress }));
      setWhisperState({ status: "ready", progress: 100 });
    } catch (err) {
      setWhisperState({ status: "error", progress: 0 });
      throw err;
    }
  }, []);

  const ensureKokoro = useCallback(async () => {
    setKokoroState((s) => (s.status === "ready" ? s : { status: "loading", progress: s.progress }));
    try {
      await preloadKokoro((progress) => setKokoroState({ status: "loading", progress }));
      setKokoroState({ status: "ready", progress: 100 });
    } catch (err) {
      setKokoroState({ status: "error", progress: 0 });
      throw err;
    }
  }, []);

  const stopAllSpeech = useCallback(() => {
    stopSpeaking();
    stopKokoro();
  }, []);

  // Early TTS: the streamed answer's "speech" field completes before the full
  // reply, so speaking starts here and handleOutcome reconciles afterwards.
  const earlySpeechRef = useRef<{ text: string; done: Promise<void> } | null>(null);

  /** Speak via the selected engine; Kokoro failures fall back to the browser voice. */
  const speakOut = useCallback(
    async (text: string) => {
      // Mute the hands-free mic while Jarvis talks, or it hears itself.
      handsFreeVadRef.current?.pause();
      try {
        if (settingsRef.current.ttsEngine === "kokoro") {
          try {
            await ensureKokoro();
            await speakKokoro(text);
            return;
          } catch {
            // fall through to browser TTS
          }
        }
        await speak(text);
      } finally {
        handsFreeVadRef.current?.resume();
      }
    },
    [ensureKokoro]
  );

  const startEarlySpeech = useCallback(
    (speech: string) => {
      setStatus("speaking");
      earlySpeechRef.current = { text: speech, done: speakOut(speech).catch(() => {}) };
    },
    [speakOut]
  );

  const handleOutcome = useCallback(
    async (outcome: TurnOutcome) => {
      const early = earlySpeechRef.current;
      earlySpeechRef.current = null;
      if (outcome.kind === "confirm") {
        if (early) stopAllSpeech();
        resumeRef.current = outcome.resume;
        setPending({ toolName: outcome.toolCall.tool, description: outcome.description });
        setStatus("confirming");
        await speakOut(`Please confirm: ${outcome.description}`);
        return;
      }
      await persistMessage({
        role: "assistant",
        // `||` not `??`: models sometimes send display: "" — fall back to speech.
        content: outcome.display || outcome.speech,
        createdAt: new Date(),
      });
      setStatus("speaking");
      if (early && early.text === outcome.speech) {
        await early.done; // already speaking it — just wait for it to finish
      } else {
        if (early) stopAllSpeech();
        await speakOut(outcome.speech);
      }
      setStatus((s) => (s === "speaking" ? "idle" : s));
    },
    [persistMessage, speakOut, stopAllSpeech]
  );

  const confirmPendingInternal = useCallback(
    async (approved: boolean) => {
      const resume = resumeRef.current;
      resumeRef.current = null;
      setPending(null);
      if (!resume) {
        setStatus("idle");
        return;
      }
      setStatus("thinking");
      try {
        const outcome = await resume(approved);
        await handleOutcome(outcome);
      } catch (err) {
        earlySpeechRef.current = null;
        stopAllSpeech();
        const message = err instanceof Error ? err.message : "Something went wrong";
        setError(message);
        setStatus("speaking");
        await speakOut("Sorry, the action failed. Details are in the panel.");
        setStatus((s) => (s === "speaking" ? "idle" : s));
      }
    },
    [handleOutcome, speakOut, stopAllSpeech]
  );

  const handleUtterance = useCallback(
    async (text: string) => {
      const utterance = text.trim();
      if (!utterance) return;
      stopAllSpeech();
      earlySpeechRef.current = null;
      setError(null);
      setPanelOpen(true);

      // Spoken yes/no while a confirmation is pending resolves it directly.
      if (statusRef.current === "confirming" && resumeRef.current) {
        if (CONFIRM_WORDS.test(utterance)) return void confirmPendingInternal(true);
        if (CANCEL_WORDS.test(utterance)) return void confirmPendingInternal(false);
        setError('Say "yes" or "no", or use the Confirm / Cancel buttons.');
        return;
      }

      const history = messagesRef.current;
      await persistMessage({ role: "user", content: utterance, createdAt: new Date() });
      setStatus("thinking");
      try {
        const outcome = await runAgentTurn(utterance, history, buildCtx(), startEarlySpeech);
        await handleOutcome(outcome);
      } catch (err) {
        earlySpeechRef.current = null;
        stopAllSpeech();
        const message = err instanceof Error ? err.message : "Something went wrong";
        setError(message);
        setStatus("speaking");
        await speakOut("Sorry, that failed. Details are in the panel.");
        setStatus((s) => (s === "speaking" ? "idle" : s));
      }
    },
    [buildCtx, confirmPendingInternal, handleOutcome, persistMessage, speakOut, startEarlySpeech, stopAllSpeech]
  );

  const settleAfterListening = useCallback(() => {
    setStatus((s) => (s === "listening" ? (resumeRef.current ? "confirming" : "idle") : s));
  }, []);

  const stopListening = useCallback(() => {
    recognizerRef.current?.stop();
    recognizerRef.current = null;
    pttVadRef.current?.destroy();
    pttVadRef.current = null;
    setInterim("");
    settleAfterListening();
  }, [settleAfterListening]);

  /** Push-to-talk via on-device VAD + Whisper (one utterance, then stop). */
  const startWhisperListening = useCallback(async () => {
    try {
      await ensureWhisper();
      const vad = await createVad({
        onSpeechStart: () => setInterim("(hearing you…)"),
        onSpeechEnd: (audio) => {
          pttVadRef.current?.pause();
          setInterim("(transcribing…)");
          transcribeAudio(audio)
            .then((text) => {
              pttVadRef.current?.destroy();
              pttVadRef.current = null;
              setInterim("");
              if (text) void handleUtterance(text);
              else settleAfterListening();
            })
            .catch((err) => {
              pttVadRef.current?.destroy();
              pttVadRef.current = null;
              setInterim("");
              setError(err instanceof Error ? err.message : "Transcription failed");
              settleAfterListening();
            });
        },
      });
      // The user may have cancelled while the model was warming up.
      if (statusRef.current !== "listening") {
        vad.destroy();
        return;
      }
      pttVadRef.current = vad;
    } catch (err) {
      setError(
        err instanceof Error
          ? `Whisper couldn't start: ${err.message}`
          : "Whisper couldn't start — check mic permission and network for the first model download."
      );
      settleAfterListening();
    }
  }, [ensureWhisper, handleUtterance, settleAfterListening]);

  const startBrowserListening = useCallback(() => {
    const recognizer = createRecognizer({
      onInterim: (t) => setInterim(t),
      onFinal: (t) => {
        setInterim("");
        void handleUtterance(t);
      },
      onError: (code, message) => {
        setInterim("");
        if (code !== "aborted") setError(message);
        settleAfterListening();
      },
      onEnd: () => {
        recognizerRef.current = null;
        setInterim("");
        settleAfterListening();
      },
    });

    if (!recognizer) {
      setError(
        "Browser voice input isn't supported here — switch Jarvis to the Whisper engine in its settings, or type instead."
      );
      settleAfterListening();
      return;
    }
    recognizerRef.current = recognizer;
    recognizer.start();
  }, [handleUtterance, settleAfterListening]);

  const startListening = useCallback(() => {
    stopAllSpeech();
    setError(null);
    setPanelOpen(true);
    setInterim("");
    setStatus("listening");
    if (settingsRef.current.sttEngine === "whisper") void startWhisperListening();
    else startBrowserListening();
  }, [startBrowserListening, startWhisperListening, stopAllSpeech]);

  const toggleListening = useCallback(() => {
    const current = statusRef.current;
    if (current === "listening") stopListening();
    else if (current === "thinking") return; // busy — ignore the press
    else startListening();
  }, [startListening, stopListening]);

  // ── Hands-free loop: persistent VAD → Whisper → agent ──────────────────────
  const stopHandsFree = useCallback(() => {
    handsFreeVadRef.current?.destroy();
    handsFreeVadRef.current = null;
    setHandsFreeActive(false);
  }, []);

  const startHandsFree = useCallback(async () => {
    if (handsFreeVadRef.current) return;
    try {
      await ensureWhisper();
      const vad = await createVad({
        onSpeechStart: () => {
          if (statusRef.current === "idle" || statusRef.current === "confirming") {
            setInterim("(hearing you…)");
          }
        },
        onSpeechEnd: (audio) => {
          // Drop segments while Jarvis is busy — they're usually its own audio
          // tail or the user talking to someone else mid-turn.
          if (statusRef.current !== "idle" && statusRef.current !== "confirming") return;
          setInterim("(transcribing…)");
          transcribeAudio(audio)
            .then((text) => {
              setInterim("");
              if (text) void handleUtterance(text);
            })
            .catch(() => setInterim(""));
        },
      });
      if (!settingsRef.current.handsFree) {
        vad.destroy();
        return;
      }
      handsFreeVadRef.current = vad;
      setHandsFreeActive(true);
    } catch (err) {
      setError(
        err instanceof Error ? `Hands-free couldn't start: ${err.message}` : "Hands-free couldn't start"
      );
      setVoiceSettings(saveVoiceSettings({ handsFree: false }));
    }
  }, [ensureWhisper, handleUtterance]);

  const updateVoiceSettings = useCallback(
    (changes: Partial<JarvisVoiceSettings>) => {
      const next = saveVoiceSettings(changes);
      setVoiceSettings(next);
      settingsRef.current = next;
      // Warm the models the user just opted into; tear down hands-free if disabled.
      if (next.sttEngine === "whisper") void ensureWhisper().catch(() => {});
      if (next.ttsEngine === "kokoro") void ensureKokoro().catch(() => {});
      if (next.handsFree) void startHandsFree();
      else stopHandsFree();
    },
    [ensureKokoro, ensureWhisper, startHandsFree, stopHandsFree]
  );

  // Resume hands-free on mount if it was enabled in a previous session.
  useEffect(() => {
    Promise.resolve().then(() => {
      if (getVoiceSettings().handsFree) void startHandsFree();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submitText = useCallback(
    (text: string) => {
      if (statusRef.current === "listening") stopListening();
      void handleUtterance(text);
    },
    [handleUtterance, stopListening]
  );

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
    interim,
    pending,
    error,
    speechSupported,
    ttsSupported: typeof window !== "undefined" ? isTtsSupported() : false,
    voiceSettings,
    updateVoiceSettings,
    whisperState,
    kokoroState,
    handsFreeActive,
    toggleListening,
    submitText,
    confirmPending: (approved: boolean) => void confirmPendingInternal(approved),
    clearConversation,
  };
}
