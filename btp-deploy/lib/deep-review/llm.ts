import type { LlmConfig, LlmProvider } from "../llm/types";
import { getLlmRequestOverride } from "../llm/config";

type ReviewLlmConfig = Partial<LlmConfig> & { provider: LlmProvider };

/**
 * Browser-side equivalent of the backend `ai_service.invoke_llm()` helper.
 * Sends a single user prompt to the shared `/api/llm/chat` route (which fills in
 * the server-side provider/key/model) and returns the raw text response.
 */
export async function invokeLlm(
  prompt: string,
  maxTokens = 4000,
  temperature = 0.1
): Promise<string> {
  const config = getLlmRequestOverride() as ReviewLlmConfig;

  const response = await fetch("/api/llm/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...config,
      messages: [{ role: "user", content: prompt }],
      temperature,
      maxTokens,
    }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(body.error || `LLM request failed (${response.status})`);
  }

  const body = (await response.json()) as { content?: string; error?: string };
  if (body.error) throw new Error(body.error);
  if (!body.content) throw new Error("LLM returned empty response");
  return body.content;
}

/** Strip ```json fences and surrounding whitespace from a model response. */
export function cleanJson(raw: string): string {
  let s = raw.trim();
  s = s.replace(/^```(?:json)?\s*/i, "");
  s = s.replace(/\s*```$/i, "");
  return s.trim();
}

export function getActiveProviderLabel(): string {
  const override = getLlmRequestOverride() as ReviewLlmConfig;
  return override.provider;
}
