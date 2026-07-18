import {
  type LlmChatMessage,
  type LlmChatResponse,
  type LlmConfig,
  type LlmTestResult,
} from "./types";

// Default Claude model. Kept in sync with the Settings dropdown and env defaults.
// claude-haiku-4-5: current, 200K context, fast and cost-effective for document review.
const DEFAULT_CLAUDE_MODEL = "claude-haiku-4-5";

// Opus 4.7/4.8 and Fable 5 reject the `temperature` parameter with a 400.
// Everything else (Sonnet 4.6, Haiku 4.5, Opus 4.6 and older) accepts it.
function claudeSupportsTemperature(model: string): boolean {
  return !/^claude-(opus-4-[78]|fable-5|mythos-5)/.test(model);
}

export async function testLlmConnection(config: LlmConfig): Promise<LlmTestResult> {
  switch (config.provider) {
    case "claude":
      return testClaude(config.claude);
    case "kimi":
      return testKimi(config.kimi);
    case "sap-ai-core":
      return testSapAiCore(config.sapAiCore);
    default:
      return { ok: false, provider: config.provider, error: "Unknown provider" };
  }
}

export async function chatWithLlm(
  config: LlmConfig,
  messages: LlmChatMessage[],
  temperature = 0.7,
  maxTokens = 1024
): Promise<LlmChatResponse> {
  switch (config.provider) {
    case "claude":
      return chatClaude(config.claude, messages, temperature, maxTokens);
    case "kimi":
      return chatKimi(config.kimi, messages, temperature, maxTokens);
    case "sap-ai-core":
      return chatSapAiCore(config.sapAiCore, messages, temperature, maxTokens);
    default:
      throw new Error("Unknown provider");
  }
}

/**
 * Streaming variant of chatWithLlm: resolves to a stream of UTF-8 text deltas.
 * Streams assistant response text to the client as it is generated.
 * SAP AI Core deployments vary in SSE support, so that provider emits the
 * complete reply as a single chunk instead.
 */
export async function chatWithLlmStream(
  config: LlmConfig,
  messages: LlmChatMessage[],
  temperature = 0.7,
  maxTokens = 1024
): Promise<ReadableStream<Uint8Array>> {
  switch (config.provider) {
    case "claude":
      return chatClaudeStream(config.claude, messages, temperature, maxTokens);
    case "kimi":
      return chatKimiStream(config.kimi, messages, temperature, maxTokens);
    case "sap-ai-core": {
      const full = await chatSapAiCore(config.sapAiCore, messages, temperature, maxTokens);
      return new Response(full.content).body as ReadableStream<Uint8Array>;
    }
    default:
      throw new Error("Unknown provider");
  }
}

/** Re-emit an SSE body as plain text, keeping only the deltas `extract` finds. */
function sseTextStream(
  body: ReadableStream<Uint8Array>,
  extract: (event: Record<string, unknown>) => string | undefined
): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";
  return body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        buffer += decoder.decode(chunk, { stream: true });
        let newline: number;
        while ((newline = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, newline).trim();
          buffer = buffer.slice(newline + 1);
          if (!line.startsWith("data:")) continue;
          const data = line.slice(5).trim();
          if (data === "[DONE]") continue;
          try {
            const text = extract(JSON.parse(data) as Record<string, unknown>);
            if (text) controller.enqueue(encoder.encode(text));
          } catch {
            // keep-alive / partial lines — skip
          }
        }
      },
    })
  );
}

async function testClaude(config: LlmConfig["claude"]): Promise<LlmTestResult> {
  if (!config.apiKey) {
    return { ok: false, provider: "claude", error: "Anthropic API key is required" };
  }

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": config.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: config.model || DEFAULT_CLAUDE_MODEL,
        max_tokens: 1,
        messages: [{ role: "user", content: "Hi" }],
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return {
        ok: false,
        provider: "claude",
        error: body.error?.message ?? `Anthropic returned ${res.status}`,
      };
    }

    return { ok: true, provider: "claude" };
  } catch (err) {
    return {
      ok: false,
      provider: "claude",
      error: err instanceof Error ? err.message : "Connection failed",
    };
  }
}

