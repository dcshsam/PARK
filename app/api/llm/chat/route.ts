import { NextRequest, NextResponse } from "next/server";
import { type LlmChatRequest, type LlmConfig, isLlmProvider } from "@/lib/llm/types";
import { chatWithLlm } from "@/lib/llm/service";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as LlmChatRequest & Partial<LlmConfig>;

    const provider =
      body.provider && isLlmProvider(body.provider) ? body.provider : "claude";

    const config: LlmConfig = {
      provider,
      claude: {
        apiKey: body.claude?.apiKey ?? "",
        model: body.claude?.model ?? "claude-3-5-sonnet-20241022",
      },
      kimi: {
        apiKey: body.kimi?.apiKey ?? "",
        model: body.kimi?.model ?? "moonshot-v1-8k",
      },
      sapAiCore: {
        authUrl: body.sapAiCore?.authUrl ?? "",
        clientId: body.sapAiCore?.clientId ?? "",
        clientSecret: body.sapAiCore?.clientSecret ?? "",
        baseUrl: body.sapAiCore?.baseUrl ?? "",
        resourceGroup: body.sapAiCore?.resourceGroup ?? "default",
        deploymentId: body.sapAiCore?.deploymentId ?? "",
        model: body.sapAiCore?.model ?? "",
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
