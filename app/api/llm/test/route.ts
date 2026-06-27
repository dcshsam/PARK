import { NextRequest, NextResponse } from "next/server";
import { type LlmConfig, isLlmProvider } from "@/lib/llm/types";
import { testLlmConnection } from "@/lib/llm/service";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Partial<LlmConfig>;

    const provider = body.provider && isLlmProvider(body.provider) ? body.provider : "claude";

    const config: LlmConfig = {
      provider,
      claude: {
        apiKey: body.claude?.apiKey ?? "",
        model: body.claude?.model ?? "claude-haiku-4-5",
      },
      kimi: {
        apiKey: body.kimi?.apiKey ?? "",
        model: body.kimi?.model ?? "moonshot-v1-8k",
        baseUrl: body.kimi?.baseUrl ?? "https://api.moonshot.cn/v1",
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

    const result = await testLlmConnection(config);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        provider: "claude",
        error: err instanceof Error ? err.message : "Unexpected error",
      },
      { status: 500 }
    );
  }
}
