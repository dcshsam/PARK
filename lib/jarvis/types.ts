// Jarvis text assistant — shared types.
//
// The agent loop is provider-agnostic: the LLM replies with a structured JSON
// object (tool_call | answer) instead of provider-native function calling, so
// the same code works with Claude, Kimi, and SAP AI Core.

export type JarvisStatus =
  | "idle"
  | "thinking"
  | "confirming";

export interface JarvisMessageRecord {
  id?: number;
  role: "user" | "assistant";
  content: string;
  /** Name of the tool whose confirmed execution produced this message, if any. */
  toolName?: string;
  createdAt: Date;
}

export interface ToolCall {
  tool: string;
  args: Record<string, unknown>;
}

export interface ToolResult {
  ok: boolean;
  /** Compact JSON-serializable payload fed back to the LLM. */
  data?: unknown;
  error?: string;
}

/** Context handed to tool executors — everything browser-side they may need. */
export interface ToolContext {
  /** Current route, e.g. "/proposals/abc-123". */
  pathname: string;
  /** Navigate the app (wraps next/navigation router.push). */
  navigate: (path: string) => void;
}

export interface ToolDefinition {
  name: string;
  description: string;
  /** Plain-language args description injected into the system prompt. */
  argsSchema: string;
  /** Mutating tools always require explicit user confirmation before running. */
  mutating: boolean;
  /** Short human-readable summary of what will happen, shown on the confirm card. */
  describeCall?: (args: Record<string, unknown>) => string;
  execute: (args: Record<string, unknown>, ctx: ToolContext) => Promise<ToolResult>;
}

/** Parsed LLM reply under the structured-JSON contract. */
export type LlmReply =
  | { type: "tool_call"; tool: string; args: Record<string, unknown> }
  | { type: "answer"; content: string };

/** Outcome of one agent turn, as seen by the UI state machine. */
export type TurnOutcome =
  | { kind: "answer"; content: string }
  | {
      kind: "confirm";
      toolCall: ToolCall;
      /** Human-readable description for the confirmation card. */
      description: string;
      /** Continue the turn: execute (approved) or cancel, then produce the final answer. */
      resume: (approved: boolean) => Promise<TurnOutcome>;
    };
