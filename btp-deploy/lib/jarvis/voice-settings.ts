"use client";

// Jarvis voice engine settings — persisted per browser in localStorage.
//
// "browser" engines are the zero-download Web Speech API defaults.
// "whisper" / "kokoro" run fully on-device (free, private, works offline)
// after a one-time model download that the browser caches.

export interface JarvisVoiceSettings {
  sttEngine: "browser" | "whisper";
  ttsEngine: "browser" | "kokoro";
  /** Hands-free mode: mic stays open, VAD segments speech. Requires Whisper STT. */
  handsFree: boolean;
}

const STORAGE_KEY = "jarvis:voice-settings";

export const DEFAULT_VOICE_SETTINGS: JarvisVoiceSettings = {
  sttEngine: "browser",
  ttsEngine: "browser",
  handsFree: false,
};

export function getVoiceSettings(): JarvisVoiceSettings {
  if (typeof window === "undefined") return DEFAULT_VOICE_SETTINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_VOICE_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<JarvisVoiceSettings>;
    const settings: JarvisVoiceSettings = {
      sttEngine: parsed.sttEngine === "whisper" ? "whisper" : "browser",
      ttsEngine: parsed.ttsEngine === "kokoro" ? "kokoro" : "browser",
      handsFree: parsed.handsFree === true,
    };
    // Hands-free needs Whisper (Web Speech API can't transcribe VAD audio buffers).
    if (settings.handsFree) settings.sttEngine = "whisper";
    return settings;
  } catch {
    return DEFAULT_VOICE_SETTINGS;
  }
}

export function saveVoiceSettings(changes: Partial<JarvisVoiceSettings>): JarvisVoiceSettings {
  const next = { ...getVoiceSettings(), ...changes };
  if (next.handsFree) next.sttEngine = "whisper";
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }
  return next;
}
