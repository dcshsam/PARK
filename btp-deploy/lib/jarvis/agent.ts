"use client";

// Jarvis agent loop: build prompt → call /api/llm/chat → parse structured JSON
// → execute tools (or pause for confirmation on mutating ones) → final answer.
//
// The LLM only ever *decides*; all tool execution happens here in the browser
// against Dexie and the router, because the app's data is client-side only.

import type { LlmChatMessage } from "@/lib/llm/types";
import { getLlmRequestOverride } from "@/lib/llm/config";
import { buildSystemPrompt } from "./prompt";
import { getTool, executeTool } from "./tools";
import type { JarvisMessageRecord, LlmReply, ToolContext, TurnOutcome } from "./types";

const MAX_TOOL_ITERATIONS = 3;
const HISTORY_LIMIT = 10;

async function callLlm(
  messages: LlmChatMessage[],
  onDelta?: (text: string) => void
): Promise<string> {
  // Same pattern as lib/deep-review/llm.ts: send only the Settings override +
  // active provider; the server fills in its env credentials.
  const config = getLlmRequestOverride();
  const response = await fetch("/api/llm/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...config, messages, temperature: 0.2, maxTokens: 1600, stream: true }),
  });

  // Errors (and providers without SSE) come back as JSON; success streams text.
  const contentType = response.headers.get("content-type") ?? "";
  if (!response.ok || contentType.includes("application/json")) {
    const body = (await response.json().catch(() => ({}))) as { content?: string; error?: string };
    if (!response.ok || body.error) {
      throw new Error(body.error || `LLM request failed (${response.status})`);
    }
    if (!body.content) throw new Error("LLM returned an empty response");
    return body.content;
  }

  if (!response.body) throw new Error("LLM returned an empty response");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let full = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    const text = decoder.decode(value, { stream: true });
    full += text;
    onDelta?.(text);
  }
  full += decoder.decode();
  if (!full.trim()) throw new Error("LLM returned an empty response");
  return full;
}

/**
 * Watch streamed reply text and fire `onSpeech` once, as soon as the complete
 * "speech" string value has arrived — usually well before the (long) "display"
 * field and closing brace finish generating. Tool-call replies contain no
 * "speech" key, so the scanner simply never fires for them.
 */
export function createSpeechScanner(onSpeech: (speech: string) => void): (delta: string) => void {
  let text = "";
  let done = false;
  return (delta: string) => {
    if (done) return;
    text += delta;
    const key = text.indexOf('"speech"');
    if (key === -1) return;
    const colon = text.indexOf(":", key + 8);
    if (colon === -1) return;
    const open = text.indexOf('"', colon + 1);
    if (open === -1) return;
    if (text.slice(colon + 1, open).trim() !== "") {
      done = true; // value isn't a string — leave it to the normal parse
      return;
    }
    for (let i = open + 1; i < text.length; i++) {
      if (text[i] === "\\") {
        i++;
        continue;
      }
      if (text[i] === '"') {
        done = true;
        try {
          const speech = JSON.parse(text.slice(open, i + 1)) as string;
          if (speech.trim()) onSpeech(speech);
        } catch {
          // malformed escape — the full parse will handle it
        }
        return;
      }
    }
  };
}

function asArgs(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

/** Parse the model reply defensively: strip fences, find the JSON object, fall back to plain answer. */
export function parseReply(raw: string): LlmReply {
  let s = raw.trim();
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

  // Some models wrap the JSON in prose — extract the outermost object.
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start !== -1 && end > start) {
    try {
      const parsed = JSON.parse(s.slice(start, end + 1)) as Record<string, unknown>;

      // Exact contract shapes.
      if (parsed.type === "tool_call" && typeof parsed.tool === "string") {
        return { type: "tool_call", tool: parsed.tool, args: asArgs(parsed.args) };
      }
      if (parsed.type === "answer" && typeof parsed.speech === "string") {
        return {
          type: "answer",
          speech: parsed.speech,
          display: typeof parsed.display === "string" ? parsed.display : undefined,
        };
      }

      // Lenient variants weaker models emit: the tool name in "type"/"name"
      // (e.g. {"type":"get_proposal_stats","args":{}}), or no "type" at all.
      const toolName = [parsed.tool, parsed.name, parsed.type].find(
        (v): v is string => typeof v === "string" && getTool(v) !== undefined
      );
      if (toolName) {
        return { type: "tool_call", tool: toolName, args: asArgs(parsed.args ?? parsed.arguments) };
      }
      if (typeof parsed.speech === "string" || typeof parsed.display === "string") {
        const speech = typeof parsed.speech === "string" ? parsed.speech : "";
        const display = typeof parsed.display === "string" ? parsed.display : undefined;
        return { type: "answer", speech: speech || display || "", display };
      }
    } catch {
      // fall through to raw-text answer
    }
  }
  return { type: "answer", speech: s.slice(0, 300), display: s };
}

