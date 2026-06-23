import type { Proposal, Ruleset, AiReviewResult, ReviewRating, ValidationType, UploadedFile } from "./types";
import type { LlmConfig } from "./llm/types";
import { calculateOverallScore } from "./ruleset-utils";
import { getActiveLlmConfig } from "./llm/config";

export interface AiReviewOptions {
  proposal: Proposal;
  ruleset: Ruleset;
  documentText: string;
}

export interface ExtractedDocumentTexts {
  finalProposalText: string;
  contextText: string;
}

function buildSystemPrompt(ruleset: Ruleset): string {
  return `You are an expert SAP proposal reviewer evaluating a vendor response to an SAP RFP or proposal request.

Review the proposal documents against the following ruleset. Each criterion has a validation type: error (must be fixed, critical gap), warning (risk or concern to address), or suggestion (opportunity for improvement). For each criterion, assign a score from 0 to 10 (where 0 = completely missing/inadequate, 10 = excellent), preserve the criterion's type in your rating, and provide concise feedback with evidence from the document.

Ruleset: ${ruleset.name}
${ruleset.description ? `Description: ${ruleset.description}` : ""}

Scoring guidelines:
- 0-2: Missing, unclear, or severely inadequate
- 3-4: Partial coverage with significant gaps
- 5-6: Adequate but generic or lacking depth
- 7-8: Good coverage with specific, relevant details
- 9-10: Excellent, comprehensive, and demonstrates strong SAP expertise

Return ONLY a valid JSON object with no markdown formatting, code fences, or explanatory text before or after. The JSON must match this structure:

{
  "summary": "Overall assessment paragraph",
  "strengths": ["strength 1", "strength 2"],
  "weaknesses": ["weakness 1", "weakness 2"],
  "recommendations": ["recommendation 1", "recommendation 2"],
  "ratings": [
    {
      "criterionId": "exact-criterion-id",
      "score": 7,
      "type": "error",
      "feedback": "Brief feedback for this criterion",
      "evidence": "Specific evidence from the document",
      "issue": "What is wrong, missing, or inadequate for this criterion",
      "recommendation": "What should be changed or added to fix it"
    }
  ]
}

Important:
- Include exactly one rating for every criterion in the ruleset.
- Use the exact criterionId values provided in the ruleset.
- Scores must be integers between 0 and 10.
- The "type" field in each rating must match the criterion's validation type (error, warning, or suggestion).
- Be objective and base scores strictly on content present in the documents.
- If a topic is not addressed in the documents, give it a low score (0-2) and state it is missing.`;
}

function buildRulesetJson(ruleset: Ruleset): string {
  const exportable = {
    name: ruleset.name,
    description: ruleset.description,
    sections: ruleset.sections.map((section) => ({
      id: section.id,
      title: section.title,
      description: section.description,
      weight: section.weight,
      subsections: section.subsections.map((subsection) => ({
        id: subsection.id,
        title: subsection.title,
        description: subsection.description,
        weight: subsection.weight,
        criteria: subsection.criteria.map((criterion) => ({
          id: criterion.id,
          title: criterion.title,
          description: criterion.description,
          type: criterion.type,
          weight: criterion.weight,
          prompt: criterion.prompt,
        })),
      })),
    })),
  };
  return JSON.stringify(exportable, null, 2);
}

function buildUserPrompt(options: AiReviewOptions, extracted?: ExtractedDocumentTexts): string {
  const { proposal, ruleset, documentText } = options;
  const finalProposalText = extracted?.finalProposalText?.trim() || documentText;
  const contextText = extracted?.contextText?.trim() || "";

  return `Proposal Title: ${proposal.title}
Client: ${proposal.clientName}
Description: ${proposal.description}
Technology: ${proposal.technology || "Not specified"}
Project Type: ${proposal.projectType || "Not specified"}

Review Ruleset:
${buildRulesetJson(ruleset)}

${contextText ? `Supporting Documents (for context / requirements only):
---
${contextText}
---

` : ""}Customer Final Proposal (evaluate this against the ruleset):
---
${finalProposalText || "No final proposal text available."}
---

Instructions:
- Evaluate ONLY the Customer Final Proposal against every criterion in the ruleset.
- Use the Supporting Documents to understand the customer requirements, but do not score the supporting documents themselves.
- Base all ratings, evidence, and feedback strictly on the content of the Customer Final Proposal.

Please provide the JSON review output.`;
}

export async function extractDocumentText(proposal: Proposal): Promise<string> {
  const texts: string[] = [];
  for (const doc of proposal.documents) {
    if (doc.extractedText?.trim()) {
      texts.push(`## ${doc.name} (${doc.category})\n\n${doc.extractedText.trim()}`);
    } else if (doc.content) {
      // Try to decode base64 text files
      try {
        const decoded = decodeBase64(doc.content);
        if (decoded.trim()) {
          texts.push(`## ${doc.name} (${doc.category})\n\n${decoded.trim()}`);
        }
      } catch {
        texts.push(`## ${doc.name} (${doc.category})\n\n[Binary content, no extracted text available]`);
      }
    }
  }
  return texts.join("\n\n---\n\n");
}

