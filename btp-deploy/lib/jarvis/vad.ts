"use client";

// Silero VAD (via @ricky0123/vad-web, ISC-licensed, on-device) — detects when
// the user starts/stops speaking and hands the 16 kHz audio segment to Whisper.
// All model/wasm assets are served locally from /public/jarvis (no CDN).

export interface VadHandle {
  pause: () => void;
  resume: () => void;
  destroy: () => void;
}

export interface VadCallbacks {
  onSpeechStart?: () => void;
  /** 16 kHz mono Float32Array of the utterance. */
  onSpeechEnd: (audio: Float32Array) => void;
  onMisfire?: () => void;
}

export async function createVad(callbacks: VadCallbacks): Promise<VadHandle> {
  const { MicVAD } = await import("@ricky0123/vad-web");
  const vad = await MicVAD.new({
    model: "v5",
    baseAssetPath: "/jarvis/",
    onnxWASMBasePath: "/jarvis/",
    startOnLoad: false,
    // Default is 1400 ms of silence before the utterance is considered over —
    // that's 1.4 s of dead air on every turn. 600 ms still tolerates natural
    // mid-sentence pauses but hands audio to Whisper much sooner.
    redemptionMs: 600,
    onSpeechStart: () => callbacks.onSpeechStart?.(),
    onSpeechEnd: (audio: Float32Array) => callbacks.onSpeechEnd(audio),
    onVADMisfire: () => callbacks.onMisfire?.(),
  });
  await vad.start();
  return {
    pause: () => void vad.pause(),
    resume: () => void vad.start(),
    destroy: () => void vad.destroy(),
  };
}
