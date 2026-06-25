import { NextRequest, NextResponse } from "next/server";
import { type LlmChatRequest, type LlmConfig, isLlmProvider } from "@/lib/llm/types";
import { chatWithLlm } from "@/lib/llm/service";

function getServerEnvConfig(): LlmConfig {
  return {
    provider: (process.env.NEXT_PUBLIC_DEFAULT_LLM_PROVIDER as LlmConfig["provider"]) || "claude",
    claude: {
      apiKey: process.env.ANTHROPIC_API_KEY ?? "",
      model: process.env.ANTHROPIC_MODEL ?? "claude-3-5-sonnet-20241022",
    },
    kimi: {
      apiKey: process.env.KIMI_API_KEY ?? "",
      model: process.env.KIMI_MODEL ?? "moonshot-v1-8k",
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

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as LlmChatRequest & Partial<LlmConfig>;
    const envConfig = getServerEnvConfig();

    const provider =
      body.provider && isLlmProvider(body.provider) ? body.provider : envConfig.provider;

    const config: LlmConfig = {
      provider,
      claude: {
        apiKey: body.claude?.apiKey || envConfig.claude.apiKey,
        model: body.claude?.model || envConfig.claude.model,
      },
      kimi: {
        apiKey: body.kimi?.apiKey || envConfig.kimi.apiKey,
        model: body.kimi?.model || envConfig.kimi.model,
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

    const response = await chatWithLlm(
      config,
      body.messages ?? [],
      body.temperature,
      body.maxTokens
    );

    return NextResponse.json(response);
  } catch (err) {
    return NextResponse.json(
      {
        content: "",
        error: err instanceof Error ? err.message : "Unexpected error",
      },
      { status: 500 }
    );
  }
}
