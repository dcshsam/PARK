// Client-side helpers for the Event 4 "AI Generated Proposal" feature:
// consolidate the lead's Event 1-3 data into a brief, ask the connected LLM
// (Kimi / Claude / SAP AI Core — whichever is active in Settings) for the
// slide content as JSON, and render a real .pptx locally with pptxgenjs.

import pptxgen from "pptxgenjs";
import { invokeLlm, cleanJson } from "@/lib/deep-review/llm";
import { SECTIONS } from "@/lib/deep-review/sections";
import type { DeepRule } from "@/lib/deep-review/builtin-rules";
import { getActiveDeepRules } from "@/lib/db";

interface BriefDocument {
  name: string;
  category: string;
  extractedText?: string;
}

interface DueDiligenceBriefItem {
  type: string;
  title: string;
  startDate?: string;
  endDate?: string;
  status?: string;
  conductedBy?: string;
  summary?: string;
}

export interface ProposalBriefInput {
  leadName: string;
  clientName: string;
  kytesId?: string;
  vertical?: string;
  leadType?: string;
  gtmName?: string;
  requirementSummary?: string;
  documents: BriefDocument[];
  preQualified?: string;
  preQualComments?: string;
  dueDiligenceItems: DueDiligenceBriefItem[];
  proposalStartDate?: string;
  proposalEndDate?: string;
}

// Keep the brief compact so it fits smaller-context models (e.g. moonshot-v1-8k).
const DOC_TEXT_LIMIT = 1500;
const BRIEF_TOTAL_LIMIT = 7000;

/** Build the consolidated Events 1-3 brief the model turns into a proposal deck. */
export function buildProposalBrief(input: ProposalBriefInput): string {
  const lines: string[] = [];

  lines.push("# Event 1 — Lead Initiation");
  lines.push(`Lead: ${input.leadName || "(unnamed)"}`);
  lines.push(`Customer / Client: ${input.clientName || "(unknown)"}`);
  if (input.kytesId) lines.push(`Kytes ID: ${input.kytesId}`);
  if (input.vertical) lines.push(`Vertical: ${input.vertical}`);
  if (input.leadType) lines.push(`Lead Type: ${input.leadType}`);
  if (input.gtmName) lines.push(`GTM Owner: ${input.gtmName}`);
  if (input.requirementSummary) {
    lines.push("", "## Requirement Summary", input.requirementSummary);
  }

  const docsWithText = input.documents.filter((d) => d.extractedText?.trim());
  if (docsWithText.length > 0) {
    lines.push("", "## Customer Documents (extracted text)");
    for (const doc of docsWithText) {
      const text = doc.extractedText!.trim();
      lines.push(
        `### ${doc.name} (${doc.category})`,
        text.length > DOC_TEXT_LIMIT ? `${text.slice(0, DOC_TEXT_LIMIT)}\n[...truncated]` : text
      );
    }
  }

  lines.push("", "# Event 2 — Pre-Qualification");
  lines.push(`Outcome: ${input.preQualified || "not recorded"}`);
  if (input.preQualComments) lines.push(`Comments: ${input.preQualComments}`);

  lines.push("", "# Event 3 — Due Diligence");
  if (input.dueDiligenceItems.length === 0) {
    lines.push("No due diligence entries recorded.");
  } else {
    for (const item of input.dueDiligenceItems) {
      const dates = [item.startDate, item.endDate].filter(Boolean).join(" to ");
      lines.push(
        `- [${item.type}] ${item.title}${dates ? ` (${dates})` : ""}${item.conductedBy ? ` — by ${item.conductedBy}` : ""}${item.summary ? `: ${item.summary}` : ""}`
      );
    }
  }

  if (input.proposalStartDate || input.proposalEndDate) {
    lines.push(
      "",
      `# Proposal Timeline: ${[input.proposalStartDate, input.proposalEndDate].filter(Boolean).join(" to ")}`
    );
  }

  const brief = lines.join("\n");
  return brief.length > BRIEF_TOTAL_LIMIT
    ? `${brief.slice(0, BRIEF_TOTAL_LIMIT)}\n[...brief truncated]`
    : brief;
}

interface DeckBullet {
  head: string;
  text: string;
}

interface DeckSlide {
  title: string;
  takeaway?: string;
  bullets: DeckBullet[];
}

interface DeckSpec {
  title: string;
  subtitle?: string;
  slides: DeckSlide[];
}

