// Kokoro neural TTS web worker — Kokoro-82M (Apache-licensed weights) via
// kokoro-js, fully on-device. One-time free model download (~90 MB, q8),
// cached by the browser; speech synthesis is offline afterwards.

import { KokoroTTS } from "kokoro-js";

const MODEL_ID = "onnx-community/Kokoro-82M-v1.0-ONNX";

let tts: KokoroTTS | null = null;
let loading: Promise<KokoroTTS> | null = null;

interface ProgressEvent {
  status: string;
  progress?: number;
}

async function load(): Promise<KokoroTTS> {
  if (tts) return tts;
  if (!loading) {
    loading = KokoroTTS.from_pretrained(MODEL_ID, {
      dtype: "q8",
      device: "wasm", // q8+wasm is the reliable free path; webgpu needs fp32 (~330 MB)
      progress_callback: (p: ProgressEvent) => {
        if (p.status === "progress" && typeof p.progress === "number") {
          self.postMessage({ type: "progress", progress: Math.round(p.progress) });
        }
      },
    });
    loading.catch(() => {
      loading = null;
    });
  }
  tts = await loading;
  return tts;
}

// Newest generate request wins: a stale stream stops after its current
// sentence instead of synthesizing a reply nobody will hear.
let latestGenerate = 0;
// The wasm ONNX session can't run twice concurrently — serialize all work.
let queue: Promise<void> = Promise.resolve();

async function handle(event: MessageEvent): Promise<void> {
  const { type, id, text } = event.data as { type: string; id: number; text?: string };
  try {
    if (type === "load") {
      await load();
      self.postMessage({ type: "ready", id });
    } else if (type === "generate") {
      const model = await load();
      // Stream sentence-by-sentence so the main thread can start playback
      // after the first sentence instead of waiting for the whole reply.
      for await (const chunk of model.stream(text ?? "", { voice: "af_heart" })) {
        if (id !== latestGenerate) break; // superseded by a newer utterance
        const samples = chunk.audio.audio as Float32Array;
        self.postMessage(
          { type: "chunk", id, samples, samplingRate: chunk.audio.sampling_rate },
          { transfer: [samples.buffer] }
        );
      }
      self.postMessage({ type: "done", id });
    }
  } catch (err) {
    self.postMessage({
      type: "error",
      id,
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

self.onmessage = (event: MessageEvent) => {
  const { type, id } = event.data as { type: string; id: number };
  if (type === "generate") latestGenerate = id;
  queue = queue.then(() => handle(event));
};
