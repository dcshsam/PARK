"use client";

// Main-thread client for the Whisper STT worker. Lazy: the worker (and its
// ~80 MB one-time model download) only spins up when the user enables the
// Whisper engine or hands-free mode.

export type ModelStatus = "idle" | "loading" | "ready" | "error";

let worker: Worker | null = null;
let status: ModelStatus = "idle";
let nextId = 1;
const pending = new Map<
  number,
  { resolve: (value: string) => void; reject: (reason: Error) => void }
>();
let progressListener: ((percent: number) => void) | null = null;

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL("./whisper.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (event: MessageEvent) => {
      const { type, id, text, message, progress } = event.data as {
        type: string;
        id?: number;
        text?: string;
        message?: string;
        progress?: number;
      };
      if (type === "progress") {
        progressListener?.(progress ?? 0);
        return;
      }
      const entry = id !== undefined ? pending.get(id) : undefined;
      if (!entry) return;
      pending.delete(id!);
      if (type === "error") entry.reject(new Error(message ?? "Whisper worker error"));
      else entry.resolve(text ?? "");
    };
  }
  return worker;
}

function request(type: "load" | "transcribe", audio?: Float32Array): Promise<string> {
  const id = nextId++;
  return new Promise<string>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    getWorker().postMessage({ type, id, audio });
  });
}

export function getWhisperStatus(): ModelStatus {
  return status;
}

/** Kick off the model download/initialization. Safe to call repeatedly. */
export async function preloadWhisper(onProgress?: (percent: number) => void): Promise<void> {
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

/** Transcribe a 16 kHz mono Float32Array (as produced by the VAD). */
export async function transcribeAudio(audio: Float32Array): Promise<string> {
  await preloadWhisper();
  return request("transcribe", audio);
}
