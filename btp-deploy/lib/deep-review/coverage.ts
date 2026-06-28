// Requirement extraction + coverage analysis — ported from context_service.py.
//
// 1. extractRequirements(): read the supporting docs (RFP / transcript /
//    customer docs) and pull out a structured list of customer requirements.
// 2. analyzeRequirementCoverage(): grade the final proposal against them.

import type { ExtractedRequirement, RequirementCoverage } from "./types";
import { invokeLlm, cleanJson } from "./llm";

const EXTRACTION_PROMPT = `You are a senior pre-sales analyst reading customer requirement
documents and meeting notes for an IT consulting engagement. Read all documents below
and extract the customer's discrete requirements in JSON.

Return ONLY a valid JSON object. No markdown, no commentary.

JSON schema:
{
  "requirements": [
    {
      "id": "R1",
      "title": "<short title, max 12 words>",
      "description": "<one-sentence concrete requirement>",
      "priority": "must_have" | "should_have" | "nice_to_have",
      "source_file": "<name of the document this came from>"
    }
  ]
}

Rules:
- Extract 5-25 distinct requirements. Be specific. Avoid generic items like "good quality".
- Group near-duplicates from different docs into a single requirement.

Documents:
---
{docs_block}
---`;

const COVERAGE_PROMPT = `You are reviewing whether a vendor's proposal addresses the
customer's documented requirements.

Return ONLY a valid JSON object. No markdown.

JSON schema:
{
  "coverage_score": <integer 0-100>,
  "addressed_count": <int>,
  "partial_count": <int>,
  "missing_count": <int>,
  "items": [
    {
      "requirement_id": "<id from requirements list>",
      "requirement_title": "<title>",
      "status": "addressed" | "partial" | "missing",
      "evidence": "<short quote / paraphrase from the proposal, or '' if missing>",
      "gap": "<what is missing or weak, or '' if fully addressed>"
    }
  ],
  "missing_topics": ["<topics the customer asked for but the proposal never mentions>"],
  "summary": "<2-sentence summary of coverage quality>"
}

CUSTOMER REQUIREMENTS (from RFP / requirements docs / meeting transcripts):
{requirements_json}

PROPOSAL DOCUMENT:
---
{proposal_text}
---`;

export async function extractRequirements(contextText: string): Promise<ExtractedRequirement[]> {
  if (!contextText || !contextText.trim()) return [];
  try {
    const prompt = EXTRACTION_PROMPT.replace("{docs_block}", contextText.slice(0, 40000));
    const raw = await invokeLlm(prompt, 4000, 0.1);
    const data = JSON.parse(cleanJson(raw)) as { requirements?: Partial<ExtractedRequirement>[] };
    const reqs = data.requirements ?? [];
    return reqs
      .filter((r) => (r.title || r.description))
      .map((r, i) => ({
        id: r.id || `R${i + 1}`,
        title: r.title || "",
        description: r.description || "",
        priority:
          r.priority === "must_have" || r.priority === "nice_to_have" ? r.priority : "should_have",
        source_file: r.source_file || "",
      }));
  } catch {
    return [];
  }
}

export async function analyzeRequirementCoverage(
  requirements: ExtractedRequirement[],
  proposalText: string
): Promise<RequirementCoverage | null> {
  if (!requirements.length) return null;
  try {
    const slimReqs = requirements.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      priority: r.priority,
    }));
    const prompt = COVERAGE_PROMPT.replace(
      "{requirements_json}",
      JSON.stringify(slimReqs, null, 2).slice(0, 6000)
    ).replace("{proposal_text}", proposalText.slice(0, 40000));
    const raw = await invokeLlm(prompt, 4000, 0.1);
    const data = JSON.parse(cleanJson(raw)) as RequirementCoverage;

    const items = data.items ?? [];
    const addressed = items.filter((i) => i.status === "addressed").length;
    const partial = items.filter((i) => i.status === "partial").length;
    const missing = items.filter((i) => i.status === "missing").length;
    const total = Math.max(1, addressed + partial + missing);

    return {
      items,
      missing_topics: data.missing_topics ?? [],
      summary: data.summary ?? "",
      addressed_count: addressed,
      partial_count: partial,
      missing_count: missing,
      coverage_score: Math.round(((addressed + 0.5 * partial) / total) * 100),
    };
  } catch {
    return null;
  }
}
