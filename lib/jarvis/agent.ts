"use client";

import type { LlmChatMessage } from "@/lib/llm/types";
import { getLlmRequestOverride } from "@/lib/llm/config";
import { buildSystemPrompt } from "./prompt";
import { getTool, executeTool } from "./tools";
import type { JarvisMessageRecord, LlmReply, ToolContext, TurnOutcome } from "./types";

const MAX_TOOL_ITERATIONS = 3;
const HISTORY_LIMIT = 10;

async function callLlm(messages: LlmChatMessage[]): Promise<string> {
  const config = getLlmRequestOverride();
  const response = await fetch("/api/llm/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...config, messages, temperature: 0.2, maxTokens: 1600, stream: true }),
  });

  const contentType = response.headers.get("content-type") ?? "";
  if (!response.ok || contentType.includes("application/json")) {
    const body = (await response.json().catch(() => ({}))) as { content?: string; error?: string };
    if (!response.ok || body.error) throw new Error(body.error || `LLM request failed (${response.status})`);
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
    full += decoder.decode(value, { stream: true });
  }
  full += decoder.decode();
  if (!full.trim()) throw new Error("LLM returned an empty response");
  return full;
}
function asArgs(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export function parseReply(raw: string): LlmReply {
  let text = raw.trim();
  text = text.replace(/^\`\`\`(?:json)?\s*/i, "").replace(/\s*\`\`\`$/i, "").trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");

  if (start !== -1 && end > start) {
    try {
      const parsed = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
      if (parsed.type === "tool_call" && typeof parsed.tool === "string") {
        return { type: "tool_call", tool: parsed.tool, args: asArgs(parsed.args) };
      }

      const toolName = [parsed.tool, parsed.name, parsed.type].find(
        (value): value is string => typeof value === "string" && getTool(value) !== undefined
      );
      if (toolName) {
        return { type: "tool_call", tool: toolName, args: asArgs(parsed.args ?? parsed.arguments) };
      }

      const content = [parsed.display, parsed.content, parsed.speech].find(
        (value): value is string => typeof value === "string" && value.trim().length > 0
      );
      if (parsed.type === "answer" && content) return { type: "answer", content };
      if (content) return { type: "answer", content };
    } catch {
      // Fall back to the raw text answer.
    }
  }
  return { type: "answer", content: text };
}

function toChatHistory(history: JarvisMessageRecord[]): LlmChatMessage[] {
  return history.slice(-HISTORY_LIMIT).map((message) => ({ role: message.role, content: message.content }));
}

export async function runAgentTurn(
  request: string,
  history: JarvisMessageRecord[],
  context: ToolContext
): Promise<TurnOutcome> {
  const messages: LlmChatMessage[] = [
    { role: "system", content: buildSystemPrompt(context.pathname) },
    ...toChatHistory(history),
    { role: "user", content: request },
  ];
  return continueTurn(messages, context, 0);
}

async function continueTurn(
  messages: LlmChatMessage[],
  context: ToolContext,
  iteration: number
): Promise<TurnOutcome> {
  const reply = parseReply(await callLlm(messages));
  if (reply.type === "answer") return { kind: "answer", content: reply.content };

  if (iteration >= MAX_TOOL_ITERATIONS) {
    return { kind: "answer", content: "I couldn't finish that within my tool budget. Try rephrasing the request." };
  }

  const tool = getTool(reply.tool);
  messages.push({ role: "assistant", content: JSON.stringify(reply) });
  if (!tool) {
    return feedToolResult(messages, context, iteration, { ok: false, error: `Unknown tool "${reply.tool}"` });
  }

  if (tool.mutating) {
    const description = tool.describeCall?.(reply.args) ?? `${tool.name} ${JSON.stringify(reply.args)}`;
    return {
      kind: "confirm",
      toolCall: { tool: tool.name, args: reply.args },
      description,
      resume: async (approved: boolean) => {
        if (!approved) {
          return feedToolResult(messages, context, iteration, {
            ok: false,
            error: "The user declined the action. Do not retry it; acknowledge the cancellation.",
          });
        }
        return feedToolResult(messages, context, iteration, await executeTool(tool, reply.args, context));
      },
    };
  }

  return feedToolResult(messages, context, iteration, await executeTool(tool, reply.args, context));
}

async function feedToolResult(
  messages: LlmChatMessage[],
  context: ToolContext,
  iteration: number,
  result: unknown
): Promise<TurnOutcome> {
  messages.push({ role: "user", content: `TOOL_RESULT: ${JSON.stringify(result)}` });
  if (iteration + 1 >= MAX_TOOL_ITERATIONS) {
    messages.push({
      role: "user",
      content: 'You have used all tool calls for this turn. Reply with a final {"type":"answer"} now.',
    });
  }
  return continueTurn(messages, context, iteration + 1);
}
