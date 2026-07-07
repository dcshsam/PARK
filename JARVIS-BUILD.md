# JARVIS for PARK — Implementation Spec for Claude Code

## Objective

Add a voice assistant ("Jarvis") to the existing PARK application (Next.js 16 + TypeScript + Tailwind v4 + Dexie/IndexedDB proposal review app). Jarvis lets the user speak commands, get spoken answers, query proposal/lead data, navigate the app, and perform actions with confirmation.

**Hard constraint: 100% free components only.** No paid APIs, no paid libraries, no new SaaS subscriptions. Voice uses browser-native Web APIs. LLM calls reuse the app's existing bring-your-own-LLM layer (`lib/llm/`), which already supports Claude, Kimi, and SAP AI Core — whichever the user has configured in Settings.

## Existing Architecture (do not rebuild — extend)

- `app/api/llm/chat/route.ts` — existing LLM chat endpoint. Reuse as the brain.
- `lib/llm/types.ts` — `LlmProvider = "claude" | "kimi" | "sap-ai-core"`, `LlmChatMessage`, `LlmChatRequest`.
- `lib/llm/service.ts`, `lib/llm/server-config.ts`, `lib/llm/use-llm-config.ts` — provider abstraction and config resolution. Do not modify provider logic.
- `lib/db.ts` — Dexie/IndexedDB data layer (proposals, leads, documents, comments, scores). **All data is client-side**, therefore the agent loop and all tools MUST execute in the browser.
- `components/layout/shell.tsx` — global layout. Mount point for the Jarvis UI.
- Next.js App Router pages: `/dashboard`, `/proposals`, `/proposals/[id]`, `/leads`, `/leads/[id]`, `/analytics`, `/settings`, `/team-activity`, `/rules`, `/profiles`.

## Core Design Decisions