function toChatHistory(history: JarvisMessageRecord[]): LlmChatMessage[] {
  return history.slice(-HISTORY_LIMIT).map((m) => ({ role: m.role, content: m.content }));
}

/**
 * Run one conversational turn. Read-only and navigation tools execute
 * immediately; a mutating tool suspends the turn as a `confirm` outcome whose
 * `resume(approved)` continues it after the human decision.
 *
 * `onEarlySpeech` fires as soon as the streamed final answer's "speech" field
 * is complete, so TTS can start while the rest of the reply still generates.
 */
export async function runAgentTurn(
  utterance: string,
  history: JarvisMessageRecord[],
  ctx: ToolContext,
  onEarlySpeech?: (speech: string) => void
): Promise<TurnOutcome> {
  const messages: LlmChatMessage[] = [
    { role: "system", content: buildSystemPrompt(ctx.pathname) },
    ...toChatHistory(history),
    { role: "user", content: utterance },
  ];

  return continueTurn(messages, ctx, 0, onEarlySpeech);
}

async function continueTurn(
  messages: LlmChatMessage[],
  ctx: ToolContext,
  iteration: number,
  onEarlySpeech?: (speech: string) => void
): Promise<TurnOutcome> {
  const raw = await callLlm(messages, onEarlySpeech && createSpeechScanner(onEarlySpeech));
  const reply = parseReply(raw);

  if (reply.type === "answer") {
    return { kind: "answer", speech: reply.speech, display: reply.display };
  }

  if (iteration >= MAX_TOOL_ITERATIONS) {
    // The model ignored the forced-answer instruction — stop the loop honestly.
    return {
      kind: "answer",
      speech: "I couldn't finish that within my tool budget. Try rephrasing the request.",
      display: raw,
    };
  }

  const tool = getTool(reply.tool);
  messages.push({ role: "assistant", content: JSON.stringify(reply) });

  if (!tool) {
    return feedToolResult(
      messages,
      ctx,
      iteration,
      { ok: false, error: `Unknown tool "${reply.tool}"` },
      onEarlySpeech
    );
  }

  if (tool.mutating) {
    const description = tool.describeCall?.(reply.args) ?? `${tool.name} ${JSON.stringify(reply.args)}`;
    return {
      kind: "confirm",
      toolCall: { tool: tool.name, args: reply.args },
      description,
      resume: async (approved: boolean) => {
        if (!approved) {
          return feedToolResult(
            messages,
            ctx,
            iteration,
            {
              ok: false,
              error: "The user declined the action. Do not retry it; acknowledge the cancellation.",
            },
            onEarlySpeech
          );
        }
        const result = await executeTool(tool, reply.args, ctx);
        return feedToolResult(messages, ctx, iteration, result, onEarlySpeech);
      },
    };
  }

  const result = await executeTool(tool, reply.args, ctx);
  return feedToolResult(messages, ctx, iteration, result, onEarlySpeech);
}

async function feedToolResult(
  messages: LlmChatMessage[],
  ctx: ToolContext,
  iteration: number,
  result: unknown,
  onEarlySpeech?: (speech: string) => void
): Promise<TurnOutcome> {
  messages.push({ role: "user", content: `TOOL_RESULT: ${JSON.stringify(result)}` });
  if (iteration + 1 >= MAX_TOOL_ITERATIONS) {
    messages.push({
      role: "user",
      content: 'You have used all tool calls for this turn. Reply with a final {"type":"answer"} now.',
    });
  }
  return continueTurn(messages, ctx, iteration + 1, onEarlySpeech);
}
