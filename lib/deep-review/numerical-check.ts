// Numerical / arithmetic validator — ported from numerical_check_service.py.
//
// The LLM extracts every numerical CLAIM (sum / multiplication / percentage
// breakdown) it can find but does NOT compute the answer. We then recompute in
// JS and flag any discrepancy. This catches pricing-table bugs: line items that
// don't add up, percentages ≠ 100, days × rate ≠ stated cost, etc.

import type { NumericalCheck, NumericalComponent, NumericalDiscrepancy } from "./types";
import { invokeLlm, cleanJson } from "./llm";

const EXTRACTION_PROMPT = `You are auditing the numerical claims in a vendor proposal.
Tables in the document may be rendered between [Table start] and [Table end]
markers with pipe-delimited rows that preserve column alignment — empty cells
appear as "" and are MEANINGFUL (do not skip them, they keep columns aligned).

Labelled cost lines like:
    VWGDS Cost: $ 1,777,075
    Total Cost: 250000 EUR
    TCV: 1.5M
are LABELLED COST CALLOUTS. The label on the left of the colon names the total;
the right-hand side is the stated value.

# YOUR PROCESS (follow this exactly, in order):

STEP 1 — Enumerate EVERY total/cost callout in the document. A "total callout"
is: (a) a row labelled Total / Grand Total / Subtotal / Sum / TCV / Project Cost
/ Year Total / Phase Total; (b) a standalone labelled value naming a cost
("Total Project Cost: $X", "TCV: $X", "<Vendor> Cost: $X"); (c) a percentage
breakdown that should sum to 100%. List EVERY ONE in \`total_callouts\`.
Individual line items inside a cost-breakdown table are NOT callouts — they are
COMPONENTS of whatever total summarises them.

STEP 2 — For each callout, identify its components and convert it to a claim in
\`claims\`. If you genuinely cannot, set \`skipped_reason\` on the callout entry.

STEP 3 — Add any leftover claims (multiplications, etc.).

Return ONLY a JSON object — no markdown, no commentary.

A "claim" is one of:
  - "sum"            A list of row values and a stated TOTAL.
  - "multiplication" A product (qty × months × rate = line total). Only use when
                     ALL factors are visible in the same row.
  - "percentage_sum" A list of percentages that should sum to 100.
  - "subtotal"       Stated sub-total of a labelled subset.

Rules for extraction:
  * Record values EXACTLY as they appear — do NOT compute anything.
  * Strip currency symbols and thousand separators (use 1250000, not "$1,250,000").
  * Convert M/K/Lakh/Cr/%: 1.25M → 1250000, 50% → 50, 1.5 Cr → 15000000, 3 Lacs → 300000.
  * Skip ranges ("10–12 days") and narrative numbers ("founded in 1998").
  * Each claim MUST have a labelled stated total / result.
  * Use unique ids: c1, c2, c3...
  * When in doubt about a sum, EXTRACT IT — a sanity filter drops claims with
    too-large gaps, so "I missed a row" false positives are auto-suppressed.

JSON schema (BOTH fields required):
{
  "total_callouts": [
    {"label":"VWGDS Cost","value":1777075,"unit":"USD","location":"Slide 18","converted_to_claim_id":"c1"}
  ],
  "claims": [
    {"id":"c1","kind":"sum","label":"Project total cost",
     "components":[{"name":"Phase 1","value":120000},{"name":"Phase 2","value":80000}],
     "stated_total":200000,"unit":"EUR","context":"Pricing table"},
    {"id":"c2","kind":"multiplication","label":"Senior consultant cost",
     "factors":[{"name":"days","value":50},{"name":"day rate","value":1200}],
     "stated_result":60000,"unit":"EUR","context":"Team table"},
    {"id":"c3","kind":"percentage_sum","label":"Effort distribution",
     "components":[{"name":"Plan","value":10},{"name":"Build","value":60},{"name":"Run","value":25}],
     "stated_total":100,"unit":"%","context":"Effort pie chart"}
  ]
}

Return UP TO 40 claims and UP TO 60 total_callouts. Keep context, location and
label under 60 characters each. If the proposal genuinely has no totals, return
both arrays empty.

Proposal document:
---
{text}
---`;

interface RawClaim {
  id?: string;
  kind?: string;
  label?: string;
  context?: string;
  unit?: string;
  components?: NumericalComponent[];
  factors?: NumericalComponent[];
  stated_total?: number | string;
  stated_result?: number | string;
}

async function extractNumericalClaims(text: string): Promise<RawClaim[]> {
  if (!text || text.trim().length < 50) return [];
  try {
    const prompt = EXTRACTION_PROMPT.replace("{text}", text.slice(0, 80000));
    const raw = await invokeLlm(prompt, 8000, 0.0);
    const data = JSON.parse(cleanJson(raw)) as { claims?: RawClaim[] };
    return data.claims ?? [];
  } catch {
    return [];
  }
}

