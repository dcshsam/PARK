"use client";

// Main-thread client for the Kokoro TTS worker: the worker streams speech
// sentence-by-sentence and each chunk is scheduled gaplessly on the Web Audio
// clock here — playback starts after the first sentence instead of after the
// whole reply has been synthesized. Lazy-loaded: nothing downloads until the
// user picks the Kokoro voice in Jarvis settings.

import type { ModelStatus } from "./whisper";

interface PendingEntry {
  /** Called once per streamed audio chunk (generate requests only). */
  onChunk?: (samples: Float32Array, samplingRate: number) => void;
  /** Resolves on the worker's final "done"/"ready" message. */
  resolve: () => void;
  reject: (reason: Error) => void;
}

let worker: Worker | null = null;
let status: ModelStatus = "idle";
let nextId = 1;
const pending = new Map<number, PendingEntry>();
let progressListener: ((percent: number) => void) | null = null;

let audioContext: AudioContext | null = null;
const activeSources = new Set<AudioBufferSourceNode>();
/** Web Audio clock time where the next chunk should start (gapless queue). */
let playhead = 0;
/** Bumped by stopKokoro() so chunks from a cancelled utterance are dropped. */
let generation = 0;

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL("./kokoro.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (event: MessageEvent) => {
      const { type, id, samples, samplingRate, message, progress } = event.data as {
        type: string;
        id?: number;
        samples?: Float32Array;
        samplingRate?: number;
        message?: string;
        progress?: number;
      };
      if (type === "progress") {
        progressListener?.(progress ?? 0);
        return;
      }
      const entry = id !== undefined ? pending.get(id) : undefined;
      if (!entry) return;
      if (type === "chunk") {
        entry.onChunk?.(samples!, samplingRate!);
        return; // more messages follow for this id
      }
      pending.delete(id!);
      if (type === "error") entry.reject(new Error(message ?? "Kokoro worker error"));
      else entry.resolve();
    };
  }
  return worker;
}

function request(
  type: "load" | "generate",
  text?: string,
  onChunk?: PendingEntry["onChunk"]
): Promise<void> {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { onChunk, resolve, reject });
    getWorker().postMessage({ type, id, text });
  });
}

export function getKokoroStatus(): ModelStatus {
  return status;
}

export async function preloadKokoro(onProgress?: (percent: number) => void): Promise<void> {
  if (status === "ready") return;
  if (onProgress) progressListener = onProgress;
  status = "loading";
  try {
    await request("load");
    status = "ready";
  } catch (err) {
    status = "error";
    throw err;
  } finally {
    progressListener = null;
  }
}

/** Speak text with the Kokoro neural voice. Resolves when playback finishes. */
export async function speakKokoro(text: string): Promise<void> {
  if (!text.trim()) return;
  await preloadKokoro();

  stopKokoro();
  const gen = generation;
  if (!audioContext) audioContext = new AudioContext();
  if (audioContext.state === "suspended") await audioContext.resume().catch(() => {});
  playhead = audioContext.currentTime;

  const chunkEnded: Promise<void>[] = [];
  await request("generate", text, (samples, samplingRate) => {
    // A late chunk from an utterance that stopKokoro() already cancelled.
    if (gen !== generation || !audioContext) return;
    const buffer = audioContext.createBuffer(1, samples.length, samplingRate);
    buffer.copyToChannel(new Float32Array(samples), 0);
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContext.destination);
    activeSources.add(source);
    chunkEnded.push(
      new Promise<void>((resolve) => {
        source.onended = () => {
          activeSources.delete(source);
          resolve();
        };
      })
    );
    const startAt = Math.max(playhead, audioContext.currentTime);
    playhead = startAt + buffer.duration;
    source.start(startAt);
  });
  // Generation is done; wait for the tail of the audio to finish playing.
  // Stopped sources also fire onended, so cancellation resolves these too.
  await Promise.all(chunkEnded);
}

export function stopKokoro(): void {
  generation++;
  for (const source of activeSources) {
    try {
      source.stop();
    } catch {
      // already stopped
    }
  }
  activeSources.clear();
}
