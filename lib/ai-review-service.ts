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

Review the proposal documents against the following ruleset. Each criterion has a validation type: error (must be fixed, critical gap), warning (risk or concern to address), or suggestion (opportunity for improvement). For each criterion, assign a score from 0 to 10 (where 0 = completely missing/inadequate, 10 = excellent), preserve the criterion's type in your rating, and provide detailed, actionable feedback with specific evidence from the document.

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
  "summary": "A detailed overall assessment paragraph explaining the proposal's strengths, weaknesses, and readiness",
  "strengths": ["specific strength with evidence", "another strength"],
  "weaknesses": ["specific weakness with impact", "another weakness"],
  "recommendations": ["actionable recommendation 1", "actionable recommendation 2"],
  "ratings": [
    {
      "criterionId": "exact-criterion-id",
      "score": 7,
      "type": "error",
      "feedback": "1-2 sentence explanation of why this score was given",
      "evidence": "1 sentence of specific evidence from the proposal text (quote or section reference)",
      "issue": "1 sentence describing what is wrong, missing, or inadequate",
      "recommendation": "1 sentence with a specific, actionable improvement"
    }
  ]
}

Important:
- Include exactly one rating for every criterion in the ruleset.
- Use the exact criterionId values provided in the ruleset.
- Scores must be integers between 0 and 10.
- The "type" field in each rating must match the criterion's validation type (error, warning, or suggestion).
- Be objective and base scores strictly on content present in the documents.
- If a topic is not addressed in the documents, give it a low score (0-2) and state it is missing.
- Make feedback, issues, and recommendations specific and actionable. Avoid generic statements.
- For errors, explain the business or compliance risk. For warnings, explain the potential impact. For suggestions, explain the concrete improvement.`;
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
- Output MUST be valid, complete JSON. If the output would be too long, keep each text field to 1 sentence maximum.

Please provide the JSON review output.`;
}

function buildSectionUserPrompt(
  proposal: Proposal,
  ruleset: Ruleset,
  section: Ruleset["sections"][number],
  extracted?: ExtractedDocumentTexts
): string {
  const finalProposalText = extracted?.finalProposalText?.trim() || "";
  const contextText = extracted?.contextText?.trim() || "";

  const sectionRuleset = {
    name: ruleset.name,
    description: ruleset.description,
    sections: [
      {
        id: section.id,
        title: section.title,
        description: section.description,
        weight: section.weight,
        subsections: section.subsections.map((ss) => ({
          id: ss.id,
          title: ss.title,
          description: ss.description,
          weight: ss.weight,
          criteria: ss.criteria.map((c) => ({
            id: c.id,
            title: c.title,
            description: c.description,
            type: c.type,
            weight: c.weight,
            prompt: c.prompt,
          })),
        })),
      },
    ],
  };

  return `Proposal Title: ${proposal.title}
Client: ${proposal.clientName}
Description: ${proposal.description}
Technology: ${proposal.technology || "Not specified"}
Project Type: ${proposal.projectType || "Not specified"}

Review ONLY this section of the ruleset:
${JSON.stringify(sectionRuleset, null, 2)}

${contextText ? `Supporting Documents (for context / requirements only):
---
${contextText}
---

` : ""}Customer Final Proposal (evaluate this against the ruleset):
---
${finalProposalText || "No final proposal text available."}
---

Instructions:
- Evaluate ONLY the Customer Final Proposal against the criteria in this section.
- Use the Supporting Documents to understand the customer requirements, but do not score the supporting documents themselves.
- Return ONLY a valid JSON object matching the structure in the system prompt, with ratings for every criterion in this section.
- Keep every text field to 1 sentence maximum so the JSON stays compact.`;
}

