import {
  type LlmConfig,
  type LlmProvider,
  isLlmProvider,
} from "./types";

const STORAGE_KEY = "prop-review:llm-config";

export function getDefaultProvider(): LlmProvider {
  const env = process.env.NEXT_PUBLIC_DEFAULT_LLM_PROVIDER;
  if (env && isLlmProvider(env)) return env;
  return "claude";
}

export function getEnvLlmConfig(): LlmConfig {
  return {
    provider: getDefaultProvider(),
    claude: {
      apiKey: process.env.ANTHROPIC_API_KEY ?? "",
      model: process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5",
    },
    kimi: {
      apiKey: process.env.KIMI_API_KEY ?? "",
      model: process.env.KIMI_MODEL ?? "moonshot-v1-8k",
      baseUrl: process.env.KIMI_BASE_URL ?? "https://api.moonshot.cn/v1",
    },
    sapAiCore: {
      authUrl: process.env.SAP_AI_CORE_AUTH_URL ?? "",
      clientId: process.env.SAP_AI_CORE_CLIENT_ID ?? "",
      clientSecret: process.env.SAP_AI_CORE_CLIENT_SECRET ?? "",
      baseUrl: process.env.SAP_AI_CORE_BASE_URL ?? "",
      resourceGroup: process.env.SAP_AI_CORE_RESOURCE_GROUP ?? "default",
      deploymentId: process.env.SAP_AI_CORE_DEPLOYMENT_ID ?? "",
      model: process.env.SAP_AI_CORE_MODEL ?? "",
    },
  };
}

export function getStoredLlmConfig(): Partial<LlmConfig> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LlmConfig>;
    if (parsed.provider && !isLlmProvider(parsed.provider)) {
      parsed.provider = undefined;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveLlmConfigOverride(override: Partial<LlmConfig>): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(override));
}

export function clearLlmConfigOverride(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}

export function mergeLlmConfig(
  envConfig: LlmConfig,
  override: Partial<LlmConfig> | null
): LlmConfig {
  return {
    provider: override?.provider ?? envConfig.provider,
    claude: {
      ...envConfig.claude,
      ...override?.claude,
    },
    kimi: {
      ...envConfig.kimi,
      ...override?.kimi,
    },
    sapAiCore: {
      ...envConfig.sapAiCore,
      ...override?.sapAiCore,
    },
  };
}

export function getActiveLlmConfig(): LlmConfig {
  return mergeLlmConfig(getEnvLlmConfig(), getStoredLlmConfig());
}

export function hasLlmConfigOverride(): boolean {
  return getStoredLlmConfig() !== null;
}

export function getActiveProvider(): LlmProvider {
  const stored = getStoredLlmConfig();
  if (stored?.provider && isLlmProvider(stored.provider)) return stored.provider;
  return getDefaultProvider();
}

/**
 * Build the LLM config payload to send from the browser to the server API routes.
 *
 * The server holds the authoritative env config (real API keys, model, base URL).
 * The browser CANNOT read server-only env vars (KIMI_MODEL, KIMI_BASE_URL,
 * ANTHROPIC_API_KEY, etc. are not NEXT_PUBLIC_), so it must never send
 * env-derived fallback defaults — doing so would override the correct server
 * config with hardcoded placeholders (e.g. moonshot-v1-8k / empty key).
 *
 * Send ONLY the user's explicit Settings override (if any) plus the active
 * provider. When there is no override, the server uses its env config verbatim.
 */
export function getLlmRequestOverride(): Partial<LlmConfig> {
  const stored = getStoredLlmConfig();
  return { ...(stored ?? {}), provider: getActiveProvider() };
}