/**
 * The mandatory deck structure comes from the review sections in
 * lib/deep-review/sections.ts — one slide per content section, each written to
 * satisfy that section's review criteria. ("Presentation Quality" has no
 * keywords and is a formatting rule, not a content section — skipped.)
 */
function buildSectionStructure(): string {
  return SECTIONS.filter((s) => s.keywords.length > 0)
    .map(
      (s, i) =>
        `${i + 1}. "${s.name}" — the slide content must satisfy: ${s.criteria.join("; ")}.`
    )
    .join("\n");
}

/** Translate the active review rules (built-in + custom) into deck constraints. */
function buildRuleGuidance(rules: DeepRule[]): string {
  const lines: string[] = [];
  for (const rule of rules) {
    const keywords = (rule.config?.keywords as string[] | undefined) ?? [];
    switch (rule.rule_type) {
      case "section_required":
        lines.push(`- A section covering "${keywords.join(", ") || rule.name}" is mandatory.`);
        break;
      case "keyword_presence":
        lines.push(`- ${rule.name}: the deck must address ${keywords.join(", ")}.`);
        break;
      case "keyword_absence":
        lines.push(`- Never use placeholder/disallowed text such as: ${keywords.join(", ")}.`);
        break;
      case "min_word_count":
        lines.push("- Every slide must carry substantive content — no thin or filler slides.");
        break;
      case "custom_prompt": {
        const prompt = (rule.config?.prompt as string | undefined)?.trim();
        if (prompt) lines.push(`- ${rule.name}: ${prompt}`);
        break;
      }
    }
  }
  return lines.join("\n");
}

function buildDeckPrompt(brief: string, clientName: string, rules: DeepRule[]): string {
  const ruleGuidance = buildRuleGuidance(rules);
  return [
    `You are preparing a professional customer proposal presentation for ${clientName || "the customer"}.`,
    "Consolidate all the customer expectations and findings from the lead intake information below (Lead Initiation, Pre-Qualification, Due Diligence) into a coherent proposal deck.",
    "",
    "Respond with ONLY valid JSON — no markdown fences, no commentary — in exactly this shape:",
    '{"title": "deck title", "subtitle": "one-line subtitle", "slides": [{"title": "slide title", "takeaway": "one-sentence key message for this slide", "bullets": [{"head": "3-5 word headline", "text": "one concise supporting sentence"}]}]}',
    "",
    "MANDATORY STRUCTURE — this proposal will be graded by a quality review against these exact sections. Create one slide per section, in this order, with the slide title containing the section name verbatim:",
    buildSectionStructure(),
    "You may add at most 2 extra slides (e.g. \"Understanding Your Requirements\", \"Next Steps\") where they strengthen the story.",
    "",
    "Additional requirements:",
    "- Each slide has 3-5 bullets. Every bullet has a punchy 3-5 word `head` and a `text` of one concise sentence (max ~20 words).",
    "- Every slide has a `takeaway`: the single most persuasive message of that slide, phrased for the customer.",
    "- Ground every statement strictly in the information provided; do not invent client-specific facts.",
    "- Where the intake has no pricing figures, describe the pricing model and what the detailed commercial breakdown will include — never invent amounts.",
    ...(ruleGuidance ? ["", "Review rules the deck must satisfy:", ruleGuidance] : []),
    "",
    "--- LEAD INTAKE INFORMATION ---",
    brief,
  ].join("\n");
}

function parseDeckSpec(raw: string): DeckSpec {
  let text = cleanJson(raw);
  // Some models wrap JSON in prose — fall back to the outermost braces.
  if (!text.startsWith("{")) {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end <= start) throw new Error("The model did not return valid JSON.");
    text = text.slice(start, end + 1);
  }
  const spec = JSON.parse(text) as DeckSpec;
  if (!spec.title || !Array.isArray(spec.slides) || spec.slides.length === 0) {
    throw new Error("The model returned an incomplete slide structure.");
  }
  // Normalize bullets — accept both {head, text} objects and plain strings.
  spec.slides = spec.slides
    .filter((s) => s && s.title)
    .map((s) => ({
      title: String(s.title),
      takeaway: s.takeaway ? String(s.takeaway) : undefined,
      bullets: (s.bullets ?? []).map((b) => {
        if (typeof b === "string") return { head: "", text: b };
        const bullet = b as Partial<DeckBullet>;
        return { head: String(bullet.head ?? ""), text: String(bullet.text ?? "") };
      }),
    }));
  return spec;
}

const NAVY = "1F3864";
const NAVY_DARK = "16294A";
const GOLD = "E8A33D";
const INK = "2B2B2B";
const SLATE = "5A6472";
const MUTED = "8C97A6";
const PANEL = "F2F5F9";
const FONT = "Segoe UI";

