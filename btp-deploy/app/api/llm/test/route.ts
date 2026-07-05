import { NextRequest, NextResponse } from "next/server";
import { type LlmConfig } from "@/lib/llm/types";
import { testLlmConnection } from "@/lib/llm/service";
import { resolveRequestConfig } from "@/lib/llm/server-config";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Partial<LlmConfig>;
    // Fall back to the server env config per field (same as the chat route) so
    // the connection test reflects what the chat route will actually use.
    const config = resolveRequestConfig(body);

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
