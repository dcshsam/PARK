// Whisper STT web worker — runs OpenAI's Whisper (Apache-licensed weights)
// fully on-device via Transformers.js. Model is downloaded once from the
// Hugging Face CDN (free) and cached by the browser; transcription is offline.

import { pipeline, type AutomaticSpeechRecognitionPipeline } from "@huggingface/transformers";

// The Xenova conversions' quantized files load cleanly on the wasm backend;
// onnx-community/whisper-base's q4/q8 decoders hit a MatMulNBits QDQ bug there.
// tiny.en (English-only, ~40 MB) transcribes ~4x faster than base on wasm —
// the difference between a snappy and a sluggish hands-free turn. If accuracy
// on short commands ever disappoints, "Xenova/whisper-base.en" is the slower,
// more accurate drop-in.
const MODEL_ID = "Xenova/whisper-tiny.en";

let transcriber: AutomaticSpeechRecognitionPipeline | null = null;
let loading: Promise<AutomaticSpeechRecognitionPipeline> | null = null;

interface ProgressEvent {
  status: string;
  file?: string;
  progress?: number;
}

// Narrow pipeline's enormous overload union to the one call shape we use —
// otherwise tsc fails with "union type too complex to represent".
const asrPipeline = pipeline as unknown as (
  task: "automatic-speech-recognition",
  model: string,
  options?: {
    device?: "webgpu" | "wasm";
    dtype?: "q8" | "fp32";
    progress_callback?: (p: ProgressEvent) => void;
  }
) => Promise<AutomaticSpeechRecognitionPipeline>;

/**
 * `navigator.gpu` existing is not enough — headless/driver-less Chrome exposes
 * it but yields no adapter, and ONNX Runtime then fails with "no available
 * backend". Probe for a real adapter before committing to WebGPU.
 */
async function pickDevice(): Promise<"webgpu" | "wasm"> {
  try {
    const gpu = (navigator as { gpu?: { requestAdapter: () => Promise<unknown> } }).gpu;
    if (!gpu) return "wasm";
    const adapter = await gpu.requestAdapter();
    return adapter ? "webgpu" : "wasm";
  } catch {
    return "wasm";
  }
}

async function load(): Promise<AutomaticSpeechRecognitionPipeline> {
  if (transcriber) return transcriber;
  if (!loading) {
    const progress_callback = (p: ProgressEvent) => {
      if (p.status === "progress" && typeof p.progress === "number") {
        self.postMessage({ type: "progress", progress: Math.round(p.progress) });
      }
    };
    loading = (async () => {
      const device = await pickDevice();
      const attempts: { device: "webgpu" | "wasm"; dtype?: "q8" | "fp32" }[] =
        device === "webgpu"
          ? [{ device: "webgpu" }, { device: "wasm", dtype: "q8" }, { device: "wasm", dtype: "fp32" }]
          : [{ device: "wasm", dtype: "q8" }, { device: "wasm", dtype: "fp32" }];
      let lastError: unknown;
      for (const attempt of attempts) {
        try {
          return await asrPipeline("automatic-speech-recognition", MODEL_ID, {
            ...attempt,
            progress_callback,
          });
        } catch (err) {
          lastError = err;
        }
      }
      throw lastError;
    })();
    loading.catch(() => {
      loading = null;
    });
  }
  transcriber = await loading;
  return transcriber;
}

self.onmessage = async (event: MessageEvent) => {
  const { type, id, audio } = event.data as { type: string; id: number; audio?: Float32Array };
  try {
    if (type === "load") {
      await load();
      self.postMessage({ type: "ready", id });
    } else if (type === "transcribe") {
      const model = await load();
      // No language/task options: English-only (.en) checkpoints reject them.
      const output = await model(audio!);
      const text = Array.isArray(output) ? output.map((o) => o.text).join(" ") : output.text;
      self.postMessage({ type: "result", id, text: (text ?? "").trim() });
    }
  } catch (err) {
    self.postMessage({
      type: "error",
      id,
      message: err instanceof Error ? err.message : String(err),
    });
  }
};