function toFloat(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const s = v.replace(/,/g, "").replace(/\s/g, "").replace(/%$/, "").trim();
    const n = Number(s);
    return Number.isFinite(n) && s !== "" ? n : null;
  }
  return null;
}

function approxEqual(a: number, b: number): boolean {
  const diff = Math.abs(a - b);
  if (diff < 0.5) return true;
  const mx = Math.max(Math.abs(a), Math.abs(b));
  return mx > 0 ? diff / mx < 0.005 : false;
}

function likelyExtractionError(computed: number, stated: number, kind: string): boolean {
  const a = Math.abs(computed);
  const b = Math.abs(stated);
  if (a === 0 && b === 0) return false;
  if (kind === "multiplication") {
    if (a === 0) return true;
    const ratio = b / a;
    return ratio > 10 || ratio < 0.1;
  }
  if (kind === "sum" || kind === "subtotal") {
    if (a === 0) return true;
    const ratio = b / a;
    return ratio > 5 || ratio < 0.2;
  }
  if (kind === "percentage_sum") {
    return a < 50 || a > 150;
  }
  return false;
}

function fmt(n: number, unit: string): string {
  if (unit === "%") return `${n}%`;
  if (Math.abs(n) >= 1000) return `${n.toLocaleString(undefined, { maximumFractionDigits: 0 })} ${unit}`.trim();
  return `${n} ${unit}`.trim();
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function verifyClaims(claims: RawClaim[]): NumericalCheck {
  const discrepancies: NumericalDiscrepancy[] = [];
  let checked = 0;
  let ok = 0;
  let skippedLowConfidence = 0;

  for (const c of claims) {
    const kind = (c.kind || "").toLowerCase();
    const label = c.label || "";
    const ctx = c.context || "";
    const unit = c.unit || "";

    if (kind === "sum" || kind === "subtotal") {
      const comps = c.components || [];
      const stated = toFloat(c.stated_total);
      if (stated === null || comps.length === 0) continue;
      const values = comps.map((x) => toFloat(x.value));
      if (values.some((v) => v === null)) continue;
      checked += 1;
      const computed = (values as number[]).reduce((s, v) => s + v, 0);
      if (approxEqual(computed, stated)) ok += 1;
      else if (likelyExtractionError(computed, stated, "sum")) skippedLowConfidence += 1;
      else {
        discrepancies.push({
          id: c.id || "",
          kind,
          label,
          context: ctx,
          unit,
          expected: round2(computed),
          stated: round2(stated),
          diff: round2(stated - computed),
          components: comps,
          message: `Sum check failed for '${label}': components add up to ${fmt(computed, unit)} but the proposal states ${fmt(stated, unit)} (off by ${fmt(stated - computed, unit)}).`,
        });
      }
    } else if (kind === "multiplication") {
      const factors = c.factors || [];
      const stated = toFloat(c.stated_result);
      if (stated === null || factors.length === 0) continue;
      const values = factors.map((x) => toFloat(x.value));
      if (values.some((v) => v === null)) continue;
      checked += 1;
      const computed = (values as number[]).reduce((p, v) => p * v, 1);
      if (approxEqual(computed, stated)) ok += 1;
      else if (likelyExtractionError(computed, stated, "multiplication")) skippedLowConfidence += 1;
      else {
        const factorStr = factors.map((x) => `${x.name ?? ""}: ${toFloat(x.value)}`).join(" × ");
        discrepancies.push({
          id: c.id || "",
          kind,
          label,
          context: ctx,
          unit,
          expected: round2(computed),
          stated: round2(stated),
          diff: round2(stated - computed),
          components: factors,
          message: `Multiplication check failed for '${label}': ${factorStr} = ${fmt(computed, unit)}, but the proposal states ${fmt(stated, unit)}.`,
        });
      }
    } else if (kind === "percentage_sum") {
      const comps = c.components || [];
      const stated = c.stated_total !== undefined && c.stated_total !== null ? toFloat(c.stated_total) ?? 100 : 100;
      const values = comps.map((x) => toFloat(x.value));
      if (values.length === 0 || values.some((v) => v === null)) continue;
      checked += 1;
      const computed = (values as number[]).reduce((s, v) => s + v, 0);
      if (approxEqual(computed, stated)) ok += 1;
      else if (likelyExtractionError(computed, stated, "percentage_sum")) skippedLowConfidence += 1;
      else {
        discrepancies.push({
          id: c.id || "",
          kind,
          label,
          context: ctx,
          unit: "%",
          expected: round2(computed),
          stated: round2(stated),
          diff: round2(stated - computed),
          components: comps,
          message: `Percentage check failed for '${label}': components sum to ${computed}% — should sum to ${stated}%.`,
        });
      }
    }
  }

  return { claims_extracted: 0, checked, ok, discrepancies, skipped_low_confidence: skippedLowConfidence };
}

export async function runNumericalCheck(text: string): Promise<NumericalCheck> {
  const claims = await extractNumericalClaims(text);
  const result = verifyClaims(claims);
  result.claims_extracted = claims.length;
  return result;
}