1. **Client-side agent loop.** The LLM (via `/api/llm/chat`) only decides *what* to do; tools execute in the browser against Dexie and the Next.js router. Never attempt server-side data access — there is no server database.
2. **Provider-agnostic tool calling via structured JSON.** Do NOT use provider-native tool/function-calling APIs (they differ across Claude/Kimi/SAP AI Core and the existing `LlmChatRequest` doesn't support them). Instead, use a prompt-based pattern: the system prompt instructs the model to respond ONLY with a JSON object:
   ```json
   { "type": "tool_call", "tool": "<tool_name>", "args": { ... } }
   ```
   or
   ```json
   { "type": "answer", "speech": "<short spoken reply>", "display": "<optional longer text>" }
   ```
   Parse defensively (strip markdown fences, try/catch JSON.parse, fall back to treating raw text as `answer`). This is the free, portable approach. A future enhancement may add native tool use for the Claude provider only.
3. **Read → Navigate → Act, in that order of trust.** Read-only tools execute immediately. Navigation executes immediately. **Mutating tools always require explicit user confirmation** (spoken "yes"/"confirm" or clicking a Confirm button) before executing. Jarvis proposes, the human approves. No exceptions.
4. **Push-to-talk for v1.** No wake word. A mic button (and keyboard shortcut) starts/stops listening. Wake word is a later phase and out of scope for this build.
5. **Graceful degradation.** Web Speech API (`SpeechRecognition`) is only available in Chromium browsers. Feature-detect; if unavailable, fall back to a text input in the same Jarvis panel — everything else works identically.

## Free Component Stack

| Layer | Component | Cost |
|---|---|---|
| Speech-to-text | Web Speech API — `window.SpeechRecognition` / `webkitSpeechRecognition` | Free (browser) |
| Text-to-speech | Web Speech API — `window.speechSynthesis` | Free (browser) |
| LLM | Existing `/api/llm/chat` with user's configured provider | Already provisioned |
| Agent/tool layer | Custom TypeScript in this repo (spec below) | Free |
| UI | Existing Tailwind v4 + shadcn-style `components/ui/*` + Lucide icons | Free |
| Storage (conversation log) | Existing Dexie instance — add a `jarvisMessages` table | Free |

No new npm dependencies should be required. If one is genuinely unavoidable, it must be MIT/Apache-licensed and free.

## Files to Create

```
lib/jarvis/
  types.ts          # JarvisMessage, ToolDefinition, ToolCall, ToolResult, JarvisState
  tools.ts          # Tool registry: definitions + client-side executors
  agent.ts          # Agent loop: build prompt → call /api/llm/chat → parse → execute/confirm → respond
  prompt.ts         # System prompt builder (persona + tool catalog + JSON contract + current route/context)
  speech.ts         # STT/TTS wrappers around Web Speech API with feature detection
  use-jarvis.ts     # React hook orchestrating state machine: idle → listening → thinking → confirming → speaking

components/jarvis/
  jarvis-button.tsx  # Floating mic button (bottom-right), state-aware (pulse while listening)
  jarvis-panel.tsx   # Slide-up panel: live transcript, response text, confirm/cancel buttons, text fallback input
  jarvis-provider.tsx# Context provider mounted in shell.tsx; owns the hook instance
```

## Files to Modify (minimally)

- `components/layout/shell.tsx` — mount `<JarvisProvider>` + `<JarvisButton>` + `<JarvisPanel>`.
- `lib/db.ts` — add `jarvisMessages` table (id, role, content, toolCall?, timestamp) in a new Dexie version migration.
- `app/globals.css` — only if small animation keyframes are needed (mic pulse).
- Do NOT modify `lib/llm/service.ts` provider logic. The agent calls the existing `/api/llm/chat` endpoint as-is.

## Tool Registry (v1)

Each tool: `{ name, description, argsSchema (plain description for prompt), mutating: boolean, execute(args): Promise<ToolResult> }`.

### Read-only (auto-execute)
1. `get_proposal_stats` — counts by status (pending/approved/rejected/in-review) from Dexie.
2. `search_proposals` — args: `{ query?, status?, limit? }`. Search by title/customer.
3. `get_proposal_details` — args: `{ idOrTitle }`. Summary of one proposal incl. scores and latest comments.
4. `search_leads` — args: `{ query?, status?, sinceDays? }`.
5. `get_recent_activity` — latest N items from team-activity data.

### Navigation (auto-execute)
6. `navigate` — args: `{ page }` where page ∈ dashboard | proposals | leads | analytics | settings | team-activity | rules | profiles.
7. `open_proposal` / `open_lead` — args: `{ idOrTitle }`. Resolve via Dexie, then `router.push`.

### Mutating (ALWAYS confirm first)
8. `add_comment` — args: `{ proposalIdOrTitle, comment }`.
9. `set_proposal_action` — args: `{ proposalIdOrTitle, action }` action ∈ approve | reject | request-changes. Reuse the same logic paths as `proposal-action-modal.tsx` — do not duplicate business rules.
10. `create_lead_draft` — args: `{ name, company?, notes? }` → navigate to prefilled `/leads/new` rather than silently inserting.

Keep executors thin: import and reuse existing functions from `lib/db.ts`, `lib/workflow-engine.ts`, `lib/lead-events.ts` where they exist. If an action currently lives only inside a component, extract it to `lib/` first, then call it from both places.

## Agent Loop (lib/jarvis/agent.ts)

1. Compose messages: system prompt (persona + tool catalog + JSON contract + current pathname + today's date) + last ~10 messages from `jarvisMessages` + new user utterance.
2. POST to `/api/llm/chat` with the user's active provider config (via `use-llm-config`), `temperature: 0.2`, modest `maxTokens`.
3. Parse response JSON (defensive).
4. If `answer` → speak `speech` via TTS, show `display` in panel, persist message.
5. If `tool_call`:
   - Non-mutating → execute → feed result back to LLM as a follow-up message (`role: "user"`, content: `TOOL_RESULT: {...}`) → expect a final `answer` (max 3 tool iterations per turn, then force an answer).
   - Mutating → set state `confirming`, render args in panel ("Approve proposal 'Bentley S/4 Conversion'?"), await spoken yes/no or button click → execute or cancel → final spoken confirmation.
6. All errors surface honestly: speak a short failure message and show the error detail in the panel. Never pretend success.

## Speech Layer (lib/jarvis/speech.ts)

- STT: `lang: "en-IN"` default (make configurable later), `interimResults: true` for live transcript display, `continuous: false` (one utterance per press). Handle `no-speech`, `not-allowed` (mic permission) errors with clear panel messages.
- TTS: `speechSynthesis.speak` with a preferred English voice if available; expose `cancel()`; stop any ongoing speech when the mic is re-activated.
- Export `isSpeechRecognitionSupported()` / `isTtsSupported()` for the fallback text-input mode.

## UI/UX Requirements

- Floating circular mic button, bottom-right, above other content, keyboard shortcut `Ctrl+J` (and `Cmd+J`). States: idle (mic icon), listening (pulsing ring), thinking (spinner), speaking (waveform/animated icon), confirming (amber).
- Panel shows: live interim transcript while listening, conversation history (persisted), pending confirmation card with Confirm/Cancel, and a text input fallback (always visible — typing must work even when speech does).
- Respect the existing theme (ThemeProvider light/dark) and existing `components/ui/*` primitives (Button, Card, Badge, Dialog). Match PARK's visual language; no new design system.
- Panel must not block the underlying page; user can keep working while it's open.

## Build Order (implement in this sequence, verify each step compiles and works)

1. **Phase 1 — Voice round-trip:** speech.ts + jarvis-button + jarvis-panel + plain chat through `/api/llm/chat` (no tools). Speak a question, hear an answer.
2. **Phase 2 — Read tools:** tools 1–5 + agent loop with JSON contract + tool-result feedback iteration.
3. **Phase 3 — Navigation tools:** 6–7.
4. **Phase 4 — Mutating tools + confirmation flow:** 8–10 with the confirm state machine.
5. **Phase 5 — Persistence + polish:** jarvisMessages Dexie table, conversation history in panel, error states, keyboard shortcut, unsupported-browser fallback.

## Acceptance Criteria

- "How many proposals are pending review?" → spoken correct count from IndexedDB.
- "Open the <title> proposal" → navigates to that proposal's page.
- "Approve it" (context-aware from current page/conversation) → confirmation card → confirmed → status actually changes and is reflected in UI + spoken confirmation.
- Works with any of the three configured LLM providers without code changes.
- Firefox/Safari (no SpeechRecognition): text input path fully functional, TTS optional.
- `npm run build` passes with strict TypeScript; no new dependencies added (or justified in a comment if truly required).
- Zero regressions to existing pages and flows.

## Explicit Non-Goals (do not build now)

- Wake word detection, streaming/realtime voice, custom neural voices, provider-native function calling, server-side persistence, SAP OData connectivity (future phase), mobile app.
