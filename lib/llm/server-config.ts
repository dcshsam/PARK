// Server-side LLM config resolution shared by the /api/llm/* proxy routes.
//
// The server env holds the authoritative provider credentials. Client requests
// may carry Settings-UI overrides (own key, model, base URL); each field falls
// back to the env value when absent.
//
// Set LLM_PROXY_ALLOW_CLIENT_CONFIG=false in production deployments to ignore
// client-supplied config entirely — otherwise anyone reaching the route could
// relay requests through arbitrary base URLs or burn the env API keys with
// models of their choosing.

import { type LlmConfig, isLlmProvider } from "./types";

export function getServerEnvConfig(): LlmConfig {
  return {
    provider: (process.env.NEXT_PUBLIC_DEFAULT_LLM_PROVIDER as LlmConfig["provider"]) || "claude",
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

function clientConfigAllowed(): boolean {
  return process.env.LLM_PROXY_ALLOW_CLIENT_CONFIG !== "false";
}

/** Merge a client request body over the server env config (client wins per field). */
export function resolveRequestConfig(body: Partial<LlmConfig>): LlmConfig {
  const envConfig = getServerEnvConfig();
  if (!clientConfigAllowed()) return envConfig;

  const provider =
    body.provider && isLlmProvider(body.provider) ? body.provider : envConfig.provider;

  return {
    provider,
    claude: {
      apiKey: body.claude?.apiKey || envConfig.claude.apiKey,
      model: body.claude?.model || envConfig.claude.model,
    },
    kimi: {
      apiKey: body.kimi?.apiKey || envConfig.kimi.apiKey,
      model: body.kimi?.model || envConfig.kimi.model,
      baseUrl: body.kimi?.baseUrl || envConfig.kimi.baseUrl,
    },
    sapAiCore: {
      authUrl: body.sapAiCore?.authUrl || envConfig.sapAiCore.authUrl,
      clientId: body.sapAiCore?.clientId || envConfig.sapAiCore.clientId,
      clientSecret: body.sapAiCore?.clientSecret || envConfig.sapAiCore.clientSecret,
      baseUrl: body.sapAiCore?.baseUrl || envConfig.sapAiCore.baseUrl,
      resourceGroup: body.sapAiCore?.resourceGroup || envConfig.sapAiCore.resourceGroup,
      deploymentId: body.sapAiCore?.deploymentId || envConfig.sapAiCore.deploymentId,
      model: body.sapAiCore?.model || envConfig.sapAiCore.model,
    },
  };
}