function extractTextForDoc(doc: UploadedFile): string {
  if (doc.extractedText?.trim()) {
    return doc.extractedText.trim();
  }
  if (doc.content) {
    try {
      const decoded = decodeBase64(doc.content);
      if (decoded.trim()) return decoded.trim();
    } catch {
      // fall through
    }
  }
  return "[Binary content, no extracted text available]";
}

export function extractFinalProposalAndContext(proposal: Proposal): ExtractedDocumentTexts {
  const finalProposalDocs = proposal.documents.filter((d) => d.category === "final_proposal");
  const contextDocs = proposal.documents.filter((d) => d.category !== "final_proposal");

  const finalProposalText = finalProposalDocs
    .map((doc) => `## ${doc.name}\n\n${extractTextForDoc(doc)}`)
    .join("\n\n---\n\n");

  const contextText = contextDocs
    .map((doc) => `## ${doc.name} (${doc.category})\n\n${extractTextForDoc(doc)}`)
    .join("\n\n---\n\n");

  return { finalProposalText, contextText };
}

function decodeBase64(base64: string): string {
  try {
    const decoded = atob(base64);
    return decodeURIComponent(escape(decoded));
  } catch {
    return atob(base64);
  }
}

function parseAiResponse(content: string, ruleset: Ruleset): Partial<AiReviewResult> {
  let jsonText = content.trim();

  // Remove markdown code fences if present
  if (jsonText.startsWith("```")) {
    jsonText = jsonText.replace(/^```[a-z]*\n?/, "").replace(/\n?```$/, "").trim();
  }

  const parsed = JSON.parse(jsonText) as {
    summary?: string;
    strengths?: string[];
    weaknesses?: string[];
    recommendations?: string[];
    ratings?: Array<{
      criterionId?: string;
      score?: number;
      type?: string;
      feedback?: string;
      evidence?: string;
      issue?: string;
      recommendation?: string;
    }>;
  };

  const criterionIds = new Set<string>();
  for (const section of ruleset.sections) {
    for (const subsection of section.subsections) {
      for (const criterion of subsection.criteria) {
        criterionIds.add(criterion.id);
      }
    }
  }

  const ratings: ReviewRating[] = [];
  for (const section of ruleset.sections) {
    for (const subsection of section.subsections) {
      for (const criterion of subsection.criteria) {
        const raw = parsed.ratings?.find((r) => r.criterionId === criterion.id);
        const score = typeof raw?.score === "number" ? Math.max(0, Math.min(10, Math.round(raw.score))) : 0;
        const validTypes: ValidationType[] = ["error", "warning", "suggestion"];
        const type: ValidationType =
          raw?.type && validTypes.includes(raw.type as ValidationType) ? (raw.type as ValidationType) : criterion.type;
        ratings.push({
          criterionId: criterion.id,
          subsectionId: subsection.id,
          sectionId: section.id,
          score,
          type,
          feedback: raw?.feedback || (raw ? `Score: ${score}/10` : "No evaluation provided."),
          evidence: raw?.evidence || "",
          issue: raw?.issue || "",
          recommendation: raw?.recommendation || "",
        });
      }
    }
  }

  return {
    summary: parsed.summary || "No summary provided.",
    strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
    weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses : [],
    recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
    ratings,
  };
}

export async function runAiReview(options: AiReviewOptions): Promise<AiReviewResult> {
  const config = getActiveLlmConfig();
  if (!config) {
    throw new Error("LLM is not configured. Please configure Claude or another provider in Settings > LLM Provider.");
  }

  const systemPrompt = buildSystemPrompt(options.ruleset);
  const extracted = extractFinalProposalAndContext(options.proposal);
  const userPrompt = buildUserPrompt(options, extracted);

  const response = await fetch("/api/llm/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...config,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.2,
      maxTokens: 4096,
    } as LlmConfig & { messages: unknown[]; temperature: number; maxTokens: number }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(body.error || `LLM request failed (${response.status})`);
  }

  const body = (await response.json()) as { content?: string; error?: string };
  if (body.error) throw new Error(body.error);
  if (!body.content) throw new Error("LLM returned empty response");

  const parsed = parseAiResponse(body.content, options.ruleset);

  return {
    id: crypto.randomUUID(),
    proposalId: options.proposal.id,
    rulesetId: options.ruleset.id,
    ratings: parsed.ratings || [],
    overallScore: calculateOverallScore(parsed.ratings || [], options.ruleset),
    summary: parsed.summary || "",
    strengths: parsed.strengths || [],
    weaknesses: parsed.weaknesses || [],
    recommendations: parsed.recommendations || [],
    generatedAt: new Date(),
    modelUsed: config.provider,
  };
}
