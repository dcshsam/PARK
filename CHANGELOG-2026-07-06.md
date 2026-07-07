# Change Log — 2026-07-06

Jarvis voice assistant: initial build (per `JARVIS-BUILD.md`) plus the expanded skill set and free on-device voice stack.

---

## 1. Jarvis Voice Assistant — Core (JARVIS-BUILD.md phases 1–5)

**New files:**
- `lib/jarvis/types.ts` — shared types (messages, tools, state machine, turn outcomes).
- `lib/jarvis/speech.ts` — Web Speech API STT/TTS wrappers with feature detection.
- `lib/jarvis/prompt.ts` — system prompt: persona + tool catalog + strict JSON reply contract.
- `lib/jarvis/tools.ts` — client-side tool registry over Dexie + workflow engine.
- `lib/jarvis/agent.ts` — agent loop: prompt → `/api/llm/chat` → parse → execute/confirm → answer (max 3 tool iterations/turn).
- `lib/jarvis/use-jarvis.ts` — state machine hook: idle → listening → thinking → confirming → speaking.
- `components/jarvis/jarvis-provider.tsx` — context owner + global `Ctrl+J` / `Cmd+J` shortcut.
- `components/jarvis/jarvis-button.tsx` — floating state-aware mic button (bottom-right).
- `components/jarvis/jarvis-panel.tsx` — non-modal panel: history, live transcript, confirm card, text input.

**Modified:**
- `components/layout/shell.tsx` — mounts provider, button, panel.
- `lib/db.ts` — Dexie **v11** migration: `jarvisMessages` table + get/add/clear helpers; `getSearchableDocuments()`.
- `app/globals.css` — mic pulse/ring keyframes.
- `components/lead-form.tsx` — one-shot sessionStorage prefill consumed on `/leads/new` (used by `create_lead_draft`).

**Design:**
- Provider-agnostic tool calling: the model replies with a single JSON object (`tool_call` | `answer`) — works with Claude, Kimi, and SAP AI Core unchanged.
- All tools execute in the browser (data is IndexedDB-only).
- Mutating tools (`add_comment`, `set_proposal_action`, `create_lead_draft`, `run_ai_review`) always require Confirm/Cancel (or spoken yes/no).
- `set_proposal_action` reuses `applyWorkflowAction` — no duplicated business rules.

## 2. Expanded Skills (Agentforce-style standard actions)

**Files:** `lib/jarvis/tools.ts`, `lib/jarvis/prompt.ts`, `components/jarvis/jarvis-panel.tsx`

- `get_proposal_context` / `get_lead_details` — full record context for **summarize** and **draft email/comment** requests (drafts are grounded in real data, never invented).
- `search_proposals` — conditional list queries: `dueAfter`/`dueBefore`/`sortBy`.
- `ask_documents` — client-side document Q&A: chunks + keyword-scores `extractedText` across all (or one proposal's) documents, returns top passages.
- `get_analytics` — computed metrics: approval rate, average review cycle days, AI review scores, monthly volume, lead pipeline.
- `run_ai_review` — runs the existing deep-review engine (`runDeepReview` + `saveDeepReview`) on a proposal, then opens the report. Confirmed action.
- Page-aware quick-action chips in the panel (per-route suggested prompts).

## 3. Free On-Device Voice Stack (optional engines, browser defaults unchanged)

**New dependencies (all free licenses):** `@ricky0123/vad-web` (ISC), `@huggingface/transformers` **v3** (Apache-2.0 — v4 has a whisper/wasm session regression, and v3 matches kokoro-js's own dependency), `kokoro-js` (Apache-2.0).

**New files:**
- `lib/jarvis/voice-settings.ts` — per-browser engine settings (localStorage).
- `lib/jarvis/vad.ts` — Silero VAD v5 wrapper; assets served locally from `public/jarvis/` (no CDN).
- `lib/jarvis/whisper.worker.ts` + `whisper.ts` — Whisper STT (`Xenova/whisper-base`, q8) in a web worker with WebGPU→WASM→fp32 fallback cascade; the device is chosen by actually probing `requestAdapter()` (headless/driver-less Chrome exposes `navigator.gpu` without a usable adapter). On-device after a one-time ~80 MB cached download. Note: `onnx-community/whisper-base` fails wasm session creation (MatMulNBits QDQ bug) — keep the Xenova conversion.
- `lib/jarvis/kokoro.worker.ts` + `kokoro-tts.ts` — Kokoro-82M neural TTS in a web worker (q8/WASM, ~90 MB one-time), played via Web Audio.

**Behavior:**
- Panel gear icon → Voice settings: STT engine (Browser / Whisper), TTS engine (Browser / Kokoro), Hands-free toggle; shows model download progress.
- **Hands-free mode:** persistent VAD segments speech → Whisper transcribes → agent runs; mic is muted while Jarvis speaks; segments arriving while busy are dropped. Requires Whisper (enabling it switches STT automatically). Survives reloads.
- Whisper engine also fixes voice input on Firefox/Safari (no `SpeechRecognition` there).
- Kokoro failures fall back to the browser voice automatically.
- Wake word remains out of scope: openWakeWord's pretrained "hey jarvis" model is CC BY-NC (non-commercial) and needs a Python backend; Porcupine is commercial.

**Other:** `eslint.config.mjs` ignores `public/jarvis/**` (vendored runtime assets); `public/jarvis/` holds the VAD worklet, Silero models, and onnxruntime WASM copied from `node_modules`.

## Verification

- `npm run build` (strict TS) and `npm run lint` pass.
- Headless-Chrome CDP drives against the dev server verified: stats question answered from IndexedDB; navigation tool changes routes; confirm card gates `add_comment` and the comment persists; analytics chip answers; settings UI renders; Whisper and Kokoro workers boot and download models; hands-free VAD starts against a fake mic device.
- Real-microphone STT and audible TTS require a real browser session (not headless-testable).