async function requestClaude(
  config: LlmConfig["claude"],
  messages: LlmChatMessage[],
  temperature: number,
  maxTokens: number,
  stream: boolean
): Promise<Response> {
  if (!config.apiKey) throw new Error("Anthropic API key is required");

  const systemMessages = messages.filter((m) => m.role === "system");
  const nonSystemMessages = messages.filter((m) => m.role !== "system");

  const model = config.model || DEFAULT_CLAUDE_MODEL;
  const requestBody: Record<string, unknown> = {
    model,
    max_tokens: maxTokens,
    messages: nonSystemMessages.map((m) => ({ role: m.role, content: m.content })),
  };

  if (stream) {
    requestBody.stream = true;
  }

  if (claudeSupportsTemperature(model)) {
    requestBody.temperature = temperature;
  }

  if (systemMessages.length > 0) {
    requestBody.system = systemMessages.map((m) => m.content).join("\n\n");
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(requestBody),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error?.message ?? `Anthropic returned ${res.status}`);
  }

  return res;
}

async function chatClaude(
  config: LlmConfig["claude"],
  messages: LlmChatMessage[],
  temperature: number,
  maxTokens: number
): Promise<LlmChatResponse> {
  const res = await requestClaude(config, messages, temperature, maxTokens, false);
  const body = await res.json();
  return {
    content: body.content?.[0]?.text ?? "",
    usage: {
      inputTokens: body.usage?.input_tokens,
      outputTokens: body.usage?.output_tokens,
    },
  };
}

async function chatClaudeStream(
  config: LlmConfig["claude"],
  messages: LlmChatMessage[],
  temperature: number,
  maxTokens: number
): Promise<ReadableStream<Uint8Array>> {
  const res = await requestClaude(config, messages, temperature, maxTokens, true);
  if (!res.body) throw new Error("Anthropic returned no response body");
  return sseTextStream(res.body, (event) => {
    if (event.type !== "content_block_delta") return undefined;
    const delta = event.delta as { type?: string; text?: string } | undefined;
    return delta?.type === "text_delta" ? delta.text : undefined;
  });
}

const KIMI_CN_BASE_URL = "https://api.moonshot.cn/v1";
const KIMI_GLOBAL_BASE_URL = "https://api.moonshot.ai/v1";

async function testKimiEndpoint(
  config: LlmConfig["kimi"],
  baseUrl: string
): Promise<{ ok: boolean; status: number; error?: string }> {
  const res = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model || "moonshot-v1-8k",
      max_tokens: 1,
      messages: [{ role: "user", content: "Hi" }],
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    return { ok: false, status: res.status, error: body.error?.message ?? `Kimi returned ${res.status}` };
  }

  return { ok: true, status: res.status };
}

async function testKimi(config: LlmConfig["kimi"]): Promise<LlmTestResult> {
  const apiKey = config.apiKey?.trim();
  if (!apiKey) {
    return { ok: false, provider: "kimi", error: "Kimi API key is required" };
  }

  const configuredBaseUrl = (config.baseUrl || KIMI_CN_BASE_URL).replace(/\/$/, "");
  const alternateBaseUrl = configuredBaseUrl === KIMI_CN_BASE_URL ? KIMI_GLOBAL_BASE_URL : KIMI_CN_BASE_URL;

  try {
    const primary = await testKimiEndpoint({ ...config, apiKey }, configuredBaseUrl);
    if (primary.ok) {
      return { ok: true, provider: "kimi" };
    }

    // If primary failed with 401, try the alternate regional endpoint.
    if (primary.status === 401) {
      const alternate = await testKimiEndpoint({ ...config, apiKey }, alternateBaseUrl);
      if (alternate.ok) {
        return {
          ok: false,
          provider: "kimi",
          error: `Invalid Authentication against ${configuredBaseUrl}. Your key works on ${alternateBaseUrl}. Switch the Base URL to ${alternateBaseUrl} and try again.`,
        };
      }
      return {
        ok: false,
        provider: "kimi",
        error: `Invalid Authentication on both ${configuredBaseUrl} and ${alternateBaseUrl}. Your API key may be invalid, expired, or missing required credits.`,
      };
    }

    return { ok: false, provider: "kimi", error: primary.error ?? `Kimi returned ${primary.status}` };
  } catch (err) {
    return {
      ok: false,
      provider: "kimi",
      error: err instanceof Error ? err.message : "Connection failed",
    };
  }
}

