"use client";

// Speech layer — thin wrappers around the free, browser-native Web Speech API.
// SpeechRecognition is Chromium-only; callers must feature-detect and fall
// back to the text input path when unsupported.

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface RecognizerCallbacks {
  onInterim?: (transcript: string) => void;
  onFinal: (transcript: string) => void;
  /** code is the SpeechRecognitionErrorEvent.error value, e.g. "no-speech". */
  onError?: (code: string, message: string) => void;
  onEnd?: () => void;
}

export interface Recognizer {
  start: () => void;
  /** Stop listening; a final result may still be delivered. */
  stop: () => void;
  /** Abort immediately; no further results. */
  abort: () => void;
}

function getRecognitionCtor(): (new () => any) | null {
  if (typeof window === "undefined") return null;
  const w = window as any;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isSpeechRecognitionSupported(): boolean {
  return getRecognitionCtor() !== null;
}

export function isTtsSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export const RECOGNITION_ERROR_MESSAGES: Record<string, string> = {
  "no-speech": "I didn't catch anything — try speaking again.",
  "not-allowed": "Microphone access is blocked. Allow the mic permission for this site and try again.",
  "audio-capture": "No microphone was found. Check your audio input device.",
  network: "Speech recognition needs a network connection and it seems unavailable.",
  aborted: "Listening cancelled.",
};

/**
 * One-utterance push-to-talk recognizer. Returns null when the browser has no
 * SpeechRecognition (Firefox/Safari) — use the text input fallback instead.
 */
export function createRecognizer(
  callbacks: RecognizerCallbacks,
  lang = "en-IN"
): Recognizer | null {
  const Ctor = getRecognitionCtor();
  if (!Ctor) return null;

  const recognition = new Ctor();
  recognition.lang = lang;
  recognition.interimResults = true;
  recognition.continuous = false;
  recognition.maxAlternatives = 1;

  recognition.onresult = (event: any) => {
    let interim = "";
    let final = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      if (result.isFinal) final += result[0].transcript;
      else interim += result[0].transcript;
    }
    if (final) callbacks.onFinal(final.trim());
    else if (interim) callbacks.onInterim?.(interim.trim());
  };

  recognition.onerror = (event: any) => {
    const code = event.error ?? "unknown";
    callbacks.onError?.(code, RECOGNITION_ERROR_MESSAGES[code] ?? `Speech recognition error: ${code}`);
  };

  recognition.onend = () => callbacks.onEnd?.();

  return {
    start: () => {
      try {
        recognition.start();
      } catch {
        // start() throws if already started — safe to ignore for push-to-talk.
      }
    },
    stop: () => recognition.stop(),
    abort: () => recognition.abort(),
  };
}

let preferredVoice: SpeechSynthesisVoice | null | undefined;

function pickVoice(): SpeechSynthesisVoice | null {
  if (preferredVoice !== undefined) return preferredVoice;
  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) return null; // not loaded yet — don't cache
  preferredVoice =
    voices.find((v) => v.lang === "en-IN") ??
    voices.find((v) => v.lang.startsWith("en") && v.default) ??
    voices.find((v) => v.lang.startsWith("en")) ??
    null;
  return preferredVoice;
}

/** Speak text aloud. Resolves when speech finishes (or immediately if TTS is unavailable). */
export function speak(text: string): Promise<void> {
  return new Promise((resolve) => {
    if (!isTtsSupported() || !text.trim()) {
      resolve();
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voice = pickVoice();
    if (voice) utterance.voice = voice;
    utterance.rate = 1.05;
    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
    window.speechSynthesis.speak(utterance);
  });
}

export function stopSpeaking(): void {
  if (isTtsSupported()) window.speechSynthesis.cancel();
}
