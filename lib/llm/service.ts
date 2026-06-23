import {
  type LlmChatMessage,
  type LlmChatResponse,
  type LlmConfig,
  type LlmTestResult,
} from "./types";

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
        model: config.model || "claude-3-5-sonnet-20241022",
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

async function chatClaude(
  config: LlmConfig["claude"],
  messages: LlmChatMessage[],
  temperature: number,
  maxTokens: number
): Promise<LlmChatResponse> {
  if (!config.apiKey) throw new Error("Anthropic API key is required");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: config.model || "claude-3-5-sonnet-20241022",
      max_tokens: maxTokens,
      temperature,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error?.message ?? `Anthropic returned ${res.status}`);
  }

  const body = await res.json();
  return {
    content: body.content?.[0]?.text ?? "",
    usage: {
      inputTokens: body.usage?.input_tokens,
      outputTokens: body.usage?.output_tokens,
    },
  };
}

async function testKimi(config: LlmConfig["kimi"]): Promise<LlmTestResult> {
  if (!config.apiKey) {
    return { ok: false, provider: "kimi", error: "Kimi API key is required" };
  }

  try {
    const res = await fetch("https://api.moonshot.cn/v1/chat/completions", {
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
      return {
        ok: false,
        provider: "kimi",
        error: body.error?.message ?? `Kimi returned ${res.status}`,
      };
    }

    return { ok: true, provider: "kimi" };
  } catch (err) {
    return {
      ok: false,
      provider: "kimi",
      error: err instanceof Error ? err.message : "Connection failed",
    };
  }
}

async function chatKimi(
  config: LlmConfig["kimi"],
  messages: LlmChatMessage[],
  temperature: number,
  maxTokens: number
): Promise<LlmChatResponse> {
  if (!config.apiKey) throw new Error("Kimi API key is required");

  const res = await fetch("https://api.moonshot.cn/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model || "moonshot-v1-8k",
      max_tokens: maxTokens,
      temperature,
      messages,
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error?.message ?? `Kimi returned ${res.status}`);
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

async function getSapAiCoreToken(config: LlmConfig["sapAiCore"]): Promise<string> {
  if (!config.authUrl || !config.clientId || !config.clientSecret) {
    throw new Error("SAP AI Core auth URL, client ID, and client secret are required");
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

  const body = (await res.json()) as { access_token?: string };
  if (!body.access_token) throw new Error("SAP AI Core token response missing access_token");
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
