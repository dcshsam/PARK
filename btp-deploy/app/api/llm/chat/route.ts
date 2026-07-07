import { NextRequest, NextResponse } from "next/server";
import { type LlmChatRequest, type LlmConfig } from "@/lib/llm/types";
import { chatWithLlm, chatWithLlmStream } from "@/lib/llm/service";
import { resolveRequestConfig } from "@/lib/llm/server-config";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as LlmChatRequest & Partial<LlmConfig>;
    const config = resolveRequestConfig(body);

    if (body.stream) {
      // Plain-text delta stream so the voice agent can speak before the reply
      // finishes. Errors after this point surface as a truncated/empty stream.
      const stream = await chatWithLlmStream(
        config,
        body.messages ?? [],
        body.temperature,
        body.maxTokens
      );
      return new Response(stream, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          "X-Accel-Buffering": "no",
        },
      });
    }

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
