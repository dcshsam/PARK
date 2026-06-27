import { NextRequest, NextResponse } from "next/server";

interface ExtractRequest {
  base64: string;
  mimeType: string;
  name: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ExtractRequest;
    const { base64, mimeType, name } = body;

    if (!base64) {
      return NextResponse.json({ error: "No content provided" }, { status: 400 });
    }

    const buffer = Buffer.from(base64, "base64");
    let text = "";

    if (mimeType === "text/plain" || name.endsWith(".txt") || name.endsWith(".md")) {
      text = buffer.toString("utf-8");
    } else if (
      mimeType === "application/pdf" ||
      name.toLowerCase().endsWith(".pdf")
    ) {
      try {
        // Try structured Markdown conversion first.
        const pdf2mdModule = await import("@opendocsg/pdf2md");
        const pdf2md = (pdf2mdModule as unknown as { default: (buffer: Buffer) => Promise<string> }).default;
        text = (await pdf2md(buffer)) || "";
      } catch {
        // Fall back to plain text extraction if Markdown conversion fails.
        try {
          const pdfParseModule = await import("pdf-parse");
          const pdfParse = (pdfParseModule as unknown as { default: (buffer: Buffer) => Promise<{ text?: string }> }).default;
          const result = await pdfParse(buffer);
          text = result.text || "";
        } catch {
          return NextResponse.json(
            {
              error:
                "PDF parsing failed. Ensure 'pdf-parse' is installed or upload a plain text version.",
            },
            { status: 500 }
          );
        }
      }
    } else if (
      mimeType ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      name.toLowerCase().endsWith(".docx")
    ) {
      try {
        const mammoth = await import("mammoth");
        const result = await mammoth.extractRawText({ buffer });
        text = result.value || "";
      } catch {
        return NextResponse.json(
          {
            error:
              "DOCX parsing failed. Ensure 'mammoth' is installed or upload a plain text version.",
          },
          { status: 500 }
        );
      }
    } else {
      return NextResponse.json(
        { error: `Unsupported file type: ${mimeType}. Upload TXT, MD, PDF, or DOCX.` },
        { status: 400 }
      );
    }

    return NextResponse.json({ text: text.trim() });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unexpected error" },
      { status: 500 }
    );
  }
}