function generateSummaryFromRatings(ratings: ReviewRating[], ruleset: Ruleset, overallScore: number): string {
  if (ratings.length === 0) return "No ratings available.";

  const sectionScores = new Map<string, { title: string; score: number; count: number }>();
  for (const section of ruleset.sections) {
    let weightedSum = 0;
    let weightSum = 0;
    for (const subsection of section.subsections) {
      for (const criterion of subsection.criteria) {
        const rating = ratings.find((r) => r.criterionId === criterion.id);
        if (rating) {
          weightedSum += rating.score * subsection.weight * criterion.weight;
          weightSum += subsection.weight * criterion.weight;
        }
      }
    }
    sectionScores.set(section.id, {
      title: section.title,
      score: weightSum > 0 ? Math.round((weightedSum / weightSum) * 10) / 10 : 0,
      count: section.subsections.reduce((sum, ss) => sum + ss.criteria.length, 0),
    });
  }

  const sorted = Array.from(sectionScores.values()).sort((a, b) => b.score - a.score);
  const top = sorted.slice(0, 2).filter((s) => s.score >= 6);
  const bottom = sorted.slice(-2).filter((s) => s.score < 6);

  let summary = `The proposal scored ${overallScore}/10 overall across ${ratings.length} criteria. `;
  if (top.length > 0) {
    summary += `Strongest areas: ${top.map((s) => `${s.title} (${s.score}/10)`).join(", ")}. `;
  }
  if (bottom.length > 0) {
    summary += `Areas needing improvement: ${bottom.map((s) => `${s.title} (${s.score}/10)`).join(", ")}. `;
  } else {
    summary += "All evaluated areas meet or exceed expectations. ";
  }
  summary += "See the per-criterion ratings below for detailed feedback, evidence, issues, and recommendations.";
  return summary;
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

function getLatestDocsByCategory(docs: UploadedFile[]): Record<UploadedFile["category"], UploadedFile[]> {
  const grouped = new Map<UploadedFile["category"], UploadedFile[]>();
  for (const doc of docs) {
    const arr = grouped.get(doc.category) ?? [];
    arr.push(doc);
    grouped.set(doc.category, arr);
  }

  const result = {} as Record<UploadedFile["category"], UploadedFile[]>;
  for (const [category, catDocs] of grouped.entries()) {
    const sorted = catDocs.sort((a, b) => {
      const versionDiff = (b.version ?? 1) - (a.version ?? 1);
      if (versionDiff !== 0) return versionDiff;
      return new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime();
    });
    const highestVersion = sorted[0]?.version ?? 1;
    result[category] = sorted.filter((d) => (d.version ?? 1) === highestVersion);
  }
  return result;
}

export function extractFinalProposalAndContext(proposal: Proposal): ExtractedDocumentTexts {
  const latestByCategory = getLatestDocsByCategory(proposal.documents);
  const finalProposalDocs = latestByCategory.final_proposal ?? [];
  const contextDocs = (["rfp", "transcript", "customer_doc"] as const).flatMap(
    (category) => latestByCategory[category] ?? []
  );

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

async function callReviewApi(
  config: LlmConfig,
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 8192
): Promise<string> {
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
      maxTokens,
    } as LlmConfig & { messages: unknown[]; temperature: number; maxTokens: number }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(body.error || `LLM request failed (${response.status})`);
  }

  const body = (await response.json()) as { content?: string; error?: string };
  if (body.error) throw new Error(body.error);
  if (!body.content) throw new Error("LLM returned empty response");
  return body.content;
}

async function runAiReviewFull(options: AiReviewOptions, config: LlmConfig): Promise<AiReviewResult> {
  const systemPrompt = buildSystemPrompt(options.ruleset);
  const extracted = extractFinalProposalAndContext(options.proposal);
  const userPrompt = buildUserPrompt(options, extracted);
  const content = await callReviewApi(config, systemPrompt, userPrompt, 8192);
  const parsed = parseAiResponse(content, options.ruleset);

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

async function runAiReviewSectionBySection(
  options: AiReviewOptions,
  config: LlmConfig
): Promise<AiReviewResult> {
  const systemPrompt = buildSystemPrompt(options.ruleset);
  const extracted = extractFinalProposalAndContext(options.proposal);
  const allRatings: ReviewRating[] = [];
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const recommendations: string[] = [];
  const errors: string[] = [];

  for (const section of options.ruleset.sections) {
    try {
      const userPrompt = buildSectionUserPrompt(options.proposal, options.ruleset, section, extracted);
      const content = await callReviewApi(config, systemPrompt, userPrompt, 4096);
      const parsed = parseAiResponse(content, {
        ...options.ruleset,
        sections: [section],
      });
      if (parsed.ratings) allRatings.push(...parsed.ratings);
      if (parsed.strengths) strengths.push(...parsed.strengths);
      if (parsed.weaknesses) weaknesses.push(...parsed.weaknesses);
      if (parsed.recommendations) recommendations.push(...parsed.recommendations);
    } catch (err) {
      errors.push(`${section.title}: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  if (allRatings.length === 0) {
    throw new Error(`Section-by-section review failed: ${errors.join("; ")}`);
  }

  const overallScore = calculateOverallScore(allRatings, options.ruleset);
  const summary = generateSummaryFromRatings(allRatings, options.ruleset, overallScore);

  return {
    id: crypto.randomUUID(),
    proposalId: options.proposal.id,
    rulesetId: options.ruleset.id,
    ratings: allRatings,
    overallScore,
    summary,
    strengths,
    weaknesses,
    recommendations,
    generatedAt: new Date(),
    modelUsed: config.provider,
  };
}

export async function runAiReview(options: AiReviewOptions): Promise<AiReviewResult> {
  const config = getActiveLlmConfig();
  if (!config) {
    throw new Error("LLM is not configured. Please configure Claude or another provider in Settings > LLM Provider.");
  }

  try {
    return await runAiReviewFull(options, config);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("JSON") || message.includes("Unterminated") || err instanceof SyntaxError) {
      console.warn("Full AI review response was truncated or invalid JSON. Falling back to section-by-section review.", err);
      return runAiReviewSectionBySection(options, config);
    }
    throw err;
  }
}
