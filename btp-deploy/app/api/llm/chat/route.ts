import { NextRequest, NextResponse } from "next/server";
import { type LlmChatRequest, type LlmConfig } from "@/lib/llm/types";
import { chatWithLlm } from "@/lib/llm/service";
import { resolveRequestConfig } from "@/lib/llm/server-config";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as LlmChatRequest & Partial<LlmConfig>;
    const config = resolveRequestConfig(body);

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