/** Render the deck spec to a real PowerPoint file in the browser. */
async function renderDeck(spec: DeckSpec, clientName: string): Promise<Blob> {
  const pptx = new pptxgen();
  pptx.layout = "LAYOUT_WIDE"; // 13.33 x 7.5 in
  pptx.author = "PARK Proposal App";
  pptx.title = spec.title;
  const client = clientName || "our customer";
  const dateLabel = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Shared master for content slides: brand chip, footer, page number.
  pptx.defineSlideMaster({
    title: "CONTENT",
    background: { color: "FFFFFF" },
    objects: [
      { rect: { x: 0, y: 0, w: 0.22, h: 7.5, fill: { color: NAVY } } },
      { rect: { x: 0.22, y: 0, w: 0.06, h: 7.5, fill: { color: GOLD } } },
      {
        text: {
          text: `${client}  ·  Proposal  ·  ${dateLabel}`,
          options: { x: 0.6, y: 7.08, w: 9, h: 0.3, fontFace: FONT, fontSize: 9, color: MUTED },
        },
      },
    ],
    slideNumber: { x: 12.7, y: 7.08, fontFace: FONT, fontSize: 9, color: MUTED },
  });

  // ── Title slide ──────────────────────────────────────────────────────────
  const title = pptx.addSlide();
  title.background = { color: NAVY };
  // Layered panel + decorative circles give the flat background depth.
  title.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: 13.33, h: 7.5, fill: { color: NAVY_DARK, transparency: 55 },
  });
  title.addShape(pptx.ShapeType.ellipse, {
    x: 10.1, y: -1.6, w: 4.8, h: 4.8, fill: { color: "FFFFFF", transparency: 92 },
  });
  title.addShape(pptx.ShapeType.ellipse, {
    x: 11.3, y: 4.9, w: 3.6, h: 3.6, fill: { color: GOLD, transparency: 86 },
  });
  title.addShape(pptx.ShapeType.rect, {
    x: 0.85, y: 2.05, w: 1.5, h: 0.12, fill: { color: GOLD },
  });
  title.addText("PROPOSAL", {
    x: 0.85, y: 1.35, w: 6, h: 0.5,
    fontFace: FONT, fontSize: 14, bold: true, color: GOLD, charSpacing: 6,
  });
  title.addText(spec.title, {
    x: 0.85, y: 2.35, w: 11.2, h: 1.9,
    fontFace: FONT, fontSize: 40, bold: true, color: "FFFFFF", lineSpacing: 46,
  });
  title.addText(spec.subtitle || `A partnership proposal for ${client}`, {
    x: 0.85, y: 4.35, w: 10.5, h: 0.6,
    fontFace: FONT, fontSize: 18, color: "D7DEE8",
  });
  title.addText(`Prepared for ${client}   ·   ${dateLabel}`, {
    x: 0.85, y: 6.55, w: 10.5, h: 0.4,
    fontFace: FONT, fontSize: 12, color: "9FB0C7",
  });

  // ── Agenda slide ─────────────────────────────────────────────────────────
  const agenda = pptx.addSlide({ masterName: "CONTENT" });
  agenda.addText("Agenda", {
    x: 0.7, y: 0.55, w: 8, h: 0.7, fontFace: FONT, fontSize: 30, bold: true, color: NAVY,
  });
  agenda.addShape(pptx.ShapeType.rect, {
    x: 0.72, y: 1.32, w: 1.1, h: 0.09, fill: { color: GOLD },
  });
  const perColumn = Math.ceil(spec.slides.length / 2);
  spec.slides.forEach((slideSpec, index) => {
    const column = Math.floor(index / perColumn);
    const row = index % perColumn;
    const x = 0.9 + column * 6.2;
    const y = 1.9 + row * 1.05;
    agenda.addText(String(index + 1).padStart(2, "0"), {
      x, y, w: 0.75, h: 0.6, fontFace: FONT, fontSize: 22, bold: true, color: GOLD,
    });
    agenda.addText(slideSpec.title, {
      x: x + 0.85, y: y + 0.03, w: 5.1, h: 0.6,
      fontFace: FONT, fontSize: 15, bold: true, color: INK, valign: "middle",
    });
  });

  // ── Content slides ───────────────────────────────────────────────────────
  for (const slideSpec of spec.slides) {
    const slide = pptx.addSlide({ masterName: "CONTENT" });
    const hasTakeaway = Boolean(slideSpec.takeaway);
    const bodyWidth = hasTakeaway ? 8.1 : 11.9;

    slide.addText(slideSpec.title, {
      x: 0.7, y: 0.5, w: 11.9, h: 0.7,
      fontFace: FONT, fontSize: 27, bold: true, color: NAVY,
    });
    slide.addShape(pptx.ShapeType.rect, {
      x: 0.72, y: 1.25, w: 1.1, h: 0.09, fill: { color: GOLD },
    });

    if (slideSpec.bullets.length > 0) {
      const runs: { text: string; options: Record<string, unknown> }[] = [];
      for (const bullet of slideSpec.bullets) {
        if (bullet.head) {
          runs.push({
            text: bullet.head,
            options: {
              bold: true,
              color: NAVY,
              bullet: { code: "25AA", color: GOLD, indent: 14 },
            },
          });
          runs.push({
            text: ` — ${bullet.text}`,
            options: { color: SLATE, breakLine: true },
          });
        } else {
          runs.push({
            text: bullet.text,
            options: {
              color: SLATE,
              bullet: { code: "25AA", color: GOLD, indent: 14 },
              breakLine: true,
            },
          });
        }
      }
      slide.addText(runs, {
        x: 0.75, y: 1.7, w: bodyWidth, h: 5.1,
        fontFace: FONT, fontSize: 15, valign: "top", paraSpaceAfter: 14, lineSpacing: 22,
      });
    }

    if (hasTakeaway) {
      slide.addShape(pptx.ShapeType.roundRect, {
        x: 9.15, y: 1.7, w: 3.55, h: 3.6, rectRadius: 0.09,
        fill: { color: PANEL }, line: { color: "DFE6EF", width: 1 },
      });
      slide.addShape(pptx.ShapeType.rect, {
        x: 9.15, y: 1.7, w: 0.09, h: 3.6, fill: { color: GOLD },
      });
      slide.addText("KEY TAKEAWAY", {
        x: 9.45, y: 1.95, w: 3.1, h: 0.35,
        fontFace: FONT, fontSize: 10.5, bold: true, color: GOLD, charSpacing: 3,
      });
      slide.addText(slideSpec.takeaway!, {
        x: 9.45, y: 2.35, w: 3.05, h: 2.8,
        fontFace: FONT, fontSize: 14.5, bold: true, color: NAVY, valign: "top", lineSpacing: 20,
      });
    }
  }

  // ── Closing slide ────────────────────────────────────────────────────────
  const closing = pptx.addSlide();
  closing.background = { color: NAVY };
  closing.addShape(pptx.ShapeType.ellipse, {
    x: -1.8, y: 4.4, w: 5.2, h: 5.2, fill: { color: GOLD, transparency: 88 },
  });
  closing.addShape(pptx.ShapeType.rect, {
    x: 0.85, y: 2.9, w: 1.5, h: 0.12, fill: { color: GOLD },
  });
  closing.addText("Thank You", {
    x: 0.85, y: 3.15, w: 11.5, h: 1.2, fontFace: FONT, fontSize: 44, bold: true, color: "FFFFFF",
  });
  closing.addText(
    `We look forward to partnering with ${client} on this journey.`,
    { x: 0.85, y: 4.5, w: 10.5, h: 0.6, fontFace: FONT, fontSize: 16, color: "D7DEE8" }
  );

  return (await pptx.write({ outputType: "blob" })) as Blob;
}

export interface GeneratedDeck {
  blob: Blob;
  base64: string;
  slideCount: number;
}

/**
 * Full pipeline: brief → connected LLM (JSON slide content) → local .pptx.
 * Uses the same /api/llm/chat route as the rest of the app, so whichever
 * provider is active in Settings (Kimi, Claude, SAP AI Core) does the writing.
 */
export async function generateProposalDeck(input: ProposalBriefInput): Promise<GeneratedDeck> {
  const brief = buildProposalBrief(input);
  // The active review rule set (Rules page: built-in + custom) shapes the deck
  // so the generated proposal passes its own quality review.
  const rules = await getActiveDeepRules().catch(() => [] as DeepRule[]);
  const raw = await invokeLlm(buildDeckPrompt(brief, input.clientName, rules), 3000, 0.3);
  const spec = parseDeckSpec(raw);
  const blob = await renderDeck(spec, input.clientName);
  const base64 = await blobToBase64(blob);
  // Title + agenda + content slides + closing.
  return { blob, base64, slideCount: spec.slides.length + 3 };
}

async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