async function requestKimi(
  config: LlmConfig["kimi"],
  messages: LlmChatMessage[],
  temperature: number,
  maxTokens: number,
  stream: boolean
): Promise<Response> {
  const apiKey = config.apiKey?.trim();
  if (!apiKey) throw new Error("Kimi API key is required");

  const baseUrl = (config.baseUrl || "https://api.moonshot.cn/v1").replace(/\/$/, "");
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: config.model || "moonshot-v1-8k",
      max_tokens: maxTokens,
      temperature,
      messages,
      ...(stream ? { stream: true } : {}),
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error?.message ?? `Kimi returned ${res.status}`);
  }

  return res;
}

async function chatKimi(
  config: LlmConfig["kimi"],
  messages: LlmChatMessage[],
  temperature: number,
  maxTokens: number
): Promise<LlmChatResponse> {
  const res = await requestKimi(config, messages, temperature, maxTokens, false);
  const body = await res.json();
  return {
    content: body.choices?.[0]?.message?.content ?? "",
    usage: {
      inputTokens: body.usage?.prompt_tokens,
      outputTokens: body.usage?.completion_tokens,
    },
  };
}

async function chatKimiStream(
  config: LlmConfig["kimi"],
  messages: LlmChatMessage[],
  temperature: number,
  maxTokens: number
): Promise<ReadableStream<Uint8Array>> {
  const res = await requestKimi(config, messages, temperature, maxTokens, true);
  if (!res.body) throw new Error("Kimi returned no response body");
  return sseTextStream(res.body, (event) => {
    const choices = event.choices as Array<{ delta?: { content?: string } }> | undefined;
    return choices?.[0]?.delta?.content ?? undefined;
  });
}

// OAuth tokens are valid for a while (expires_in) — cache per credential so a
// Jarvis turn doesn't pay a token round-trip on every single LLM call.
let sapTokenCache: { key: string; token: string; expiresAt: number } | null = null;

async function getSapAiCoreToken(config: LlmConfig["sapAiCore"]): Promise<string> {
  if (!config.authUrl || !config.clientId || !config.clientSecret) {
    throw new Error("SAP AI Core auth URL, client ID, and client secret are required");
  }

  const cacheKey = `${config.authUrl}|${config.clientId}`;
  if (sapTokenCache && sapTokenCache.key === cacheKey && Date.now() < sapTokenCache.expiresAt) {
    return sapTokenCache.token;
  }

  const params = new URLSearchParams();
  params.set("grant_type", "client_credentials");

  const res = await fetch(config.authUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64")}`,
    },
    body: params.toString(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`SAP AI Core token request failed (${res.status}): ${text}`);
  }

  const body = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!body.access_token) throw new Error("SAP AI Core token response missing access_token");
  // Refresh a minute early; fall back to 5 minutes if no expiry is given.
  const ttlMs = Math.max(((body.expires_in ?? 300) - 60) * 1000, 60_000);
  sapTokenCache = { key: cacheKey, token: body.access_token, expiresAt: Date.now() + ttlMs };
  return body.access_token;
}

async function testSapAiCore(config: LlmConfig["sapAiCore"]): Promise<LlmTestResult> {
  try {
    await getSapAiCoreToken(config);
    return { ok: true, provider: "sap-ai-core" };
  } catch (err) {
    return {
      ok: false,
      provider: "sap-ai-core",
      error: err instanceof Error ? err.message : "Connection failed",
    };
  }
}

async function chatSapAiCore(
  config: LlmConfig["sapAiCore"],
  messages: LlmChatMessage[],
  temperature: number,
  maxTokens: number
): Promise<LlmChatResponse> {
  if (!config.baseUrl || !config.deploymentId) {
    throw new Error("SAP AI Core base URL and deployment ID are required");
  }

  const token = await getSapAiCoreToken(config);

  const url = new URL(
    `/inference/deployments/${config.deploymentId}/chat/completions`,
    config.baseUrl.replace(/\/$/, "")
  );
  if (config.resourceGroup) {
    url.searchParams.set("resourceGroup", config.resourceGroup);
  }

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      model: config.model || undefined,
      max_tokens: maxTokens,
      temperature,
      messages,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`SAP AI Core inference failed (${res.status}): ${text}`);
  }

  const body = await res.json();
  return {
    content: body.choices?.[0]?.message?.content ?? "",
    usage: {
      inputTokens: body.usage?.prompt_tokens,
      outputTokens: body.usage?.completion_tokens,
    },
  };
}
