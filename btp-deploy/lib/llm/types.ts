export type LlmProvider = "claude" | "kimi" | "sap-ai-core";

export type LlmConnectionStatus = "idle" | "checking" | "connected" | "disconnected";

export interface ClaudeConfig {
  apiKey: string;
  model: string;
}

export interface KimiConfig {
  apiKey: string;
  model: string;
  baseUrl: string;
}

export interface SapAiCoreConfig {
  authUrl: string;
  clientId: string;
  clientSecret: string;
  baseUrl: string;
  resourceGroup: string;
  deploymentId: string;
  model: string;
}

export interface LlmConfig {
  provider: LlmProvider;
  claude: ClaudeConfig;
  kimi: KimiConfig;
  sapAiCore: SapAiCoreConfig;
}

export interface LlmTestResult {
  ok: boolean;
  provider: LlmProvider;
  error?: string;
}

export interface LlmChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LlmChatRequest {
  provider: LlmProvider;
  messages: LlmChatMessage[];
  temperature?: number;
  maxTokens?: number;
  /** When true, /api/llm/chat responds with a plain-text stream of deltas instead of JSON. */
  stream?: boolean;
}

export interface LlmChatResponse {
  content: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
}

export const providerLabels: Record<LlmProvider, string> = {
  claude: "Claude",
  kimi: "Kimi",
  "sap-ai-core": "SAP AI Core",
};

export function isLlmProvider(value: string): value is LlmProvider {
  return ["claude", "kimi", "sap-ai-core"].includes(value);
}
